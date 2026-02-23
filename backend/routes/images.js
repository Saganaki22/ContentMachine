import express from 'express';
import * as fal from '@fal-ai/client';
import Replicate from 'replicate';
import { GoogleGenAI } from '@google/genai';
const router = express.Router();

// Allowed MIME types for character reference images
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// Parse a base64 data URI into { buffer, mimeType } with validation
const parseDataUri = (dataUri) => {
  if (typeof dataUri !== 'string') throw new Error('Data URI must be a string');
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URI format');
  const mimeType = match[1];
  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }
  return {
    mimeType,
    buffer: Buffer.from(match[2], 'base64'),
  };
};

// Max character description length to prevent prompt injection / oversized payloads
const MAX_CHAR_DESC_LENGTH = 200;

// Upload character reference images to Replicate's file storage so we get
// stable HTTPS URLs that can be passed as image_input to nano-banana-pro.
const uploadCharacterImagesToReplicate = async (replicate, characterImages) => {
  const uploads = await Promise.all(
    characterImages.map(async (dataUri) => {
      const { buffer, mimeType } = parseDataUri(dataUri);
      const blob = new Blob([buffer], { type: mimeType });
      const file = await replicate.files.create(blob, { filename: 'character.png' });
      return file.urls?.get || file.url;
    })
  );
  return uploads.filter(Boolean);
};

const getFalClient = (req) => {
  const keys = req.app.get('apiKeys');
  if (!keys.fal) {
    throw new Error('fal.ai API key not configured');
  }
  fal.config({ credentials: keys.fal });
  return fal;
};

const getReplicateClient = (req) => {
  const keys = req.app.get('apiKeys');
  if (!keys.replicate) {
    throw new Error('Replicate API key not configured');
  }
  return new Replicate({ auth: keys.replicate });
};

const getGeminiClient = (req) => {
  const keys = req.app.get('apiKeys');
  if (!keys.gemini) {
    throw new Error('Gemini API key not configured');
  }
  return new GoogleGenAI({ apiKey: keys.gemini });
};

const generateWithGemini = async (ai, prompt, aspectRatio, model, characterImages = [], characterDescription = '') => {
  try {
    // Build a multipart contents array when character reference images are provided.
    let contents;
    if (characterImages.length > 0) {
      const parts = [];
      for (const dataUri of characterImages) {
        const { mimeType, buffer } = parseDataUri(dataUri);
        parts.push({
          inlineData: {
            mimeType,
            data: buffer.toString('base64'),
          },
        });
      }
      // Build a generic character consistency instruction that works for any character type.
      // If the user provided a description (e.g. "porcelain mannequin", "realistic human",
      // "anime character"), use it — otherwise fall back to a neutral reference.
      const charLabel = characterDescription
        ? characterDescription.trim()
        : 'the character shown in the reference image(s)';
      const characterInstruction =
        `The above image(s) show reference character(s) (${charLabel}). ` +
        'Match their exact visual appearance — body proportions, skin/surface tone, hair style, and overall aesthetic — as faithfully as possible. ' +
        'For this specific scene, apply the period-accurate clothing, accessories, and pose described in the scene prompt below, ' +
        'overriding any clothing shown in the reference image with the scene\'s required costume. ';
      parts.push({ text: characterInstruction + prompt });
      contents = parts;
    } else {
      contents = prompt;
    }

    const response = await ai.models.generateContent({
      model: model || 'gemini-3-pro-image-preview',
      contents,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio || '16:9',
          imageSize: '2K'
        }
      }
    });
    
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No candidates in response');
    }
    
    const parts = response.candidates[0]?.content?.parts;
    if (!parts || !Array.isArray(parts)) {
      throw new Error('No image generated (empty response parts)');
    }
    
    for (const part of parts) {
      if (part.inlineData) {
        const base64 = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
        return { prompt, url: `data:${mimeType};base64,${base64}`, error: null };
      }
    }
    throw new Error('No image generated');
  } catch (error) {
    // Detect rate limit and provide clearer message
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.status === 429) {
      throw new Error('Gemini rate limit exceeded. Wait a minute or switch to fal.ai/Replicate in Settings.');
    }
    throw error;
  }
};

// Map aspect ratio strings to fal ImageSize enum values used by flux/qwen/z-image models
const aspectRatioToImageSize = (aspectRatio) => {
  const map = {
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_9_16',
    '1:1': 'square',
    '4:5': 'portrait_4_3',
    '4:3': 'landscape_4_3',
    '3:4': 'portrait_4_3',
    '3:2': 'landscape_4_3',
  };
  return map[aspectRatio] || 'landscape_16_9';
};

// Models that use image_size enum instead of aspect_ratio string
const IMAGE_SIZE_MODELS = new Set([
  'fal-ai/qwen-image-2512',
  'fal-ai/z-image/base',
  'fal-ai/flux-2-pro',
  'fal-ai/flux-pro',
  'fal-ai/flux/schnell',
  'fal-ai/ideogram/v3',
  'fal-ai/stable-diffusion-3.5-large',
]);

// Models that use aspect_ratio string
const ASPECT_RATIO_MODELS = new Set([
  'fal-ai/nano-banana-pro',
]);

const buildFalInput = (modelId, prompt, aspectRatio, characterImageUrls = []) => {
  if (ASPECT_RATIO_MODELS.has(modelId)) {
    const input = {
      prompt,
      aspect_ratio: aspectRatio || '16:9',
      output_format: 'jpeg',
      resolution: '2K',
      safety_tolerance: '4',
    };
    // nano-banana-pro supports image_input for reference images
    if (characterImageUrls.length > 0) {
      input.image_input = characterImageUrls;
    }
    return input;
  }
  // Default: image_size enum
  return {
    prompt,
    image_size: aspectRatioToImageSize(aspectRatio),
  };
};

const generateWithFal = async (falClient, modelId, prompt, aspectRatio, characterImageUrls = []) => {
  const input = buildFalInput(modelId, prompt, aspectRatio, characterImageUrls);
  const result = await falClient.subscribe(modelId, {
    input,
    pollInterval: 2000,
  });
  const url = result.data?.images?.[0]?.url || result.images?.[0]?.url;
  if (!url) throw new Error('No image URL in fal response');
  return { prompt, url, error: null };
};

// Build a character consistency hint for models that don't support image input
// (e.g. flux-1.1-pro, imagen-4). Since we can't pass the reference image directly,
// we prepend a text reminder describing the character type so the model maintains
// visual consistency. Models that DO accept images (nano-banana-pro, gemini) get
// the actual reference images instead.
// hasCharImages: boolean (true when character reference images are present)
const buildCharacterPromptPrefix = (hasCharImages, characterDescription = '') => {
  if (!hasCharImages) return '';
  const charLabel = characterDescription
    ? characterDescription.trim()
    : 'the reference character';
  return `MAINTAIN CHARACTER CONSISTENCY: replicate the exact appearance of ${charLabel} — ` +
    'body proportions, skin/surface tone, hair style, and overall aesthetic must stay consistent. ';
};

// Extract and upload character images for Replicate (returns stable HTTPS URLs)
const prepareReplicateCharacterImages = async (replicate, characterImages) => {
  if (!characterImages || characterImages.length === 0) return [];
  try {
    return await uploadCharacterImagesToReplicate(replicate, characterImages);
  } catch (err) {
    console.warn('Failed to upload character images to Replicate:', err.message);
    return [];
  }
};

router.post('/generate', async (req, res) => {
  try {
    const { prompts, provider, model, aspectRatio, characterImages, characterDescription } = req.body;

    // Validate required fields
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ error: true, message: 'prompts must be a non-empty array', code: 'INVALID_INPUT' });
    }
    if (typeof provider !== 'string' || !provider) {
      return res.status(400).json({ error: true, message: 'provider is required', code: 'INVALID_INPUT' });
    }
    // Validate each prompt is a non-empty string
    for (const p of prompts) {
      if (typeof p !== 'string' || !p.trim()) {
        return res.status(400).json({ error: true, message: 'Each prompt must be a non-empty string', code: 'INVALID_INPUT' });
      }
    }

    // characterImages is an array of base64 data URIs (male/female reference figures)
    // characterDescription is an optional free-text label (e.g. "porcelain mannequin", "realistic human")
    // Validate and filter characterImages — silently drop any that are malformed
    const rawCharImgs = Array.isArray(characterImages) ? characterImages.filter(Boolean) : [];
    const charImgs = rawCharImgs.filter(item => {
      if (typeof item !== 'string') return false;
      return /^data:image\/[a-zA-Z+]+;base64,/.test(item);
    });
    // Cap characterDescription length to prevent oversized prompt injection
    const charDesc = typeof characterDescription === 'string'
      ? characterDescription.trim().slice(0, MAX_CHAR_DESC_LENGTH)
      : '';

    // For Replicate nano-banana-pro we upload once and reuse the URLs for all prompts
    let replicateCharUrls = [];
    if (provider === 'replicate' && (model === 'google/nano-banana-pro') && charImgs.length > 0) {
      const replicate = getReplicateClient(req);
      replicateCharUrls = await prepareReplicateCharacterImages(replicate, charImgs);
    }
    
    const results = await Promise.allSettled(
      prompts.map(async (prompt) => {
        if (provider === 'fal') {
          const falClient = getFalClient(req);
          const selectedModel = model || 'fal-ai/flux-pro';
          // All fal models receive a text consistency prefix — no stable fal-hosted
          // URL available from raw base64 input, so image_input is not used here.
          const augmentedPrompt = charImgs.length > 0
            ? buildCharacterPromptPrefix(charImgs.length > 0, charDesc) + prompt
            : prompt;
          return await generateWithFal(falClient, selectedModel, augmentedPrompt, aspectRatio);
        } else if (provider === 'gemini') {
          const genAI = getGeminiClient(req);
          return await generateWithGemini(genAI, prompt, aspectRatio, model, charImgs, charDesc);
        } else if (provider === 'replicate') {
          const replicate = getReplicateClient(req);
          const selectedModel = model || 'black-forest-labs/flux-1.1-pro';
          
          let output;
          if (selectedModel === 'black-forest-labs/flux-2-pro') {
            const augPrompt = charImgs.length > 0
              ? buildCharacterPromptPrefix(charImgs.length > 0, charDesc) + prompt
              : prompt;
            output = await replicate.run('black-forest-labs/flux-2-pro', {
              input: { 
                prompt: augPrompt, 
                aspect_ratio: aspectRatio || '16:9',
                output_format: 'webp',
                safety_tolerance: 2
              }
            });
          } else if (selectedModel === 'google/nano-banana-pro') {
            // Build a character context instruction for the prompt
            const charLabel = charDesc || 'the character shown in the reference image(s)';
            const charInstruction = replicateCharUrls.length > 0
              ? `The reference image(s) show ${charLabel}. ` +
                'Match their exact visual appearance — body proportions, skin/surface tone, hair style, and overall aesthetic — as faithfully as possible. ' +
                'Apply the period-accurate clothing and pose described in the scene prompt, overriding the reference costume with the scene\'s required outfit. '
              : '';
            output = await replicate.run('google/nano-banana-pro', {
              input: { 
                prompt: charInstruction + prompt, 
                aspect_ratio: aspectRatio || '16:9',
                resolution: '2K',
                output_format: 'png',
                safety_filter_level: 'block_only_high',
                ...(replicateCharUrls.length > 0 && { image_input: replicateCharUrls }),
              }
            });
          } else if (selectedModel === 'google/imagen-4') {
            const augPrompt = charImgs.length > 0
              ? buildCharacterPromptPrefix(charImgs.length > 0, charDesc) + prompt
              : prompt;
            output = await replicate.run('google/imagen-4', {
              input: {
                prompt: augPrompt,
                aspect_ratio: aspectRatio || '16:9',
                image_size: '2k',
                safety_filter_level: 'block_medium_and_above',
                output_format: 'png',
              }
            });
          } else {
            const augPrompt = charImgs.length > 0
              ? buildCharacterPromptPrefix(charImgs.length > 0, charDesc) + prompt
              : prompt;
            output = await replicate.run(selectedModel, {
              input: { prompt: augPrompt, aspect_ratio: aspectRatio || '16:9' }
            });
          }
          
          // Log the output structure for debugging
          console.log('Replicate output type:', typeof output);
          console.log('Replicate output:', JSON.stringify(output).substring(0, 500));
          
          // Handle various Replicate response formats
          let url = null;
          if (typeof output === 'string') {
            url = output;
          } else if (Array.isArray(output) && output.length > 0) {
            url = typeof output[0] === 'string' ? output[0] : output[0]?.url;
          } else if (output?.url) {
            url = output.url;
          } else if (output?.output) {
            url = typeof output.output === 'string' ? output.output : output.output?.url;
          }
          
          console.log('Extracted URL:', url);
          
          if (!url) {
            console.error('Could not extract URL from Replicate response');
            throw new Error('No image URL in replicate response');
          }
          return { prompt, url, error: null };
        } else {
          throw new Error(`Unknown provider: ${provider}`);
        }
      })
    );
    
    const response = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return { prompt: prompts[index], url: null, error: result.reason?.message || 'Generation failed' };
    });
    
    res.json(response);
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'IMAGE_GENERATION_ERROR' });
  }
});

router.post('/regenerate', async (req, res) => {
  try {
    const { prompt, provider, model, aspectRatio, characterImages, characterDescription } = req.body;

    // Validate required fields
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: true, message: 'prompt must be a non-empty string', code: 'INVALID_INPUT' });
    }
    if (typeof provider !== 'string' || !provider) {
      return res.status(400).json({ error: true, message: 'provider is required', code: 'INVALID_INPUT' });
    }

    // Validate and filter characterImages — silently drop any that are malformed
    const rawCharImgs = Array.isArray(characterImages) ? characterImages.filter(Boolean) : [];
    const charImgs = rawCharImgs.filter(item => {
      if (typeof item !== 'string') return false;
      return /^data:image\/[a-zA-Z+]+;base64,/.test(item);
    });
    // Cap characterDescription length to prevent oversized prompt injection
    const charDesc = typeof characterDescription === 'string'
      ? characterDescription.trim().slice(0, MAX_CHAR_DESC_LENGTH)
      : '';
    
    console.log('Regenerate request:', { provider, model, aspectRatio, promptLength: prompt?.length, charImgCount: charImgs.length, charDesc: charDesc || '(none)' });
    
    if (provider === 'fal') {
      const falClient = getFalClient(req);
      const selectedModel = model || 'fal-ai/flux-pro';
      const augmentedPrompt = charImgs.length > 0
        ? buildCharacterPromptPrefix(charImgs.length > 0, charDesc) + prompt
        : prompt;
      const result = await generateWithFal(falClient, selectedModel, augmentedPrompt, aspectRatio);
      console.log('FAL result URL:', result.url);
      res.json({ url: result.url });
    } else if (provider === 'gemini') {
      const genAI = getGeminiClient(req);
      const result = await generateWithGemini(genAI, prompt, aspectRatio, model, charImgs, charDesc);
      console.log('Gemini result URL:', result.url?.substring(0, 50) + '...');
      res.json({ url: result.url });
    } else if (provider === 'replicate') {
      const replicate = getReplicateClient(req);
      const selectedModel = model || 'black-forest-labs/flux-1.1-pro';

      // Upload character images once for nano-banana-pro
      let replicateCharUrls = [];
      if (selectedModel === 'google/nano-banana-pro' && charImgs.length > 0) {
        replicateCharUrls = await prepareReplicateCharacterImages(replicate, charImgs);
      }
      
      let output;
      if (selectedModel === 'black-forest-labs/flux-2-pro') {
        const augPrompt = charImgs.length > 0
          ? buildCharacterPromptPrefix(charImgs.length > 0, charDesc) + prompt
          : prompt;
        output = await replicate.run('black-forest-labs/flux-2-pro', {
          input: { 
            prompt: augPrompt, 
            aspect_ratio: aspectRatio || '16:9',
            output_format: 'webp',
            safety_tolerance: 2
          }
        });
      } else if (selectedModel === 'google/nano-banana-pro') {
        const charLabel = charDesc || 'the character shown in the reference image(s)';
        const charInstruction = replicateCharUrls.length > 0
          ? `The reference image(s) show ${charLabel}. ` +
            'Match their exact visual appearance — body proportions, skin/surface tone, hair style, and overall aesthetic — as faithfully as possible. ' +
            'Apply the period-accurate clothing and pose described in the scene prompt, overriding the reference costume with the scene\'s required outfit. '
          : '';
        output = await replicate.run('google/nano-banana-pro', {
          input: { 
            prompt: charInstruction + prompt, 
            aspect_ratio: aspectRatio || '16:9',
            resolution: '2K',
            output_format: 'png',
            safety_filter_level: 'block_only_high',
            ...(replicateCharUrls.length > 0 && { image_input: replicateCharUrls }),
          }
        });
      } else if (selectedModel === 'google/imagen-4') {
        const augPrompt = charImgs.length > 0
          ? buildCharacterPromptPrefix(charImgs.length > 0, charDesc) + prompt
          : prompt;
        output = await replicate.run('google/imagen-4', {
          input: {
            prompt: augPrompt,
            aspect_ratio: aspectRatio || '16:9',
            image_size: '2k',
            safety_filter_level: 'block_medium_and_above',
            output_format: 'png',
          }
        });
      } else {
        const augPrompt = charImgs.length > 0
          ? buildCharacterPromptPrefix(charImgs.length > 0, charDesc) + prompt
          : prompt;
        output = await replicate.run(selectedModel, {
          input: { prompt: augPrompt, aspect_ratio: aspectRatio || '16:9' }
        });
      }
      
      // Log output for debugging
      console.log('Regenerate Replicate output type:', typeof output);
      console.log('Regenerate Replicate output:', JSON.stringify(output).substring(0, 300));
      
      // Handle various Replicate response formats
      let url = null;
      if (typeof output === 'string') {
        url = output;
      } else if (Array.isArray(output) && output.length > 0) {
        url = typeof output[0] === 'string' ? output[0] : output[0]?.url;
      } else if (output?.url) {
        url = output.url;
      } else if (output?.output) {
        url = typeof output.output === 'string' ? output.output : output.output?.url;
      }
      
      console.log('Regenerate extracted URL:', url);
      
      if (!url) throw new Error('No image URL in replicate response');
      res.json({ url });
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error) {
    console.error('Image regeneration error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'IMAGE_REGENERATION_ERROR' });
  }
});

export default router;
