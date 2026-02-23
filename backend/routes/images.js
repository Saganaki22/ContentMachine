import express from 'express';
import * as fal from '@fal-ai/client';
import Replicate from 'replicate';
import { GoogleGenAI } from '@google/genai';
const router = express.Router();

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

const generateWithGemini = async (ai, prompt, aspectRatio, model) => {
  try {
    const response = await ai.models.generateContent({
      model: model || 'gemini-3-pro-image-preview',
      contents: prompt,
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

const buildFalInput = (modelId, prompt, aspectRatio) => {
  if (ASPECT_RATIO_MODELS.has(modelId)) {
    return {
      prompt,
      aspect_ratio: aspectRatio || '16:9',
      output_format: 'jpeg',
      resolution: '2K',
      safety_tolerance: '4',
    };
  }
  // Default: image_size enum
  return {
    prompt,
    image_size: aspectRatioToImageSize(aspectRatio),
  };
};

const generateWithFal = async (falClient, modelId, prompt, aspectRatio) => {
  const input = buildFalInput(modelId, prompt, aspectRatio);
  const result = await falClient.subscribe(modelId, {
    input,
    pollInterval: 2000,
  });
  const url = result.data?.images?.[0]?.url || result.images?.[0]?.url;
  if (!url) throw new Error('No image URL in fal response');
  return { prompt, url, error: null };
};

router.post('/generate', async (req, res) => {
  try {
    const { prompts, provider, model, aspectRatio } = req.body;
    
    const results = await Promise.allSettled(
      prompts.map(async (prompt) => {
        if (provider === 'fal') {
          const falClient = getFalClient(req);
          const selectedModel = model || 'fal-ai/flux-pro';
          return await generateWithFal(falClient, selectedModel, prompt, aspectRatio);
        } else if (provider === 'gemini') {
          const genAI = getGeminiClient(req);
          return await generateWithGemini(genAI, prompt, aspectRatio, model);
        } else if (provider === 'replicate') {
          const replicate = getReplicateClient(req);
          const selectedModel = model || 'black-forest-labs/flux-1.1-pro';
          
          let output;
          if (selectedModel === 'black-forest-labs/flux-2-pro') {
            output = await replicate.run('black-forest-labs/flux-2-pro', {
              input: { 
                prompt, 
                aspect_ratio: aspectRatio || '16:9',
                output_format: 'webp',
                safety_tolerance: 2
              }
            });
          } else if (selectedModel === 'google/nano-banana-pro') {
            output = await replicate.run('google/nano-banana-pro', {
              input: { 
                prompt, 
                aspect_ratio: aspectRatio || '16:9',
                resolution: '2K',
                output_format: 'png',
                safety_filter_level: 'block_only_high'
              }
            });
          } else if (selectedModel === 'google/imagen-4') {
            output = await replicate.run('google/imagen-4', {
              input: {
                prompt,
                aspect_ratio: aspectRatio || '16:9',
                image_size: '2k',
                safety_filter_level: 'block_medium_and_above',
                output_format: 'png',
              }
            });
          } else {
            output = await replicate.run(selectedModel, {
              input: { prompt, aspect_ratio: aspectRatio || '16:9' }
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
    const { prompt, provider, model, aspectRatio } = req.body;
    
    console.log('Regenerate request:', { provider, model, aspectRatio, promptLength: prompt?.length });
    
    if (provider === 'fal') {
      const falClient = getFalClient(req);
      const selectedModel = model || 'fal-ai/flux-pro';
      const result = await generateWithFal(falClient, selectedModel, prompt, aspectRatio);
      console.log('FAL result URL:', result.url);
      res.json({ url: result.url });
    } else if (provider === 'gemini') {
      const genAI = getGeminiClient(req);
      const result = await generateWithGemini(genAI, prompt, aspectRatio, model);
      console.log('Gemini result URL:', result.url?.substring(0, 50) + '...');
      res.json({ url: result.url });
    } else if (provider === 'replicate') {
      const replicate = getReplicateClient(req);
      const selectedModel = model || 'black-forest-labs/flux-1.1-pro';
      
      let output;
      if (selectedModel === 'black-forest-labs/flux-2-pro') {
        output = await replicate.run('black-forest-labs/flux-2-pro', {
          input: { 
            prompt, 
            aspect_ratio: aspectRatio || '16:9',
            output_format: 'webp',
            safety_tolerance: 2
          }
        });
      } else if (selectedModel === 'google/nano-banana-pro') {
        output = await replicate.run('google/nano-banana-pro', {
          input: { 
            prompt, 
            aspect_ratio: aspectRatio || '16:9',
            resolution: '2K',
            output_format: 'png',
            safety_filter_level: 'block_only_high'
          }
        });
      } else if (selectedModel === 'google/imagen-4') {
        output = await replicate.run('google/imagen-4', {
          input: {
            prompt,
            aspect_ratio: aspectRatio || '16:9',
            image_size: '2k',
            safety_filter_level: 'block_medium_and_above',
            output_format: 'png',
          }
        });
      } else {
        output = await replicate.run(selectedModel, {
          input: { prompt, aspect_ratio: aspectRatio || '16:9' }
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
