import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 180000
})

const exportedApi = {
  getSettings: () => api.get('/settings').then(r => r.data),
  
  saveSettings: (keys) => api.post('/settings', keys).then(r => r.data),
  
  validateApiKey: (provider, key) =>
    api.post('/settings/validate', { provider, key }).then(r => r.data),
  
  getDefaultPrompts: () => api.get('/claude/default-prompts').then(r => r.data),

  generateStories: (topic, maxMinutes, provider = 'fal', model, systemPrompt) => 
    api.post('/claude/stories', { topic, maxMinutes, provider, model, systemPrompt: systemPrompt || undefined }).then(r => r.data),
  
  generateScenePlan: (story, maxMinutes, provider = 'fal', model, systemPrompt, videoModel) =>
    api.post('/claude/scene-planning', { story, maxMinutes, provider, model, systemPrompt: systemPrompt || undefined, videoModel }).then(r => r.data),
  
  generateImagePrompts: (scenePlan, aspectRatio, provider = 'fal', model, systemPrompt) =>
    api.post('/claude/image-prompts', { scenePlan, aspectRatio, provider, model, systemPrompt: systemPrompt || undefined }).then(r => r.data),
  
  generateVideoPrompts: (scenePlan, selectedImages, provider = 'fal', model, systemPrompt) =>
    api.post('/claude/video-prompts', { scenePlan, selectedImages, provider, model, systemPrompt: systemPrompt || undefined }).then(r => r.data),
  
  generateTtsScript: (story, scenePlan, provider = 'fal', model, systemPrompt) =>
    api.post('/claude/tts-script', { story, scenePlan, provider, model, systemPrompt: systemPrompt || undefined }).then(r => r.data),
  
  generateMetadata: (story, scenePlan, ttsScript, provider = 'fal', model, systemPrompt) =>
    api.post('/claude/metadata', { story, scenePlan, ttsScript, provider, model, systemPrompt: systemPrompt || undefined }).then(r => r.data),
  
  generateThumbnailPrompts: (story, selectedTitle, thumbnailConcept, provider = 'fal', model, systemPrompt) =>
    api.post('/claude/thumbnail-prompts', { story, selectedTitle, thumbnailConcept, provider, model, systemPrompt: systemPrompt || undefined }).then(r => r.data),
  
  generateImages: (prompts, provider, model, aspectRatio) => {
    console.log('API generateImages request:', { promptCount: prompts?.length, provider, model, aspectRatio })
    return api.post('/images/generate', { prompts, provider, model, aspectRatio })
      .then(r => {
        console.log('API generateImages response:', r.data)
        return r.data
      })
  },
  
  regenerateImage: (prompt, provider, model, aspectRatio) => {
    console.log('API regenerateImage request:', { provider, model, aspectRatio })
    return api.post('/images/regenerate', { prompt, provider, model, aspectRatio })
      .then(r => {
        console.log('API regenerateImage response:', r.data)
        return r.data
      })
  },
  
  generateVideos: (scenes, provider = 'fal', resolution = '1080p', aspectRatio = '16:9', videoModel) =>
    api.post('/videos/generate', { scenes, provider, resolution, aspectRatio, videoModel }).then(r => r.data),
  
  getVideoStatus: (jobId, provider = 'fal') =>
    api.get(`/videos/status/${jobId}?provider=${provider}`).then(r => r.data),
  
  regenerateVideo: (sceneNumber, videoPrompt, durationSeconds, imageUrl, provider = 'fal', resolution = '1080p', aspectRatio = '16:9', videoModel) =>
    api.post('/videos/regenerate', {
      scene_number: sceneNumber,
      video_prompt: videoPrompt,
      duration_seconds: durationSeconds,
      image_url: imageUrl,
      provider,
      resolution,
      aspectRatio,
      videoModel
    }).then(r => r.data),
  
  generateThumbnails: (prompts, provider, aspectRatio) =>
    api.post('/thumbnail/generate', { prompts, provider, aspectRatio }).then(r => r.data),
  
  regenerateThumbnail: (prompt, provider, aspectRatio) =>
    api.post('/thumbnail/regenerate', { prompt, provider, aspectRatio }).then(r => r.data),
  
  getElevenLabsVoices: () =>
    api.get('/elevenlabs/voices').then(r => r.data),
  
  generateTts: (text, voiceId, modelId) =>
    api.post('/elevenlabs/tts', { text, voiceId, modelId }).then(r => r.data),
  
  generateSceneTts: (lines, voiceId, modelId) =>
    api.post('/elevenlabs/tts/scene', { lines, voiceId, modelId }).then(r => r.data),
  
  generateSfx: (text, durationSeconds) =>
    api.post('/elevenlabs/sfx', { text, durationSeconds }).then(r => r.data),
  
  exportZip: (project) =>
    api.post('/export/zip', project, { responseType: 'blob' }).then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const link = document.createElement('a')
      link.href = url
      const disposition = r.headers['content-disposition']
      let filename = 'project.zip'
      if (disposition) {
        const match = disposition.match(/filename="(.+)"/)
        if (match) filename = match[1]
      }
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    })
}

export default exportedApi
