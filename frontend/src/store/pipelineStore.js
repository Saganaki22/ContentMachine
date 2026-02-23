import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

// Convert any image URL to a base64 data URI so it survives in the saved JSON
// even after CDN URLs (fal.ai, Replicate) expire. Gemini already returns base64.
const toBase64DataUri = async (url) => {
  if (!url || url.startsWith('data:')) return url  // already base64
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return url  // fall back to URL if fetch fails
  }
}

export const usePipelineStore = create(
  persist(
    (set, get) => ({
      settings: {
        imageProvider: 'fal',
        imageModel: 'fal-ai/flux-pro',
        claudeProvider: 'fal',
        claudeModel: 'claude-3-5-sonnet',
        videoProvider: 'fal',
        videoModel: 'lightricks/ltx-2-pro',
        videoResolution: '1080p',
        aspectRatio: '16:9',
        keysConfigured: { fal: false, replicate: false, gemini: false, elevenlabs: false }
      },

      generationState: 'idle',   // idle | running | paused | stopped
      generationPhase: null,     // null | 'scenePlan' | 'images' | 'videoPrompts' | 'videos'

      imageProgress: { total: 0, completed: [], pending: [] },
      videoProgress: { total: 0, completed: [], pending: [] },

      topic: '',
      maxMinutes: null,
      stories: [],
      selectedStory: null,
      storiesLoading: false,
      storiesError: null,

      scenePlan: null,
      scenePlanLoading: false,
      scenePlanError: null,

      scenes: [],
      images: {},
      selectedImages: {},
      imagesLoading: {},
      imagesError: null,
      imageBatches: [],        // [{ batchIndex, sceneNumbers, status: 'pending'|'running'|'done'|'failed', error }]

      videoPrompts: [],
      videoPromptsLoading: false,
      videoPromptsError: null,
      videoBatches: [],        // [{ batchIndex, sceneNumbers, status: 'pending'|'running'|'done'|'failed', error }]
      videoJobs: {},
      selectedVideos: {},
      ttsScript: null,
      ttsLoading: false,
      ttsError: null,

      youtubeMetadata: null,
      selectedTitle: null,
      thumbnailPrompts: [],
      thumbnails: {},
      selectedThumbnail: null,
      metadataLoading: false,
      metadataError: null,
      thumbnailLoading: false,

      audio: { sceneAudio: {}, sfxAudio: {} },

      includeThumbnail: true,
      includeMetadata: true,

      // Custom system prompt overrides — empty string = use backend default
      customPrompts: {
        story: '',
        scenePlanning: '',
        imagePrompts: '',
        videoPrompts: '',
        ttsScript: '',
        metadata: '',
        thumbnailPrompts: '',
      },

      // Base character reference images (base64 data URIs) for consistent character generation
      // Users can optionally upload a male and/or female reference figure.
      // These are sent as image_input to the model so it can apply scene-appropriate
      // clothing, accessories, and styling while preserving the character likeness.
      characterImages: {
        male: null,   // base64 data URI or null
        female: null, // base64 data URI or null
      },

      // Optional free-text description of the character style (e.g. "porcelain mannequin",
      // "realistic human", "anime character"). Sent alongside character images so the model
      // knows how to interpret and replicate the reference.
      characterDescription: '',

      // ─── Settings ─────────────────────────────────────────────────────────
      setTopic: (topic) => set({ topic }),
      setMaxMinutes: (maxMinutes) => set({ maxMinutes }),

      setProvider: (provider) => {
        const defaultModels = {
          fal: 'fal-ai/flux-pro',
          replicate: 'black-forest-labs/flux-1.1-pro',
          gemini: 'gemini-3-pro-image-preview'
        }
        set((state) => ({
          settings: {
            ...state.settings,
            imageProvider: provider,
            imageModel: defaultModels[provider] || state.settings.imageModel
          }
        }))
      },

      setModel: (model) => set((state) => ({
        settings: { ...state.settings, imageModel: model }
      })),

      setClaudeProvider: (provider) => {
        const defaultModels = {
          fal: 'claude-3-5-sonnet',
          replicate: 'google/gemini-2.5-flash',
          gemini: 'gemini-3-flash'
        }
        set((state) => ({
          settings: {
            ...state.settings,
            claudeProvider: provider,
            claudeModel: defaultModels[provider] || state.settings.claudeModel
          }
        }))
      },

      setClaudeModel: (model) => set((state) => ({
        settings: { ...state.settings, claudeModel: model }
      })),

      setVideoProvider: (provider) => set((state) => ({
        settings: {
          ...state.settings,
          videoProvider: provider,
          // Reset model to default for the chosen provider
          videoModel: provider === 'replicate' ? 'lightricks/ltx-2-pro' : state.settings.videoModel
        }
      })),

      setVideoModel: (model) => set((state) => ({
        settings: { ...state.settings, videoModel: model }
      })),

      setVideoResolution: (resolution) => set((state) => ({
        settings: { ...state.settings, videoResolution: resolution }
      })),

      setAspectRatio: (ratio) => set((state) => ({
        settings: { ...state.settings, aspectRatio: ratio }
      })),

      setKeysConfigured: (keys) => set((state) => ({
        settings: { ...state.settings, keysConfigured: { ...state.settings.keysConfigured, ...keys } }
      })),

      setCustomPrompt: (key, value) => set((state) => ({
        customPrompts: { ...state.customPrompts, [key]: value }
      })),

      setCharacterImage: (gender, dataUri) => set((state) => ({
        characterImages: { ...state.characterImages, [gender]: dataUri }
      })),

      clearCharacterImage: (gender) => set((state) => ({
        characterImages: { ...state.characterImages, [gender]: null }
      })),

      setCharacterDescription: (description) => set({ characterDescription: description }),

      // ─── Generation control ───────────────────────────────────────────────
      setGenerationState: (generationState) => set({ generationState }),

      pauseGeneration: () => set({ generationState: 'paused' }),

      resumeGeneration: () => set({ generationState: 'running' }),

      stopGeneration: () => set({ generationState: 'stopped' }),

      resetGeneration: () => set({
        generationState: 'idle',
        generationPhase: null,
        imageProgress: { total: 0, completed: [], pending: [] },
        videoProgress: { total: 0, completed: [], pending: [] },
        imagesError: null,
        videoPromptsError: null,
        scenePlanError: null,
        ttsError: null,
        imageBatches: [],
        videoBatches: [],
      }),

      checkShouldStop: () => {
        const state = get()
        return state.generationState === 'paused' || state.generationState === 'stopped'
      },

      // ─── Stories ──────────────────────────────────────────────────────────
      fetchStories: async () => {
        const { topic, maxMinutes, settings } = get()
        set({ storiesLoading: true, storiesError: null })
        try {
          const stories = await api.generateStories(
            topic, maxMinutes, settings.claudeProvider, settings.claudeModel, get().customPrompts.story
          )
          set({ stories, storiesLoading: false })
        } catch (error) {
          set({ storiesError: error.message, storiesLoading: false })
          throw error
        }
      },

      selectStory: (story) => {
        set({ selectedStory: story })
        get().fetchScenePlan(story)
      },

      // ─── Scene Plan ───────────────────────────────────────────────────────
      fetchScenePlan: async (story) => {
        const storyToUse = story || get().selectedStory
        const { maxMinutes, settings } = get()
        if (!storyToUse) return

        set({
          scenePlanLoading: true,
          scenePlanError: null,
          generationState: 'running',
          generationPhase: 'scenePlan'
        })
        try {
          const scenePlan = await api.generateScenePlan(
            storyToUse, maxMinutes, settings.claudeProvider, settings.claudeModel, get().customPrompts.scenePlanning, settings.videoModel
          )
          set({ scenePlan, scenePlanLoading: false })
          get().fetchImagePrompts(scenePlan)
        } catch (error) {
          console.error('Failed to fetch scene plan:', error)
          set({
            scenePlanLoading: false,
            scenePlanError: error.message,
            generationState: 'stopped',
            generationPhase: null
          })
          throw error
        }
      },

      retryScenePlan: () => {
        set({ scenePlanError: null })
        get().fetchScenePlan()
      },

      // ─── Image Prompts & Generation ───────────────────────────────────────
      // How many scenes per LLM batch (keeps output tokens within the 16k limit)
      IMAGE_PROMPT_BATCH_SIZE: 10,

      fetchImagePrompts: async (scenePlan, resumeFromPending = false) => {
        const plan = scenePlan || get().scenePlan
        const { settings, characterImages, characterDescription } = get()
        const charImgList = Object.values(characterImages || {}).filter(Boolean)
        if (!plan) return

        if (!resumeFromPending) {
          set({
            scenes: [],
            images: {},
            selectedImages: {},
            imagesError: null,
            imageBatches: [],
            generationPhase: 'images'
          })
        }

        try {
          // ── Step 1: Generate image prompts from Claude (batched by scene) ──────
        let scenes = get().scenes
        // If resuming but scenes are empty (all batches failed), fall back to full fetch
        if (resumeFromPending && scenes.length === 0) {
          return get().fetchImagePrompts(plan, false)
        }
        if (!resumeFromPending && scenes.length === 0) {
            const planScenes = plan.scenes || []
            const batchSize = get().IMAGE_PROMPT_BATCH_SIZE
            const batches = []
            for (let i = 0; i < planScenes.length; i += batchSize) {
              batches.push(planScenes.slice(i, i + batchSize))
            }

            // Initialise batch status tracking
            const batchStatuses = batches.map((b, i) => ({
              batchIndex: i,
              sceneNumbers: b.map(s => s.scene_number),
              status: 'pending',
              error: null,
            }))
            set({ imageBatches: batchStatuses })

            const allRawScenes = []
            for (let bi = 0; bi < batches.length; bi++) {
              if (get().checkShouldStop()) break

              // Mark batch as running
              set(state => ({
                imageBatches: state.imageBatches.map(b =>
                  b.batchIndex === bi ? { ...b, status: 'running' } : b
                )
              }))

              try {
                const rawScenes = await api.generateImagePrompts(
                  null,
                  settings.aspectRatio,
                  settings.claudeProvider,
                  settings.claudeModel,
                  get().customPrompts.imagePrompts,
                  batches[bi]   // scenesOverride — send just this batch
                )
                allRawScenes.push(...rawScenes)

                set(state => ({
                  imageBatches: state.imageBatches.map(b =>
                    b.batchIndex === bi ? { ...b, status: 'done' } : b
                  )
                }))
              } catch (batchErr) {
                set(state => ({
                  imageBatches: state.imageBatches.map(b =>
                    b.batchIndex === bi ? { ...b, status: 'failed', error: batchErr.message } : b
                  )
                }))
                // Continue to next batch — failed ones can be retried individually
              }

              // Small pause between LLM calls
              if (bi < batches.length - 1) await new Promise(r => setTimeout(r, 500))
            }

            scenes = allRawScenes.map(scene => ({
              scene_number: scene.scene_number,
              scene_title: scene.variations?.[0]?.type || `Scene ${scene.scene_number}`,
              scene_description: scene.variations?.[0]?.prompt?.substring(0, 100) || '',
              prompts: scene.variations?.map(v => v.prompt) || [],
              continuity_checklist: scene.continuity_checklist || []
            }))

            set({ scenes })
          }

          // ── Step 2: Generate the actual images scene-by-scene ─────────────────
          const allPrompts = scenes.flatMap(scene =>
            scene.prompts.map((prompt, idx) => ({
              sceneNumber: scene.scene_number,
              promptIndex: idx,
              prompt
            }))
          )

          const { imageProgress } = get()
          let promptsToProcess = allPrompts

          if (resumeFromPending && imageProgress.pending.length > 0) {
            promptsToProcess = imageProgress.pending
              .map(key => {
                const [sceneNumber, promptIndex] = key.split('_').map(Number)
                return allPrompts.find(p => p.sceneNumber === sceneNumber && p.promptIndex === promptIndex)
              })
              .filter(Boolean)
          } else {
            const existingImages = get().images
            const initialCompleted = Object.keys(existingImages).filter(k => existingImages[k]?.url)
            set({
              imageProgress: {
                total: allPrompts.length,
                completed: initialCompleted,
                pending: allPrompts
                  .map(p => `${p.sceneNumber}_${p.promptIndex}`)
                  .filter(k => !initialCompleted.includes(k))
              }
            })
          }

          // Mark loading state for all pending
          const loadingUpdate = {}
          promptsToProcess.forEach(({ sceneNumber, promptIndex }) => {
            loadingUpdate[`${sceneNumber}_${promptIndex}`] = true
          })
          set({ imagesLoading: loadingUpdate })

          // Group prompts by scene
          const promptsByScene = {}
          promptsToProcess.forEach(p => {
            if (!promptsByScene[p.sceneNumber]) promptsByScene[p.sceneNumber] = []
            promptsByScene[p.sceneNumber].push(p)
          })
          const sceneNumbers = Object.keys(promptsByScene).map(Number).sort((a, b) => a - b)

          for (const sceneNum of sceneNumbers) {
            if (get().checkShouldStop()) {
              const remaining = sceneNumbers
                .slice(sceneNumbers.indexOf(sceneNum))
                .flatMap(s => promptsByScene[s].map(p => `${p.sceneNumber}_${p.promptIndex}`))
              set(state => ({
                imageProgress: { ...state.imageProgress, pending: remaining },
                imagesLoading: {}
              }))
              return
            }

            const scenePrompts = promptsByScene[sceneNum]
            const scenePromptTexts = scenePrompts.map(p => p.prompt)

            try {
              const results = await api.generateImages(
                scenePromptTexts, settings.imageProvider, settings.imageModel, settings.aspectRatio, charImgList, characterDescription
              )

              const base64Urls = await Promise.all(
                results.map(r => r?.url ? toBase64DataUri(r.url) : Promise.resolve(null))
              )

              const imageUpdates = {}
              const completedKeys = []
              scenePrompts.forEach(({ sceneNumber, promptIndex }, idx) => {
                const key = `${sceneNumber}_${promptIndex}`
                const result = results[idx]
                imageUpdates[key] = {
                  url: base64Urls[idx] || result?.url || null,
                  prompt: result?.prompt || scenePromptTexts[idx],
                  error: result?.error || null,
                  loading: false
                }
                completedKeys.push(key)
              })

              set(state => {
                const newLoading = { ...state.imagesLoading }
                completedKeys.forEach(k => delete newLoading[k])
                return {
                  images: { ...state.images, ...imageUpdates },
                  imagesLoading: newLoading,
                  imageProgress: {
                    ...state.imageProgress,
                    completed: [...state.imageProgress.completed, ...completedKeys],
                    pending: state.imageProgress.pending.filter(k => !completedKeys.includes(k))
                  }
                }
              })
            } catch (error) {
              const imageUpdates = {}
              const keys = []
              scenePrompts.forEach(({ sceneNumber, promptIndex, prompt }) => {
                const key = `${sceneNumber}_${promptIndex}`
                keys.push(key)
                imageUpdates[key] = { url: null, prompt, error: error.message, loading: false }
              })
              set(state => {
                const newLoading = { ...state.imagesLoading }
                keys.forEach(k => delete newLoading[k])
                return {
                  images: { ...state.images, ...imageUpdates },
                  imagesLoading: newLoading
                }
              })
            }

            await new Promise(r => setTimeout(r, 800))
          }

          set({ imagesLoading: {} })

        } catch (error) {
          console.error('Failed to fetch image prompts:', error)
          set({
            imagesError: error.message,
            imagesLoading: {},
            generationState: 'stopped'
          })
          throw error
        }
      },

      // Retry a single failed batch (re-runs just those scenes through the LLM + image generation)
      retryImageBatch: async (batchIndex) => {
        const { scenePlan, imageBatches, settings, characterImages, characterDescription } = get()
        const charImgList = Object.values(characterImages || {}).filter(Boolean)
        const batch = imageBatches[batchIndex]
        if (!batch || !scenePlan) return

        const batchScenes = scenePlan.scenes.filter(s => batch.sceneNumbers.includes(s.scene_number))

        if (batchScenes.length === 0) {
          console.warn(`retryImageBatch: no scenes found for batch ${batchIndex} (numbers: ${batch.sceneNumbers})`)
          return
        }

        set(state => ({
          imageBatches: state.imageBatches.map(b =>
            b.batchIndex === batchIndex ? { ...b, status: 'running', error: null } : b
          )
        }))

        try {
          const rawScenes = await api.generateImagePrompts(
            null,
            settings.aspectRatio,
            settings.claudeProvider,
            settings.claudeModel,
            get().customPrompts.imagePrompts,
            batchScenes
          )

          const newSceneData = rawScenes.map(scene => ({
            scene_number: scene.scene_number,
            scene_title: scene.variations?.[0]?.type || `Scene ${scene.scene_number}`,
            scene_description: scene.variations?.[0]?.prompt?.substring(0, 100) || '',
            prompts: scene.variations?.map(v => v.prompt) || [],
            continuity_checklist: scene.continuity_checklist || []
          }))

          // Merge into existing scenes
          set(state => {
            const mergedScenes = [...state.scenes]
            newSceneData.forEach(ns => {
              const idx = mergedScenes.findIndex(s => s.scene_number === ns.scene_number)
              if (idx >= 0) mergedScenes[idx] = ns
              else mergedScenes.push(ns)
            })
            mergedScenes.sort((a, b) => a.scene_number - b.scene_number)
            return {
              scenes: mergedScenes,
              imageBatches: state.imageBatches.map(b =>
                b.batchIndex === batchIndex ? { ...b, status: 'done', error: null } : b
              )
            }
          })

          // Now generate the images for those scenes
          const allPrompts = newSceneData.flatMap(scene =>
            scene.prompts.map((prompt, idx) => ({
              sceneNumber: scene.scene_number,
              promptIndex: idx,
              prompt
            }))
          )

          // Ensure these keys are tracked in imageProgress (they may have been absent
          // if the batch failed before images were ever queued on the first attempt)
          const retryKeys = allPrompts.map(p => `${p.sceneNumber}_${p.promptIndex}`)
          set(state => {
            const existingCompleted = new Set(state.imageProgress.completed)
            const newPendingKeys = retryKeys.filter(k => !existingCompleted.has(k))
            const existingPending = new Set(state.imageProgress.pending)
            const mergedPending = [...existingPending, ...newPendingKeys.filter(k => !existingPending.has(k))]
            // Use the canonical total from scenes store rather than growing Math.max
            const canonicalTotal = get().scenes.reduce((sum, s) => sum + (s.prompts?.length || 0), 0)
            const total = canonicalTotal > 0 ? canonicalTotal : existingCompleted.size + mergedPending.length
            return {
              imageProgress: {
                total,
                completed: state.imageProgress.completed,
                pending: mergedPending
              }
            }
          })

          for (const { sceneNumber, promptIndex, prompt } of allPrompts) {
            const key = `${sceneNumber}_${promptIndex}`
            set(state => ({ imagesLoading: { ...state.imagesLoading, [key]: true } }))
            try {
              const results = await api.generateImages(
                [prompt], settings.imageProvider, settings.imageModel, settings.aspectRatio, charImgList, characterDescription
              )
              const base64Url = results[0]?.url ? await toBase64DataUri(results[0].url) : null
              set(state => {
                const newLoading = { ...state.imagesLoading }
                delete newLoading[key]
                return {
                  images: { ...state.images, [key]: { url: base64Url || results[0]?.url || null, prompt, error: null, loading: false } },
                  imagesLoading: newLoading,
                  imageProgress: {
                    ...state.imageProgress,
                    completed: [...new Set([...state.imageProgress.completed, key])],
                    pending: state.imageProgress.pending.filter(k => k !== key)
                  }
                }
              })
            } catch (err) {
              set(state => {
                const newLoading = { ...state.imagesLoading }
                delete newLoading[key]
                return {
                  images: { ...state.images, [key]: { url: null, prompt, error: err.message, loading: false } },
                  imagesLoading: newLoading,
                  // Remove from pending even on error — it's done (failed), not still waiting
                  imageProgress: {
                    ...state.imageProgress,
                    pending: state.imageProgress.pending.filter(k => k !== key)
                  }
                }
              })
            }
            await new Promise(r => setTimeout(r, 500))
          }
        } catch (err) {
          set(state => ({
            imageBatches: state.imageBatches.map(b =>
              b.batchIndex === batchIndex ? { ...b, status: 'failed', error: err.message } : b
            )
          }))
        }
      },

      retryImagePrompts: () => {
        // Reset generationState to 'running' so checkShouldStop() returns false
        // inside fetchImagePrompts — without this the image loop exits immediately
        set({ imagesError: null, imageBatches: [], generationState: 'running', generationPhase: 'images' })
        get().fetchImagePrompts(null, false)
      },

      resumeImageGeneration: () => {
        const { imageProgress } = get()
        if (imageProgress.pending.length > 0) {
          set({ generationState: 'running', generationPhase: 'images' })
          get().fetchImagePrompts(null, true)
        }
      },

      regenerateImage: async (sceneNumber, promptIndex, newPrompt) => {
        const key = `${sceneNumber}_${promptIndex}`
        const { images, settings, characterImages, characterDescription } = get()
        const charImgList = Object.values(characterImages || {}).filter(Boolean)
        const prompt = newPrompt || images[key]?.prompt
        if (!prompt) return

        set((state) => ({
          imagesLoading: { ...state.imagesLoading, [key]: true }
        }))

        try {
          const result = await api.regenerateImage(
            prompt, settings.imageProvider, settings.imageModel, settings.aspectRatio, charImgList, characterDescription
          )
          const b64url = await toBase64DataUri(result.url)
          set((state) => {
            const updatedImages = {
              ...state.images,
              [key]: { url: b64url, prompt, error: null, loading: false }
            }
            // If this image is currently selected for its scene, update selectedImages too
            const updatedSelectedImages = { ...state.selectedImages }
            const existing = updatedSelectedImages[sceneNumber]
            if (existing && existing.promptIndex === promptIndex) {
              updatedSelectedImages[sceneNumber] = { url: b64url, prompt, promptIndex }
            }
            return {
              images: updatedImages,
              selectedImages: updatedSelectedImages,
              imagesLoading: { ...state.imagesLoading, [key]: false }
            }
          })
        } catch (error) {
          set((state) => ({
            images: {
              ...state.images,
              [key]: { ...state.images[key], error: error.message, loading: false }
            },
            imagesLoading: { ...state.imagesLoading, [key]: false }
          }))
          throw error
        }
      },

      regenerateAllImages: async () => {
        const { scenes, settings, imageProgress, characterImages, characterDescription } = get()
        const charImgList = Object.values(characterImages || {}).filter(Boolean)
        if (!scenes.length) return

        // Build list of all prompts grouped by scene
        const promptsByScene = {}
        scenes.forEach(scene => {
          const prompts = scene.prompts || []
          prompts.forEach((prompt, idx) => {
            if (!promptsByScene[scene.scene_number]) promptsByScene[scene.scene_number] = []
            promptsByScene[scene.scene_number].push({
              sceneNumber: scene.scene_number,
              promptIndex: idx,
              prompt
            })
          })
        })

        const sceneNumbers = Object.keys(promptsByScene).map(Number).sort((a, b) => a - b)

        // Mark all as loading
        const loadingUpdate = {}
        sceneNumbers.forEach(sceneNum => {
          promptsByScene[sceneNum].forEach(({ sceneNumber, promptIndex }) => {
            loadingUpdate[`${sceneNumber}_${promptIndex}`] = true
          })
        })
        set({ imagesLoading: loadingUpdate })

        // Reset progress and set state to running so checkShouldStop() returns false
        const allKeys = sceneNumbers.flatMap(s => 
          promptsByScene[s].map(p => `${p.sceneNumber}_${p.promptIndex}`)
        )
        set({
          imageProgress: { total: allKeys.length, completed: [], pending: allKeys },
          generationState: 'running',
          generationPhase: 'images'
        })

        // Process each scene
        for (const sceneNum of sceneNumbers) {
          if (get().checkShouldStop()) {
            const remaining = sceneNumbers
              .slice(sceneNumbers.indexOf(sceneNum))
              .flatMap(s => promptsByScene[s].map(p => `${p.sceneNumber}_${p.promptIndex}`))
            set(state => ({
              imageProgress: { ...state.imageProgress, pending: remaining },
              imagesLoading: {}
            }))
            return
          }

          const scenePrompts = promptsByScene[sceneNum]
          const scenePromptTexts = scenePrompts.map(p => p.prompt)

          try {
            const results = await api.generateImages(
              scenePromptTexts, settings.imageProvider, settings.imageModel, settings.aspectRatio, charImgList, characterDescription
            )

            const base64Urls = await Promise.all(
              results.map(r => r?.url ? toBase64DataUri(r.url) : Promise.resolve(null))
            )

            const imageUpdates = {}
            const completedKeys = []
            scenePrompts.forEach(({ sceneNumber, promptIndex }, idx) => {
              const key = `${sceneNumber}_${promptIndex}`
              const result = results[idx]
              imageUpdates[key] = {
                url: base64Urls[idx] || result?.url || null,
                prompt: result?.prompt || scenePromptTexts[idx],
                error: result?.error || null,
                loading: false
              }
              completedKeys.push(key)
            })

            set(state => {
              const newLoading = { ...state.imagesLoading }
              completedKeys.forEach(k => delete newLoading[k])
              return {
                images: { ...state.images, ...imageUpdates },
                imagesLoading: newLoading,
                imageProgress: {
                  ...state.imageProgress,
                  completed: [...state.imageProgress.completed, ...completedKeys],
                  pending: state.imageProgress.pending.filter(k => !completedKeys.includes(k))
                }
              }
            })
          } catch (error) {
            const imageUpdates = {}
            const keys = []
            scenePrompts.forEach(({ sceneNumber, promptIndex, prompt }) => {
              const key = `${sceneNumber}_${promptIndex}`
              keys.push(key)
              imageUpdates[key] = { url: null, prompt, error: error.message, loading: false }
            })
            set(state => {
              const newLoading = { ...state.imagesLoading }
              keys.forEach(k => delete newLoading[k])
              return {
                images: { ...state.images, ...imageUpdates },
                imagesLoading: newLoading
              }
            })
          }

          await new Promise(r => setTimeout(r, 800))
        }

        set({ imagesLoading: {} })
      },

      selectImage: (sceneNumber, promptIndex) => {
        const key = `${sceneNumber}_${promptIndex}`
        const { images } = get()
        const image = images[key]
        if (image?.url) {
          set((state) => ({
            selectedImages: {
              ...state.selectedImages,
              [sceneNumber]: { url: image.url, prompt: image.prompt, promptIndex }
            }
          }))
        }
      },

      // ─── Video Prompts ────────────────────────────────────────────────────
      // How many scenes per LLM batch (video prompts are larger than image prompts)
      VIDEO_PROMPT_BATCH_SIZE: 8,

      fetchVideoPrompts: async () => {
        const { scenePlan, selectedImages, settings } = get()
        if (!scenePlan) return

        const selectedImagesArray = Object.entries(selectedImages).map(([sceneNum, img]) => ({
          scene_number: parseInt(sceneNum),
          prompt: img.prompt
          // url intentionally excluded — base64 data would exceed Express body limit
        }))

        const planScenes = scenePlan.scenes || []
        const batchSize = get().VIDEO_PROMPT_BATCH_SIZE
        const batches = []
        for (let i = 0; i < planScenes.length; i += batchSize) {
          batches.push(planScenes.slice(i, i + batchSize))
        }

        const batchStatuses = batches.map((b, i) => ({
          batchIndex: i,
          sceneNumbers: b.map(s => s.scene_number),
          status: 'pending',
          error: null,
        }))

        set({
          videoPromptsLoading: true,
          videoPromptsError: null,
          videoBatches: batchStatuses,
          videoPrompts: [],
          generationPhase: 'videoPrompts'
        })

        try {
          const allRawPrompts = []

          for (let bi = 0; bi < batches.length; bi++) {
            if (get().checkShouldStop()) break

            set(state => ({
              videoBatches: state.videoBatches.map(b =>
                b.batchIndex === bi ? { ...b, status: 'running' } : b
              )
            }))

            try {
              const batchPrompts = await api.generateVideoPrompts(
                null,
                selectedImagesArray,
                settings.claudeProvider,
                settings.claudeModel,
                get().customPrompts.videoPrompts,
                batches[bi]   // scenesOverride — just this batch
              )
              const arr = Array.isArray(batchPrompts) ? batchPrompts : []
              allRawPrompts.push(...arr)

              set(state => ({
                videoBatches: state.videoBatches.map(b =>
                  b.batchIndex === bi ? { ...b, status: 'done' } : b
                )
              }))
            } catch (batchErr) {
              set(state => ({
                videoBatches: state.videoBatches.map(b =>
                  b.batchIndex === bi ? { ...b, status: 'failed', error: batchErr.message } : b
                )
              }))
              // Continue — failed batches can be retried individually
            }

            if (bi < batches.length - 1) await new Promise(r => setTimeout(r, 500))
          }

          const enrichedPrompts = allRawPrompts.map(vp => {
            const sceneFromPlan = planScenes.find(s => s.scene_number === vp.scene_number)
            return {
              ...vp,
              duration_seconds: vp.duration_seconds || sceneFromPlan?.duration_seconds || 6,
              visual_description: sceneFromPlan?.visual_description,
              full_prompt_string: vp.full_prompt_string
                || (typeof vp.video_prompt?.full_prompt_string === 'string' ? vp.video_prompt.full_prompt_string : '')
                || (typeof vp.video_prompt === 'string' ? vp.video_prompt : '')
            }
          })

          set({ videoPrompts: enrichedPrompts, videoPromptsLoading: false })
          return enrichedPrompts
        } catch (error) {
          set({ videoPromptsLoading: false, videoPromptsError: error.message, generationPhase: null })
          throw error
        }
      },

      retryVideoPrompts: () => {
        set({ videoPromptsError: null, videoBatches: [], videoPrompts: [] })
        return get().fetchVideoPrompts()
      },

      retryVideoBatch: async (batchIndex) => {
        const { scenePlan, selectedImages, videoBatches, settings } = get()
        const batch = videoBatches[batchIndex]
        if (!batch || !scenePlan) return

        const batchScenes = scenePlan.scenes.filter(s => batch.sceneNumbers.includes(s.scene_number))
        if (batchScenes.length === 0) {
          console.warn(`retryVideoBatch: no scenes found for batch ${batchIndex}`)
          return
        }

        const selectedImagesArray = Object.entries(selectedImages).map(([sceneNum, img]) => ({
          scene_number: parseInt(sceneNum),
          prompt: img.prompt
        }))

        set(state => ({
          videoBatches: state.videoBatches.map(b =>
            b.batchIndex === batchIndex ? { ...b, status: 'running', error: null } : b
          )
        }))

        try {
          const batchPrompts = await api.generateVideoPrompts(
            null,
            selectedImagesArray,
            settings.claudeProvider,
            settings.claudeModel,
            get().customPrompts.videoPrompts,
            batchScenes
          )
          const arr = Array.isArray(batchPrompts) ? batchPrompts : []

          const enriched = arr.map(vp => {
            const sceneFromPlan = scenePlan.scenes.find(s => s.scene_number === vp.scene_number)
            return {
              ...vp,
              duration_seconds: vp.duration_seconds || sceneFromPlan?.duration_seconds || 6,
              visual_description: sceneFromPlan?.visual_description,
              full_prompt_string: vp.full_prompt_string
                || (typeof vp.video_prompt?.full_prompt_string === 'string' ? vp.video_prompt.full_prompt_string : '')
                || (typeof vp.video_prompt === 'string' ? vp.video_prompt : '')
            }
          })

          // Merge into existing videoPrompts
          set(state => {
            const merged = [...state.videoPrompts]
            enriched.forEach(vp => {
              const idx = merged.findIndex(v => v.scene_number === vp.scene_number)
              if (idx >= 0) merged[idx] = vp
              else merged.push(vp)
            })
            merged.sort((a, b) => a.scene_number - b.scene_number)
            return {
              videoPrompts: merged,
              videoBatches: state.videoBatches.map(b =>
                b.batchIndex === batchIndex ? { ...b, status: 'done', error: null } : b
              )
            }
          })
        } catch (err) {
          set(state => ({
            videoBatches: state.videoBatches.map(b =>
              b.batchIndex === batchIndex ? { ...b, status: 'failed', error: err.message } : b
            )
          }))
          // Don't re-throw — UI already shows the batch error; re-throwing causes unhandled
          // rejections in callers that don't have a try/catch. Consistent with retryImageBatch.
        }
      },

      // ─── Video Generation ─────────────────────────────────────────────────
      startVideoGeneration: async (videoPrompts, resumeFromPending = false) => {
        const { selectedImages, images, settings, videoProgress } = get()
        // Don't snapshot videoJobs here — read it fresh after the async API call
        // to avoid overwriting concurrent store mutations (e.g. regenerateVideo)

        let scenesToProcess = videoPrompts.map(vp => {
          // selectedImages[n].url is stripped from localStorage persist (base64 blobs
          // would blow out the storage limit). Fall back to the images store which
          // retains the full URL/base64 via a separate persist entry.
          const selectedImg = selectedImages[vp.scene_number]
          const imageKey = selectedImg
            ? `${vp.scene_number}_${selectedImg.promptIndex ?? 0}`
            : null
          const image_url = selectedImg?.url
            || (imageKey && images[imageKey]?.url)
            || null
          return {
            scene_number: vp.scene_number,
            video_prompt: vp.full_prompt_string || '',
            duration_seconds: vp.duration_seconds || 6,
            image_url
          }
        })

        if (resumeFromPending && videoProgress.pending.length > 0) {
          scenesToProcess = scenesToProcess.filter(s =>
            videoProgress.pending.includes(String(s.scene_number))
          )
        }

        if (scenesToProcess.length === 0) return []

        const jobs = await api.generateVideos(
          scenesToProcess, settings.videoProvider, settings.videoResolution, settings.aspectRatio, settings.videoModel
        )

        // Use functional updater so we merge into the *current* videoJobs, not a
        // stale snapshot captured before the async API call
        const newEntries = {}
        jobs.forEach(job => {
          if (job.job_id) {  // skip failed sentinels (no job_id)
            newEntries[job.scene_number] = {
              jobId: job.job_id,
              status: job.status,
              url: null,
              error: job.error || null,
              provider: settings.videoProvider,
              falEndpoint: job.fal_endpoint || null,
            }
          }
        })

        if (!resumeFromPending) {
          set(state => {
            const allSceneNumbers = videoPrompts.map(vp => String(vp.scene_number))
            const alreadyCompleted = Object.keys(state.videoJobs).filter(k => state.videoJobs[k]?.status === 'completed')
            return {
              videoJobs: { ...state.videoJobs, ...newEntries },
              generationState: 'running',
              generationPhase: 'videos',
              videoProgress: {
                total: videoPrompts.length,
                completed: alreadyCompleted,
                pending: allSceneNumbers.filter(n => !alreadyCompleted.includes(n))
              }
            }
          })
        } else {
          set(state => ({
            videoJobs: { ...state.videoJobs, ...newEntries },
            generationState: 'running',
            generationPhase: 'videos'
          }))
        }

        return jobs
      },

      // Restore generationState/Phase after a page reload so polling useEffect fires
      resumeVideoPolling: () => {
        set({ generationState: 'running', generationPhase: 'videos' })
      },

      resumeVideoGeneration: async () => {
        const { videoProgress, videoPrompts } = get()
        if (videoProgress.pending.length > 0 && videoPrompts.length > 0) {
          set({ generationState: 'running', generationPhase: 'videos' })
          await get().startVideoGeneration(videoPrompts, true)
        }
      },

      pollVideoStatus: async (sceneNumber) => {
        const { videoJobs } = get()
        const job = videoJobs[sceneNumber]
        if (!job?.jobId) return null

        try {
          const result = await api.getVideoStatus(job.jobId, job.provider || 'fal', job.falEndpoint)

          set((state) => ({
            videoJobs: {
              ...state.videoJobs,
              [sceneNumber]: {
                ...state.videoJobs[sceneNumber],
                status: result.status,
                url: result.url || state.videoJobs[sceneNumber]?.url,
                error: result.error || null
              }
            }
          }))

          if (result.status === 'completed' || result.status === 'failed') {
            set(state => {
              const sceneStr = String(sceneNumber)
              // Track both completed AND failed in the completed set so that
              // progress.completed.length + progress.pending.length === progress.total
              // is always true and the progress bar reaches 100% even with failures.
              const newCompleted = [...new Set([...state.videoProgress.completed, sceneStr])]
              const newPending = state.videoProgress.pending.filter(p => p !== sceneStr)
              return {
                videoProgress: {
                  ...state.videoProgress,
                  completed: newCompleted,
                  pending: newPending
                }
              }
            })
          }

          return result
        } catch (error) {
          console.error('Poll error:', error)
          return { status: 'error', error: error.message }
        }
      },

      selectVideo: (sceneNumber) => {
        const { videoJobs, videoPrompts } = get()
        const job = videoJobs[sceneNumber]
        const vp = videoPrompts.find(v => v.scene_number === sceneNumber)

        if (job?.url) {
          set((state) => ({
            selectedVideos: {
              ...state.selectedVideos,
              [sceneNumber]: {
                url: job.url,
                prompt: vp?.full_prompt_string || '',
                duration: vp?.duration_seconds
              }
            }
          }))
        }
      },

      deselectVideo: (sceneNumber) => {
        set((state) => {
          const { [sceneNumber]: _, ...rest } = state.selectedVideos
          return { selectedVideos: rest }
        })
      },

      regenerateVideo: async (sceneNumber, newPrompt) => {
        const { selectedImages, images, videoPrompts, settings } = get()
        const vp = videoPrompts.find(v => v.scene_number === sceneNumber)
        const prompt = newPrompt || vp?.full_prompt_string || ''

        // selectedImages[sceneNumber].url is stripped from localStorage persist —
        // fall back to the images store which holds the full URL/base64
        const selectedImg = selectedImages[sceneNumber]
        const imageKey = selectedImg
          ? `${sceneNumber}_${selectedImg.promptIndex ?? 0}`
          : null
        const imageUrl = selectedImg?.url
          || (imageKey && images[imageKey]?.url)
          || null

        set((state) => ({
          videoJobs: {
            ...state.videoJobs,
            [sceneNumber]: {
              jobId: null,
              status: 'pending',
              url: null,
              error: null,
              provider: settings.videoProvider
            }
          }
        }))

        try {
          const result = await api.regenerateVideo(
            sceneNumber,
            prompt,
            vp?.duration_seconds || 6,
            imageUrl,
            settings.videoProvider,
            settings.videoResolution,
            settings.aspectRatio,
            settings.videoModel
          )

          set((state) => ({
            videoJobs: {
              ...state.videoJobs,
              [sceneNumber]: {
                jobId: result.job_id,
                status: 'pending',
                url: null,
                error: null,
                provider: settings.videoProvider,
                falEndpoint: result.fal_endpoint || null,
              }
            },
            // Ensure polling useEffect fires
            generationState: 'running',
            generationPhase: 'videos'
          }))

          return result
        } catch (error) {
          set((state) => ({
            videoJobs: {
              ...state.videoJobs,
              [sceneNumber]: {
                ...state.videoJobs[sceneNumber],
                status: 'failed',
                error: error.message
              }
            }
          }))
          throw error
        }
      },

      // ─── TTS Script ───────────────────────────────────────────────────────
      fetchTtsScript: async () => {
        const { selectedStory, scenePlan, settings } = get()
        if (!selectedStory || !scenePlan) return

        set({ ttsLoading: true, ttsError: null })
        try {
          const result = await api.generateTtsScript(
            selectedStory, scenePlan, settings.claudeProvider, settings.claudeModel, get().customPrompts.ttsScript
          )
          set({ ttsScript: result, ttsLoading: false })
          return result
        } catch (error) {
          set({ ttsLoading: false, ttsError: error.message })
          throw error
        }
      },

      retryTtsScript: () => {
        set({ ttsError: null })
        return get().fetchTtsScript()
      },

      // ─── Metadata ─────────────────────────────────────────────────────────
      fetchMetadata: async () => {
        const { selectedStory, scenePlan, ttsScript, settings } = get()
        if (!selectedStory) return

        set({ metadataLoading: true, metadataError: null })
        try {
          const metadata = await api.generateMetadata(
            selectedStory, scenePlan, ttsScript, settings.claudeProvider, settings.claudeModel, get().customPrompts.metadata
          )
          set({ youtubeMetadata: metadata, metadataLoading: false })
          return metadata
        } catch (error) {
          set({ metadataLoading: false, metadataError: error.message })
          throw error
        }
      },

      retryMetadata: () => {
        set({ metadataError: null })
        return get().fetchMetadata()
      },

      setSelectedTitle: (title) => set({ selectedTitle: title }),

      // ─── Thumbnails ───────────────────────────────────────────────────────
      fetchThumbnailPrompts: async () => {
        const { selectedStory, selectedTitle, youtubeMetadata, settings } = get()
        // Fall back to story title when metadata was skipped
        const title = selectedTitle || youtubeMetadata?.titles?.[0] || selectedStory?.title
        if (!selectedStory || !title) return

        set({ thumbnailLoading: true })
        try {
          const result = await api.generateThumbnailPrompts(
            selectedStory, title, youtubeMetadata?.thumbnail_prompt,
            settings.claudeProvider, settings.claudeModel, get().customPrompts.thumbnailPrompts
          )
          set({ thumbnailPrompts: result.prompts || [], thumbnailLoading: false })
          return result.prompts || []
        } catch (error) {
          set({ thumbnailLoading: false })
          throw error
        }
      },

      generateThumbnails: async (provider) => {
        const { thumbnailPrompts, settings } = get()
        if (!thumbnailPrompts.length) return

        const loading = {}
        thumbnailPrompts.forEach((_, i) => {
          loading[i] = { url: null, loading: true, error: null }
        })
        set({ thumbnails: loading })

        try {
          const results = await api.generateThumbnails(thumbnailPrompts, provider, settings.aspectRatio)
          const newThumbnails = {}
          results.forEach((result, i) => {
            newThumbnails[i] = {
              url: result.url || null,
              prompt: result.prompt || thumbnailPrompts[i],
              error: result.error || null,
              loading: false
            }
          })
          set({ thumbnails: newThumbnails })
        } catch (error) {
          // Mark all as failed
          const failed = {}
          thumbnailPrompts.forEach((_, i) => {
            failed[i] = { url: null, prompt: thumbnailPrompts[i], error: error.message, loading: false }
          })
          set({ thumbnails: failed })
          throw error
        }
      },

      regenerateThumbnail: async (index, newPrompt, provider) => {
        set((state) => ({
          thumbnails: {
            ...state.thumbnails,
            [index]: { ...state.thumbnails[index], loading: true, error: null }
          }
        }))

        try {
          const { thumbnails, thumbnailPrompts, settings } = get()
          const prompt = newPrompt || thumbnails[index]?.prompt || thumbnailPrompts[index]
          const result = await api.regenerateThumbnail(prompt, provider, settings.aspectRatio)

          set((state) => ({
            thumbnails: {
              ...state.thumbnails,
              [index]: { url: result.url, prompt, error: null, loading: false }
            }
          }))
        } catch (error) {
          set((state) => ({
            thumbnails: {
              ...state.thumbnails,
              [index]: { ...state.thumbnails[index], error: error.message, loading: false }
            }
          }))
          throw error
        }
      },

      selectThumbnail: (index) => {
        const { thumbnails, selectedThumbnail } = get()
        const thumb = thumbnails[index]
        if (!thumb?.url) return
        // Toggle: if already selected remove it, otherwise add it
        const current = Array.isArray(selectedThumbnail) ? selectedThumbnail : (selectedThumbnail ? [selectedThumbnail] : [])
        const exists = current.find(t => t.index === index)
        if (exists) {
          set({ selectedThumbnail: current.filter(t => t.index !== index) })
        } else {
          set({ selectedThumbnail: [...current, { url: thumb.url, prompt: thumb.prompt, index }] })
        }
      },

      // ─── Metadata editing ─────────────────────────────────────────────────
      updateDescription: (description) => {
        const { youtubeMetadata } = get()
        if (youtubeMetadata) {
          set({ youtubeMetadata: { ...youtubeMetadata, description } })
        }
      },

      updateTags: (tags) => {
        const { youtubeMetadata } = get()
        if (youtubeMetadata) {
          set({ youtubeMetadata: { ...youtubeMetadata, tags } })
        }
      },

      updateChapters: (chapters) => {
        const { youtubeMetadata } = get()
        if (youtubeMetadata) {
          set({ youtubeMetadata: { ...youtubeMetadata, chapters } })
        }
      },

      // ─── Audio ────────────────────────────────────────────────────────────
      setSceneAudio: (sceneId, data) => set((state) => ({
        audio: {
          ...state.audio,
          sceneAudio: { ...state.audio.sceneAudio, [sceneId]: data }
        }
      })),

      setSfxAudio: (cue, data) => set((state) => ({
        audio: {
          ...state.audio,
          sfxAudio: { ...state.audio.sfxAudio, [cue]: data }
        }
      })),

      clearAudio: () => set({ audio: { sceneAudio: {}, sfxAudio: {} } }),

      // ─── Export toggles ───────────────────────────────────────────────────
      setIncludeThumbnail: (value) => set({ includeThumbnail: value }),
      setIncludeMetadata: (value) => set({ includeMetadata: value }),

      // ─── Project load/save ────────────────────────────────────────────────
      loadProject: (project) => {
        if (project.version !== 1) {
          throw new Error('Unsupported project version')
        }

        const selectedVideos = project.selected_videos || {}

        // Reconstruct videoJobs from selected_videos if no jobs are saved.
        // This prevents the init useEffect from thinking generation hasn't run yet
        // and firing a new batch of API requests.
        let videoJobs = project.video_jobs || {}
        if (Object.keys(videoJobs).length === 0 && Object.keys(selectedVideos).length > 0) {
          videoJobs = Object.fromEntries(
            Object.entries(selectedVideos).map(([sceneNum, v]) => [
              sceneNum,
              { jobId: null, status: 'completed', url: v.url, error: null, provider: project.settings?.video_provider || 'replicate' }
            ])
          )
        }

        set({
          topic: project.topic || '',
          maxMinutes: project.max_minutes || null,
          selectedStory: project.story || null,
          scenePlan: project.scene_plan || null,
          scenes: project.scenes || [],
          images: project.images || {},
          selectedImages: project.selected_images || {},
          videoPrompts: project.video_prompts || [],
          videoJobs,
          selectedVideos,
          ttsScript: project.tts_script ? {
            script: project.tts_script,
            scene_breakdown: project.tts_scene_breakdown || null,
            word_count: null,
            estimated_duration_seconds: null
          } : null,
          youtubeMetadata: project.metadata || null,
          selectedTitle: project.metadata?.selected_title || null,
          selectedThumbnail: project.thumbnail || null,
          generationState: 'idle',
          generationPhase: null,
          imageProgress: { total: 0, completed: [], pending: [] },
          videoProgress: { total: 0, completed: [], pending: [] },
          imagesError: null,
          videoPromptsError: null,
          scenePlanError: null,
          ttsError: null,
          metadataError: null,
          settings: {
            ...get().settings,
            // exportProject() serialises settings in snake_case; map back to camelCase
            ...(project.settings ? {
              ...(project.settings.image_provider   ? { imageProvider:   project.settings.image_provider   } : {}),
              ...(project.settings.image_model      ? { imageModel:      project.settings.image_model      } : {}),
              ...(project.settings.claude_provider  ? { claudeProvider:  project.settings.claude_provider  } : {}),
              ...(project.settings.claude_model     ? { claudeModel:     project.settings.claude_model     } : {}),
              ...(project.settings.video_provider   ? { videoProvider:   project.settings.video_provider   } : {}),
              ...(project.settings.video_model      ? { videoModel:      project.settings.video_model      } : {}),
              ...(project.settings.video_resolution ? { videoResolution: project.settings.video_resolution } : {}),
              ...(project.settings.aspect_ratio     ? { aspectRatio:     project.settings.aspect_ratio     } : {}),
            } : {})
          }
        })
      },

      exportProject: () => {
        const state = get()
        return {
          version: 1,
          exported_at: new Date().toISOString(),
          topic: state.topic,
          max_minutes: state.maxMinutes,
          story: state.selectedStory,
          scene_plan: state.scenePlan,
          scenes: state.scenes,
          images: state.images,
          selected_images: state.selectedImages,
          video_prompts: state.videoPrompts,
          video_jobs: state.videoJobs,
          selected_videos: state.selectedVideos,
          tts_script: state.ttsScript?.script,
          tts_scene_breakdown: state.ttsScript?.scene_breakdown,
          audio: state.audio,
          all_thumbnails: Object.values(state.thumbnails).filter(t => t?.url),
          metadata: state.includeMetadata ? {
            selected_title: state.selectedTitle,
            all_titles: state.youtubeMetadata?.titles,
            description: state.youtubeMetadata?.description,
            tags: state.youtubeMetadata?.tags,
            chapters: state.youtubeMetadata?.chapters
          } : null,
          thumbnail: (() => {
            if (!state.includeThumbnail || !state.selectedThumbnail) return null
            const sel = Array.isArray(state.selectedThumbnail) ? state.selectedThumbnail : [state.selectedThumbnail]
            if (!sel.length) return null
            return {
              selected_url: sel[0].url,
              selected_prompt: sel[0].prompt,
              selected_urls: sel.map(t => t.url),
              provider: state.settings.imageProvider
            }
          })(),
          settings: {
            image_provider: state.settings.imageProvider,
            image_model: state.settings.imageModel,
            claude_provider: state.settings.claudeProvider
          }
        }
      },

      clearProject: () => {
        set({
          topic: '',
          maxMinutes: null,
          stories: [],
          selectedStory: null,
          storiesError: null,
          scenePlan: null,
          scenePlanLoading: false,
          scenePlanError: null,
          scenes: [],
          images: {},
          selectedImages: {},
          imagesError: null,
          videoPrompts: [],
          videoPromptsError: null,
          videoBatches: [],
          videoJobs: {},
          selectedVideos: {},
          ttsScript: null,
          ttsError: null,
          youtubeMetadata: null,
          metadataError: null,
          selectedTitle: null,
          thumbnailPrompts: [],
          thumbnails: {},
          selectedThumbnail: null,
          audio: { sceneAudio: {}, sfxAudio: {} },
          generationState: 'idle',
          generationPhase: null,
          imageProgress: { total: 0, completed: [], pending: [] },
          videoProgress: { total: 0, completed: [], pending: [] },
          characterImages: { male: null, female: null },
          characterDescription: '',
        })
      }
    }),
    {
      name: 'content-pipeline-state-v5',
      version: 5,
      partialize: (state) => ({
        settings: state.settings,
        topic: state.topic,
        maxMinutes: state.maxMinutes,
        stories: state.stories,
        selectedStory: state.selectedStory,
        scenePlan: state.scenePlan,
        scenes: state.scenes,
        // images/thumbnails/selectedImages are NOT persisted — base64 blobs blow out localStorage
        // Use project export/import to save them to a file instead
        // Persist only prompt+index from selectedImages (not the base64 URL)
        selectedImages: Object.fromEntries(
          Object.entries(state.selectedImages).map(([k, v]) => [k, { prompt: v.prompt, promptIndex: v.promptIndex }])
        ),
        videoPrompts: state.videoPrompts,
        videoJobs: state.videoJobs,              // persist job IDs so polling can resume
        selectedVideos: state.selectedVideos,
        ttsScript: state.ttsScript,
        youtubeMetadata: state.youtubeMetadata,
        selectedTitle: state.selectedTitle,
        selectedThumbnail: state.selectedThumbnail,
        thumbnailPrompts: state.thumbnailPrompts,
        imageProgress: state.imageProgress,
        videoProgress: state.videoProgress,
        imageBatches: state.imageBatches,
        videoBatches: state.videoBatches,
        customPrompts: state.customPrompts,
        includeThumbnail: state.includeThumbnail,
        includeMetadata: state.includeMetadata,
      })
    }
  )
)
