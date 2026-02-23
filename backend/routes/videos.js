import express from 'express';
import * as fal from '@fal-ai/client';
import Replicate from 'replicate';
const router = express.Router();

const FAST_DURATIONS        = [6, 8, 10, 12, 14, 16, 18, 20];
const PRO_DURATIONS         = [6, 8, 10];
const KLING_TURBO_DURATIONS = [5, 10];

// Kling v3 accepts any integer 3-15
const clampKling = (d) => Math.min(15, Math.max(3, Math.round(d || 5)));
// Kling 2.5 Turbo Pro accepts only 5 or 10
const clampKlingTurbo = (d) => (Math.round(d || 5) <= 7 ? 5 : 10);

const clampDuration = (d, videoModel) => {
  if (videoModel === 'kwaivgi/kling-v3-video')      return clampKling(d);
  if (videoModel === 'kwaivgi/kling-v2.5-turbo-pro') return clampKlingTurbo(d);
  const raw = d || 6;
  const allowed = videoModel === 'lightricks/ltx-2-fast' ? FAST_DURATIONS : PRO_DURATIONS;
  if (allowed.includes(raw)) return raw;
  return allowed.reduce((prev, curr) =>
    Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
  );
};

// Build model-specific Replicate input
const buildReplicateInput = (videoModel, scene, duration, resolution, aspectRatio) => {
  if (videoModel === 'kwaivgi/kling-v3-video') {
    const input = {
      prompt: scene.video_prompt,
      duration,
      mode: resolution === '720p' ? 'standard' : 'pro',
      aspect_ratio: aspectRatio,
      generate_audio: true,
    };
    if (scene.image_url) input.start_image = scene.image_url;
    return input;
  }
  if (videoModel === 'kwaivgi/kling-v2.5-turbo-pro') {
    const input = {
      prompt: scene.video_prompt,
      duration,
      aspect_ratio: aspectRatio,
    };
    if (scene.image_url) input.start_image = scene.image_url;
    return input;
  }
  // LTX-2 Pro / Fast
  const input = {
    prompt: scene.video_prompt,
    duration,
    resolution,
    aspect_ratio: aspectRatio,
    generate_audio: true,
  };
  if (scene.image_url) input.image = scene.image_url;
  return input;
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

// Helper to process in batches of 2
const processInBatches = async (items, batchSize, processor) => {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
};

router.post('/generate', async (req, res) => {
  try {
    const { scenes, provider = 'fal', resolution = '1080p', aspectRatio = '16:9', videoModel = 'lightricks/ltx-2-pro' } = req.body;
    
    if (provider === 'replicate') {
      const replicate = getReplicateClient(req);
      
      const processScene = async (scene) => {
        const duration = clampDuration(scene.duration_seconds, videoModel);
        const input = buildReplicateInput(videoModel, scene, duration, resolution, aspectRatio);
        
        const prediction = await replicate.predictions.create({
          model: videoModel,
          input
        });
        
        return {
          scene_number: scene.scene_number,
          job_id: prediction.id,
          status: 'pending'
        };
      };
      
      // Process 2 videos at a time
      const jobs = await processInBatches(scenes, 2, processScene);
      res.json(jobs);
      
    } else {
      const fal = getFalClient(req);
      
      const processScene = async (scene) => {
        const duration = clampDuration(scene.duration_seconds, videoModel);
        const { request_id } = await fal.queue.submit('fal-ai/ltx-2/image-to-video', {
          input: {
            image_url: scene.image_url,
            prompt: scene.video_prompt,
            duration: duration,
            resolution: resolution,
            aspect_ratio: aspectRatio,
          }
        });
        
        return {
          scene_number: scene.scene_number,
          job_id: request_id,
          status: 'pending'
        };
      };
      
      // Process 2 videos at a time
      const jobs = await processInBatches(scenes, 2, processScene);
      res.json(jobs);
    }
  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'VIDEO_GENERATION_ERROR' });
  }
});

router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { provider = 'fal' } = req.query;
    
    if (provider === 'replicate') {
      const replicate = getReplicateClient(req);
      const prediction = await replicate.predictions.get(jobId);
      
      if (prediction.status === 'succeeded') {
        const out = prediction.output;
        const url = typeof out === 'string' ? out
          : Array.isArray(out) ? (out[0]?.url || out[0])
          : out?.url || null;
        res.json({ status: 'completed', url });
      } else if (prediction.status === 'failed') {
        res.json({ status: 'failed', error: prediction.error || 'Video generation failed' });
      } else {
        res.json({ status: 'pending' });
      }
    } else {
      const fal = getFalClient(req);
      
      const status = await fal.queue.status('fal-ai/ltx-2/image-to-video', {
        requestId: jobId
      });
      
      if (status.status === 'COMPLETED') {
        const result = await fal.queue.result('fal-ai/ltx-2/image-to-video', {
          requestId: jobId
        });
        res.json({ status: 'completed', url: result.video?.url || result.media?.url });
      } else if (status.status === 'FAILED') {
        res.json({ status: 'failed', error: 'Video generation failed' });
      } else {
        res.json({ status: 'pending' });
      }
    }
  } catch (error) {
    console.error('Video status error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'VIDEO_STATUS_ERROR' });
  }
});

router.post('/regenerate', async (req, res) => {
  try {
    const { scene_number, video_prompt, duration_seconds, image_url, provider = 'fal', resolution = '1080p', aspectRatio = '16:9', videoModel = 'lightricks/ltx-2-pro' } = req.body;
    
    const duration = clampDuration(duration_seconds, videoModel);
    
    if (provider === 'replicate') {
      const replicate = getReplicateClient(req);
      
      const sceneForBuilder = { video_prompt, image_url };
      const input = buildReplicateInput(videoModel, sceneForBuilder, duration, resolution, aspectRatio);
      
      const prediction = await replicate.predictions.create({
        model: videoModel,
        input
      });
      
      res.json({
        scene_number,
        job_id: prediction.id,
        status: 'pending'
      });
    } else {
      const fal = getFalClient(req);
      
      const { request_id } = await fal.queue.submit('fal-ai/ltx-2/image-to-video', {
        input: {
          image_url,
          prompt: video_prompt,
          duration: duration,
          resolution: resolution,
          aspect_ratio: aspectRatio,
        }
      });
      
      res.json({
        scene_number,
        job_id: request_id,
        status: 'pending'
      });
    }
  } catch (error) {
    console.error('Video regeneration error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'VIDEO_REGENERATION_ERROR' });
  }
});

export default router;
