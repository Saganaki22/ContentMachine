import express from 'express';
import * as fal from '@fal-ai/client';
import Replicate from 'replicate';
const router = express.Router();

const PRO_DURATIONS         = [6, 8, 10];
const KLING_TURBO_DURATIONS = [5, 10];

// Kling v3 accepts any integer 3-15
const clampKling = (d) => Math.min(15, Math.max(3, Math.round(d || 5)));
// Kling 2.5 Turbo Pro accepts only 5 or 10
// Split at 7.5: d < 7.5 → 5, d >= 7.5 → 10 (correct nearest-neighbour)
const clampKlingTurbo = (d) => ((d || 5) < 7.5 ? 5 : 10);
// LTX-2 Fast accepts any even integer 6-20 (2s steps)
const clampFast = (d) => {
  const clamped = Math.min(20, Math.max(6, Math.round((d || 6) / 2) * 2));
  return clamped;
};

const clampDuration = (d, videoModel) => {
  if (videoModel === 'kwaivgi/kling-v3-video')       return clampKling(d);
  if (videoModel === 'kwaivgi/kling-v2.5-turbo-pro') return clampKlingTurbo(d);
  if (videoModel === 'lightricks/ltx-2-fast')        return clampFast(d);
  // LTX-2 Pro
  const raw = d || 6;
  if (PRO_DURATIONS.includes(raw)) return raw;
  return PRO_DURATIONS.reduce((prev, curr) =>
    Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
  );
};

// Build model-specific fal.ai input
const buildFalInput = (videoModel, scene, duration, resolution, aspectRatio) => {
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
      generate_audio: true,
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
  if (scene.image_url) input.image_url = scene.image_url;
  return input;
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
      generate_audio: true,
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

// Helper to process in batches of N, with per-item error isolation.
// A failed item returns { scene_number, error } instead of throwing, so one bad
// scene never prevents the rest of the batch from being submitted.
const processInBatches = async (items, batchSize, processor) => {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          return await processor(item);
        } catch (err) {
          console.error(`processInBatches: scene ${item.scene_number} failed:`, err.message);
          // Return a shape compatible with the frontend jobs array; no job_id means
          // startVideoGeneration will skip this entry (job_id guard in newEntries loop)
          return { scene_number: item.scene_number, job_id: null, status: 'failed', error: err.message };
        }
      })
    );
    results.push(...batchResults);
  }
  return results;
};

// Map fal model IDs to their fal.ai endpoint paths
const FAL_ENDPOINT = {
  'lightricks/ltx-2-fast': 'fal-ai/ltx-2-fast/image-to-video',
  'lightricks/ltx-2-pro':  'fal-ai/ltx-2/image-to-video',
};
const getFalEndpoint = (videoModel) =>
  FAL_ENDPOINT[videoModel] || 'fal-ai/ltx-2/image-to-video';

router.post('/generate', async (req, res) => {
  try {
    const { scenes, provider = 'fal', resolution = '1080p', aspectRatio = '16:9', videoModel = 'lightricks/ltx-2-pro' } = req.body;

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({ error: true, message: 'scenes array is required and must be non-empty', code: 'MISSING_SCENES' });
    }

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
      const falEndpoint = getFalEndpoint(videoModel);
      
      const processScene = async (scene) => {
        const duration = clampDuration(scene.duration_seconds, videoModel);
        const input = buildFalInput(videoModel, scene, duration, resolution, aspectRatio);
        const { request_id } = await fal.queue.submit(falEndpoint, { input });
        
        return {
          scene_number: scene.scene_number,
          job_id: request_id,
          status: 'pending',
          fal_endpoint: falEndpoint,
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
    const { provider = 'fal', falEndpoint } = req.query;
    
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
      // Use the endpoint that was used to submit the job (passed as query param)
      const endpoint = falEndpoint || 'fal-ai/ltx-2/image-to-video';
      
      const status = await fal.queue.status(endpoint, {
        requestId: jobId
      });
      
      if (status.status === 'COMPLETED') {
        // Wrap result fetch separately — status and result are two non-atomic calls
        try {
          const result = await fal.queue.result(endpoint, { requestId: jobId });
          const videoUrl = result.video?.url
            || result.media?.url
            || result.output?.url
            || (typeof result.url === 'string' ? result.url : null)
            || null;
          res.json({ status: 'completed', url: videoUrl });
        } catch (resultErr) {
          console.error('fal result fetch failed after COMPLETED status:', resultErr);
          // Return pending so the frontend retries next poll cycle
          res.json({ status: 'pending' });
        }
      } else if (status.status === 'FAILED') {
        const errorDetail = status.error || status.logs || 'Video generation failed';
        res.json({ status: 'failed', error: errorDetail });
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
      const falEndpoint = getFalEndpoint(videoModel);
      
      const sceneForBuilder = { video_prompt, image_url };
      const falInput = buildFalInput(videoModel, sceneForBuilder, duration, resolution, aspectRatio);
      const { request_id } = await fal.queue.submit(falEndpoint, { input: falInput });
      
      res.json({
        scene_number,
        job_id: request_id,
        status: 'pending',
        fal_endpoint: falEndpoint,
      });
    }
  } catch (error) {
    console.error('Video regeneration error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'VIDEO_REGENERATION_ERROR' });
  }
});

export default router;
