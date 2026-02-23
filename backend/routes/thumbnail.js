import express from 'express';
import * as fal from '@fal-ai/client';
import Replicate from 'replicate';
import { GoogleGenAI } from '@google/genai';
const router = express.Router();

const generateWithGemini = async (apiKey, prompt, aspectRatio) => {
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
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
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64 = part.inlineData.data;
      const mimeType = part.inlineData.mimeType;
      return `data:${mimeType};base64,${base64}`;
    }
  }
  throw new Error('No image generated');
};

router.post('/generate', async (req, res) => {
  try {
    const { prompts, provider, aspectRatio } = req.body;
    const keys = req.app.get('apiKeys');
    
    if (provider === 'fal') {
      if (!keys.fal) throw new Error('fal.ai API key not configured');
      fal.config({ credentials: keys.fal });
      
      // Generate thumbnails one at a time to get unique images per prompt
      const results = await Promise.allSettled(
        prompts.map(async (prompt) => {
          const result = await fal.subscribe('fal-ai/nano-banana-pro', {
            input: {
              prompt,
              num_images: 1,
              aspect_ratio: aspectRatio || '16:9',
              output_format: 'jpeg',
              resolution: '2K',
              safety_tolerance: '4'
            }
          });
          const url = result.data?.images?.[0]?.url || result.images?.[0]?.url;
          if (!url) throw new Error('No image URL in fal response');
          return { prompt, url, error: null };
        })
      );

      const response = results.map((result, i) => {
        if (result.status === 'fulfilled') return result.value;
        return { prompt: prompts[i], url: null, error: result.reason?.message || 'Generation failed' };
      });
      res.json(response);
      
    } else if (provider === 'replicate') {
      if (!keys.replicate) throw new Error('Replicate API key not configured');
      const replicate = new Replicate({ auth: keys.replicate });
      
      const results = await Promise.allSettled(
        prompts.map(async (prompt) => {
          const output = await replicate.run('google/nano-banana-pro', {
            input: { 
              prompt, 
              aspect_ratio: aspectRatio || '16:9', 
              resolution: '2K',
              output_format: 'png',
              safety_filter_level: 'block_only_high'
            }
          });
          const url = Array.isArray(output) ? output[0] : output;
          if (!url) throw new Error('No image URL in replicate response');
          return { prompt, url, error: null };
        })
      );
      
      const response = results.map((result, i) => {
        if (result.status === 'fulfilled') return result.value;
        return { prompt: prompts[i], url: null, error: result.reason?.message || 'Generation failed' };
      });
      res.json(response);
      
    } else if (provider === 'gemini') {
      if (!keys.gemini) throw new Error('Gemini API key not configured');
      
      const results = await Promise.allSettled(
        prompts.map(async (prompt) => {
          const url = await generateWithGemini(keys.gemini, prompt, aspectRatio);
          return { prompt, url, error: null };
        })
      );
      
      const response = results.map((result, i) => {
        if (result.status === 'fulfilled') return result.value;
        return { prompt: prompts[i], url: null, error: result.reason?.message || 'Generation failed' };
      });
      res.json(response);
    } else {
      throw new Error('Invalid provider specified');
    }
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'THUMBNAIL_GENERATION_ERROR' });
  }
});

router.post('/regenerate', async (req, res) => {
  try {
    const { prompt, provider, aspectRatio } = req.body;
    const keys = req.app.get('apiKeys');
    
    if (provider === 'fal') {
      if (!keys.fal) throw new Error('fal.ai API key not configured');
      fal.config({ credentials: keys.fal });
      
      const result = await fal.subscribe('fal-ai/nano-banana-pro', {
        input: {
          prompt,
          num_images: 1,
          aspect_ratio: aspectRatio || '16:9',
          output_format: 'jpeg',
          resolution: '2K',
          safety_tolerance: '4'
        }
      });
      const url = result.data?.images?.[0]?.url || result.images?.[0]?.url;
      if (!url) throw new Error('No image URL in fal response');
      res.json({ url });
      
    } else if (provider === 'replicate') {
      if (!keys.replicate) throw new Error('Replicate API key not configured');
      const replicate = new Replicate({ auth: keys.replicate });
      
      const output = await replicate.run('google/nano-banana-pro', {
        input: { 
          prompt, 
          aspect_ratio: aspectRatio || '16:9', 
          resolution: '2K',
          output_format: 'png',
          safety_filter_level: 'block_only_high'
        }
      });
      const url = Array.isArray(output) ? output[0] : output;
      if (!url) throw new Error('No image URL in replicate response');
      res.json({ url });
      
    } else if (provider === 'gemini') {
      if (!keys.gemini) throw new Error('Gemini API key not configured');
      const url = await generateWithGemini(keys.gemini, prompt, aspectRatio);
      res.json({ url });
    } else {
      throw new Error('Invalid provider specified');
    }
  } catch (error) {
    console.error('Thumbnail regeneration error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'THUMBNAIL_REGENERATION_ERROR' });
  }
});

export default router;
