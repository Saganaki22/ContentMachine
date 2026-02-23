import express from 'express';
import * as fal from '@fal-ai/client';
import Replicate from 'replicate';
import { GoogleGenAI } from '@google/genai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
const router = express.Router();

router.get('/', (req, res) => {
  const keys = req.app.get('apiKeys');
  res.json({
    fal: !!(keys.fal && keys.fal.trim()),
    replicate: !!(keys.replicate && keys.replicate.trim()),
    gemini: !!(keys.gemini && keys.gemini.trim()),
    elevenlabs: !!(keys.elevenlabs && keys.elevenlabs.trim()),
  });
});

router.post('/', (req, res) => {
  const { falKey, replicateKey, geminiKey, elevenlabsKey } = req.body;
  const keys = req.app.get('apiKeys');
  const saveKeysToEnv = req.app.get('saveKeysToEnv');
  
  if (falKey !== undefined) keys.fal = falKey.trim();
  if (replicateKey !== undefined) keys.replicate = replicateKey.trim();
  if (geminiKey !== undefined) keys.gemini = geminiKey.trim();
  if (elevenlabsKey !== undefined) keys.elevenlabs = elevenlabsKey.trim();
  
  saveKeysToEnv();
  res.json({ success: true });
});

router.post('/validate', async (req, res) => {
  const { provider, key } = req.body;
  
  if (!key || !key.trim()) {
    return res.json({ valid: false, error: 'API key is required' });
  }
  
  try {
    switch (provider) {
      case 'fal': {
        fal.config({ credentials: key.trim() });
        await fal.subscribe('fal-ai/fast-sdxl', {
          input: { prompt: 'test', image_size: 'square' },
          pollInterval: 1000
        });
        return res.json({ valid: true });
      }
      
      case 'replicate': {
        const replicate = new Replicate({ auth: key.trim() });
        await replicate.models.get('black-forest-labs', 'flux-1.1-pro');
        return res.json({ valid: true });
      }
      
      case 'gemini': {
        const ai = new GoogleGenAI({ apiKey: key.trim() });
        await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: 'Say "ok" in one word.'
        });
        return res.json({ valid: true });
      }
      
      case 'elevenlabs': {
        const client = new ElevenLabsClient({ apiKey: key.trim() });
        await client.voices.getAll();
        return res.json({ valid: true });
      }
      
      default:
        return res.json({ valid: false, error: 'Unknown provider' });
    }
  } catch (error) {
    console.error(`Validation error for ${provider}:`, error.message);
    
    let errorMessage = error.message;
    if (error.status === 401 || error.code === 401) {
      errorMessage = 'Invalid API key';
    } else if (error.status === 403 || error.code === 403) {
      errorMessage = 'API key does not have required permissions';
    } else if (error.status === 429 || error.code === 429) {
      errorMessage = 'Rate limited - key appears valid';
      return res.json({ valid: true, warning: errorMessage });
    }
    
    return res.json({ valid: false, error: errorMessage });
  }
});

export default router;
