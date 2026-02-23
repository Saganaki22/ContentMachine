import express from 'express';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
const router = express.Router();

const getClient = (req) => {
  const keys = req.app.get('apiKeys');
  if (!keys.elevenlabs) {
    throw new Error('ElevenLabs API key not configured');
  }
  return new ElevenLabsClient({ apiKey: keys.elevenlabs });
};

const streamToBase64 = async (audioStream) => {
  const chunks = [];
  const reader = audioStream.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  const audioBuffer = Buffer.concat(chunks);
  return audioBuffer.toString('base64');
};

router.get('/voices', async (req, res) => {
  try {
    const client = getClient(req);
    const voices = await client.voices.getAll();
    res.json(voices.voices?.map(v => ({
      id: v.voice_id,
      name: v.name,
      labels: v.labels
    })) || []);
  } catch (error) {
    console.error('Get voices error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'GET_VOICES_ERROR' });
  }
});

router.post('/tts', async (req, res) => {
  try {
    const { text, voiceId, modelId } = req.body;
    const client = getClient(req);
    
    const defaultVoiceId = 'JBFqnCBsd6RMkjVDRZzb';
    const defaultModelId = 'eleven_multilingual_v2';
    
    const audio = await client.textToSpeech.convert(voiceId || defaultVoiceId, {
      text,
      modelId: modelId || defaultModelId,
      outputFormat: 'mp3_44100_128',
    });
    
    const base64Audio = await streamToBase64(audio);
    
    res.json({ 
      audio: `data:audio/mp3;base64,${base64Audio}`,
      format: 'mp3'
    });
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'TTS_ERROR' });
  }
});

router.post('/tts/scene', async (req, res) => {
  try {
    const { lines, voiceId, modelId } = req.body;
    const client = getClient(req);
    
    const defaultVoiceId = 'JBFqnCBsd6RMkjVDRZzb';
    const defaultModelId = 'eleven_multilingual_v2';
    const voice = voiceId || defaultVoiceId;
    const model = modelId || defaultModelId;
    
    const audioParts = [];
    
    for (const line of lines) {
      if (line.startsWith('[')) {
        audioParts.push({
          type: 'cue',
          content: line
        });
      } else if (line.trim()) {
        const audio = await client.textToSpeech.convert(voice, {
          text: line,
          modelId: model,
          outputFormat: 'mp3_44100_128',
        });
        
        const base64Audio = await streamToBase64(audio);
        audioParts.push({
          type: 'audio',
          content: `data:audio/mp3;base64,${base64Audio}`,
          text: line
        });
      }
    }
    
    res.json({ parts: audioParts });
  } catch (error) {
    console.error('Scene TTS error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'SCENE_TTS_ERROR' });
  }
});

router.post('/sfx', async (req, res) => {
  try {
    const { text, durationSeconds } = req.body;
    const client = getClient(req);
    
    const audio = await client.textToSoundEffects.convert({
      text,
      durationSeconds: durationSeconds || 5
    });
    
    const base64Audio = await streamToBase64(audio);
    
    res.json({ 
      audio: `data:audio/mp3;base64,${base64Audio}`,
      format: 'mp3'
    });
  } catch (error) {
    console.error('SFX error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'SFX_ERROR' });
  }
});

export default router;
