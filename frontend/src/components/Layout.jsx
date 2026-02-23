import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePipelineStore } from '../store/pipelineStore'
import api from '../services/api'
import toast from 'react-hot-toast'

const steps = [
  { id: 'story', label: 'Story', path: '/' },
  { id: 'images', label: 'Images', path: '/images' },
  { id: 'videos', label: 'Videos', path: '/videos' },
  { id: 'audio', label: 'Audio', path: '/audio' },
  { id: 'export', label: 'Export', path: '/export' }
]

const LS_KEYS_KEY = 'cm-api-keys'
const loadKeysFromStorage = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEYS_KEY) || '{}') } catch { return {} }
}
const saveKeysToStorage = (keys) => {
  try { localStorage.setItem(LS_KEYS_KEY, JSON.stringify(keys)) } catch {}
}

function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // On mount: push any localStorage-cached API keys to the backend
  useEffect(() => {
    const stored = loadKeysFromStorage()
    if (Object.values(stored).some(v => v)) {
      api.saveSettings({
        falKey: stored.fal || undefined,
        replicateKey: stored.replicate || undefined,
        geminiKey: stored.gemini || undefined,
        elevenlabsKey: stored.elevenlabs || undefined
      }).catch(() => {})
    }
  }, [])

  const {
    selectedStory,
    selectedImages,
    selectedVideos,
    selectedThumbnail,
    generationState,
    generationPhase,
    imageProgress,
    videoProgress,
    pauseGeneration,
    resumeGeneration,
    stopGeneration,
    resumeImageGeneration,
    resumeVideoGeneration,
    loadProject,
    exportProject,
  } = usePipelineStore()

  const isRunning  = generationState === 'running'
  const isPaused   = generationState === 'paused'
  const isActive   = isRunning || isPaused   // show controls

  const hasPendingImages = imageProgress.pending.length > 0
  const hasPendingVideos = videoProgress.pending.length > 0

  // Progress label shown in header when active
  const progressLabel = (() => {
    if (generationPhase === 'scenePlan') return 'Planning scenes...'
    if (generationPhase === 'images') {
      const done = imageProgress.completed.length
      const total = imageProgress.total
      return `Images ${done}/${total}`
    }
    if (generationPhase === 'videoPrompts') return 'Writing video prompts...'
    if (generationPhase === 'videos') {
      const done = videoProgress.completed.length
      const total = videoProgress.total
      return `Videos ${done}/${total}`
    }
    return null
  })()

  const handleResume = () => {
    if (generationPhase === 'images' && hasPendingImages) {
      resumeImageGeneration()
    } else if (generationPhase === 'videos' && hasPendingVideos) {
      resumeVideoGeneration()
    } else {
      resumeGeneration()
    }
  }

  const currentStepIndex = steps.findIndex(s => s.path === location.pathname)

  const handleSaveProject = () => {
    const project = exportProject()
    const date = new Date().toISOString().split('T')[0]
    const title = selectedStory?.title || 'project'
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30)
    const filename = `${slug}_${date}.json`

    toast.loading('Saving project...', { id: 'save-project' })

    // Serialize off the main thread — large base64 image sets will freeze the
    // tab if JSON.stringify runs synchronously here.
    const worker = new Worker(
      new URL('../workers/jsonSerializer.worker.js', import.meta.url),
      { type: 'module' }
    )
    worker.onmessage = (e) => {
      worker.terminate()
      if (!e.data.ok) {
        toast.error('Failed to save project', { id: 'save-project' })
        return
      }
      try {
        const blob = new Blob([e.data.json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        toast.success('Project saved', { id: 'save-project' })
      } catch {
        toast.error('Failed to save project', { id: 'save-project' })
      }
    }
    worker.onerror = () => {
      worker.terminate()
      toast.error('Failed to save project', { id: 'save-project' })
    }
    worker.postMessage(project)
  }

  const hasProgress = !!(selectedStory || Object.keys(selectedImages || {}).length > 0)

  const getStepState = (index) => {
    if (index === 0) return selectedStory ? 'completed' : currentStepIndex === 0 ? 'active' : 'upcoming'
    if (index === 1) return Object.keys(selectedImages).length > 0 ? 'completed' : currentStepIndex === 1 ? 'active' : 'upcoming'
    if (index === 2) return Object.keys(selectedVideos).length > 0 ? 'completed' : currentStepIndex === 2 ? 'active' : 'upcoming'
    if (index >= 3) return currentStepIndex === index ? 'active' : 'upcoming'
    return 'upcoming'
  }

  const handleStepClick = (index) => {
    if (getStepState(index) === 'completed') navigate(steps[index].path)
  }

  const handleLoadProject = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const project = JSON.parse(text)
      loadProject(project)
      toast.success('Project loaded')

      // Navigate to the furthest completed step in the project
      if (project.tts_script || (project.audio && Object.keys(project.audio?.sceneAudio || {}).length > 0)) {
        navigate('/audio')
      } else if (project.selected_videos && Object.keys(project.selected_videos).length > 0) {
        navigate('/videos')
      } else if (project.selected_images && Object.keys(project.selected_images).length > 0) {
        navigate('/images')
      } else if (project.story) {
        navigate('/')
      }
    } catch {
      toast.error('Invalid project file')
    }

    e.target.value = ''
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 h-14 bg-surface/95 backdrop-blur-sm border-b border-border z-50 flex items-center px-5">

        {/* Left — generation controls */}
        <div className="w-44 flex items-center gap-2 shrink-0">
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-center gap-1.5"
              >
                {isPaused ? (
                  <button
                    onClick={handleResume}
                    title="Resume generation"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={pauseGeneration}
                    title="Pause generation"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-warning/15 text-warning border border-warning/30 text-xs font-medium hover:bg-warning/25 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                    Pause
                  </button>
                )}
                <button
                  onClick={stopGeneration}
                  title="Stop generation"
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h12v12H6z"/>
                  </svg>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress text when generating */}
          {isActive && progressLabel && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-text-secondary hidden xl:block truncate"
            >
              {progressLabel}
            </motion.span>
          )}

          {/* App name when idle */}
          {!isActive && (
            <span className="text-sm font-semibold text-text-primary tracking-tight">ContentMachine</span>
          )}
        </div>

        {/* Centre — step nav */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-1">
            {steps.map((step, index) => {
              const state = getStepState(index)
              const isLast = index === steps.length - 1
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => handleStepClick(index)}
                    disabled={state !== 'completed' && state !== 'active'}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm ${
                      state === 'active'
                        ? 'bg-accent/10 text-accent font-medium cursor-default'
                        : state === 'completed'
                        ? 'hover:bg-surface-raised text-text-secondary hover:text-text-primary cursor-pointer'
                        : 'opacity-35 cursor-default text-text-secondary'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      state === 'completed'
                        ? 'bg-accent text-white'
                        : state === 'active'
                        ? 'bg-accent text-white'
                        : 'bg-surface-raised border border-border text-text-disabled'
                    }`}>
                      {state === 'completed' ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className="hidden lg:block">{step.label}</span>
                    {(step.id === 'audio' || step.id === 'export') && (
                      <span className="text-[9px] text-text-disabled hidden xl:block">(opt)</span>
                    )}
                  </button>

                  {!isLast && (
                    <div className={`w-6 h-px mx-0.5 ${state === 'completed' ? 'bg-accent/40' : 'bg-border'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right — actions */}
        <div className="w-44 flex items-center justify-end gap-1 shrink-0">
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoadProject} className="hidden" />

          {hasProgress && (
            <button
              onClick={handleSaveProject}
              title="Save project"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            title="Load project"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <a
            href="https://github.com/Saganaki22/ContentMachine"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </header>

      <main className="pt-14 min-h-screen">
        {children}
      </main>

      <footer className="flex items-center justify-center py-4 border-t border-border bg-surface/50">
        <a
          href="https://github.com/Saganaki22/ContentMachine"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-text-disabled hover:text-text-secondary transition-colors text-xs"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub
        </a>
      </footer>

      <AnimatePresence>
        {settingsOpen && <SettingsDrawer onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Settings Drawer ─────────────────────────────────────────────────────────

const PROVIDERS = [
  { id: 'fal', name: 'fal.ai', description: 'AI media generation', link: 'https://fal.ai/dashboard/keys' },
  { id: 'replicate', name: 'Replicate', description: 'AI model hosting', link: 'https://replicate.com/account/api-tokens' },
  { id: 'gemini', name: 'Gemini', description: 'Google AI', link: 'https://aistudio.google.com/api-keys' },
  { id: 'elevenlabs', name: 'ElevenLabs', description: 'Voice & audio', link: 'https://elevenlabs.io/app/settings/api-keys' }
]

const FAL_IMAGE_MODELS = [
  { value: 'fal-ai/flux-pro', label: 'Flux Pro' },
  { value: 'fal-ai/flux-2-pro', label: 'Flux 2 Pro' },
  { value: 'fal-ai/flux/schnell', label: 'Flux Schnell (fast)' },
  { value: 'fal-ai/nano-banana-pro', label: 'Nano Banana Pro (Gemini)' },
  { value: 'fal-ai/qwen-image-2512', label: 'Qwen Image 2512' },
  { value: 'fal-ai/z-image/base', label: 'Z-Image Base' },
  { value: 'fal-ai/ideogram/v3', label: 'Ideogram V3' },
  { value: 'fal-ai/stable-diffusion-3.5-large', label: 'SD 3.5 Large' },
]

const REPLICATE_IMAGE_MODELS = [
  { value: 'black-forest-labs/flux-2-pro', label: 'Flux 2 Pro' },
  { value: 'black-forest-labs/flux-1.1-pro', label: 'Flux 1.1 Pro' },
  { value: 'stability-ai/stable-diffusion-3.5-large', label: 'SD 3.5 Large' },
  { value: 'ideogram-ai/ideogram-v3-balanced', label: 'Ideogram V3' },
  { value: 'google/nano-banana-pro', label: 'Nano Banana Pro (Gemini)' },
  { value: 'google/imagen-4', label: 'Imagen 4 (Google · 2K)' },
]

const GEMINI_IMAGE_MODELS = [
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (2K)' },
]

const REPLICATE_VIDEO_MODELS = [
  { value: 'lightricks/ltx-2-pro', label: 'LTX-2 Pro (best quality)' },
  { value: 'lightricks/ltx-2-fast', label: 'LTX-2 Fast (cheaper · 6–20s)' },
  { value: 'kwaivgi/kling-v3-video', label: 'Kling v3 (cinematic · up to 15s)' },
  { value: 'kwaivgi/kling-v2.5-turbo-pro', label: 'Kling 2.5 Turbo Pro (5s or 10s)' },
]

function SettingsDrawer({ onClose }) {
  const stored = loadKeysFromStorage()
  const [keys, setKeys] = useState({
    fal: stored.fal || '',
    replicate: stored.replicate || '',
    gemini: stored.gemini || '',
    elevenlabs: stored.elevenlabs || ''
  })
  const [validationState, setValidationState] = useState({
    fal: 'unknown', replicate: 'unknown', gemini: 'unknown', elevenlabs: 'unknown'
  })
  const [validating, setValidating] = useState({})
  const [saving, setSaving] = useState(false)

  const {
    settings,
    setProvider, setModel,
    setClaudeProvider, setClaudeModel,
    setVideoProvider, setVideoModel,
    setKeysConfigured
  } = usePipelineStore()

  // On open: push any stored keys to the backend and get status
  useEffect(() => {
    const stored = loadKeysFromStorage()
    const hasStored = Object.values(stored).some(v => v)
    if (hasStored) {
      // Push stored keys to backend silently
      api.saveSettings({
        falKey: stored.fal || undefined,
        replicateKey: stored.replicate || undefined,
        geminiKey: stored.gemini || undefined,
        elevenlabsKey: stored.elevenlabs || undefined
      }).catch(() => {})
    }
    api.getSettings().then(status => {
      setValidationState({
        fal: status.fal ? 'valid' : 'unknown',
        replicate: status.replicate ? 'valid' : 'unknown',
        gemini: status.gemini ? 'valid' : 'unknown',
        elevenlabs: status.elevenlabs ? 'valid' : 'unknown'
      })
      setKeysConfigured({
        fal: !!status.fal,
        replicate: !!status.replicate,
        gemini: !!status.gemini,
        elevenlabs: !!status.elevenlabs
      })
    }).catch(() => {})
  }, [])

  const handleKeyChange = (provider, value) => {
    setKeys(prev => ({ ...prev, [provider]: value }))
    if (validationState[provider] !== 'unknown') {
      setValidationState(prev => ({ ...prev, [provider]: 'unknown' }))
    }
  }

  const handleValidate = async (provider) => {
    const key = keys[provider]
    if (!key?.trim()) { toast.error('Enter an API key first'); return }

    setValidating(prev => ({ ...prev, [provider]: true }))
    try {
      const result = await api.validateApiKey(provider, key)
      setValidationState(prev => ({ ...prev, [provider]: result.valid ? 'valid' : 'invalid' }))
      if (result.valid) {
        toast.success(`${PROVIDERS.find(p => p.id === provider)?.name} key validated`)
        setKeysConfigured({ [provider]: true })
        // Save validated key to localStorage
        const stored = loadKeysFromStorage()
        saveKeysToStorage({ ...stored, [provider]: key })
        if (result.warning) toast(result.warning, { icon: '⚠️' })
      } else {
        toast.error(result.error || 'Invalid API key')
      }
    } catch {
      setValidationState(prev => ({ ...prev, [provider]: 'invalid' }))
      toast.error('Validation failed')
    }
    setValidating(prev => ({ ...prev, [provider]: false }))
  }

  const handleClearKey = (provider) => {
    setKeys(prev => ({ ...prev, [provider]: '' }))
    setValidationState(prev => ({ ...prev, [provider]: 'unknown' }))
    setKeysConfigured({ [provider]: false })
    // Clear from localStorage
    const stored = loadKeysFromStorage()
    delete stored[provider]
    saveKeysToStorage(stored)
    // Clear from backend too
    api.saveSettings({ [`${provider}Key`]: '' }).catch(() => {})
    toast.success(`${PROVIDERS.find(p => p.id === provider)?.name} key cleared`)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.saveSettings({
        falKey: keys.fal || undefined,
        replicateKey: keys.replicate || undefined,
        geminiKey: keys.gemini || undefined,
        elevenlabsKey: keys.elevenlabs || undefined
      })
      // Save all non-empty keys to localStorage
      const stored = loadKeysFromStorage()
      const updated = { ...stored }
      if (keys.fal) updated.fal = keys.fal
      if (keys.replicate) updated.replicate = keys.replicate
      if (keys.gemini) updated.gemini = keys.gemini
      if (keys.elevenlabs) updated.elevenlabs = keys.elevenlabs
      saveKeysToStorage(updated)

      const status = await api.getSettings()
      setValidationState({
        fal: status.fal ? 'valid' : 'unknown',
        replicate: status.replicate ? 'valid' : 'unknown',
        gemini: status.gemini ? 'valid' : 'unknown',
        elevenlabs: status.elevenlabs ? 'valid' : 'unknown'
      })
      setKeysConfigured({ fal: !!status.fal, replicate: !!status.replicate, gemini: !!status.gemini, elevenlabs: !!status.elevenlabs })
      // Refresh displayed keys from storage
      const refreshed = loadKeysFromStorage()
      setKeys({ fal: refreshed.fal || '', replicate: refreshed.replicate || '', gemini: refreshed.gemini || '', elevenlabs: refreshed.elevenlabs || '' })
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    }
    setSaving(false)
  }

  const isValid = (p) => validationState[p] === 'valid'

  const StatusDot = ({ provider }) => {
    const state = validationState[provider]
    if (state === 'valid') return (
      <span className="w-2 h-2 rounded-full bg-success shrink-0" />
    )
    if (state === 'invalid') return (
      <span className="w-2 h-2 rounded-full bg-error shrink-0" />
    )
    return <span className="w-2 h-2 rounded-full bg-border shrink-0" />
  }

  const imageModels = settings.imageProvider === 'fal'
    ? FAL_IMAGE_MODELS
    : settings.imageProvider === 'replicate'
    ? REPLICATE_IMAGE_MODELS
    : GEMINI_IMAGE_MODELS

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.22 }}
        className="fixed right-0 top-0 bottom-0 w-[440px] bg-surface border-l border-border z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Settings</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-raised text-text-secondary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-7">

          {/* API Keys */}
          <section>
            <h3 className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-3">API Keys</h3>
            <div className="space-y-3">
              {PROVIDERS.map(provider => (
                <div key={provider.id} className="bg-surface-raised rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                      <StatusDot provider={provider.id} />
                      {provider.name}
                      <span className="text-xs text-text-disabled font-normal">— {provider.description}</span>
                    </label>
                    {isValid(provider.id) && !keys[provider.id] && (
                      <span className="text-xs text-success font-medium">Active</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="password"
                        value={keys[provider.id]}
                        onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && keys[provider.id]?.trim() && handleValidate(provider.id)}
                        placeholder={`Paste ${provider.name} key`}
                        className={`w-full pr-8 text-sm ${validationState[provider.id] === 'invalid' ? 'border-error' : ''}`}
                      />
                      {keys[provider.id] && (
                        <button onClick={() => setKeys(prev => ({ ...prev, [provider.id]: '' }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-secondary">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleValidate(provider.id)}
                      disabled={!keys[provider.id]?.trim() || validating[provider.id]}
                      className="btn-secondary px-3 text-xs whitespace-nowrap disabled:opacity-40"
                    >
                      {validating[provider.id]
                        ? <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        : 'Test'}
                    </button>
                    {isValid(provider.id) && (
                      <button
                        onClick={() => handleClearKey(provider.id)}
                        title="Clear saved key"
                        className="px-2.5 text-xs rounded-lg border border-error/40 text-error hover:bg-error/10 transition-colors whitespace-nowrap"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <a
                    href={provider.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-accent hover:text-accent-hover flex items-center gap-1"
                  >
                    Get {provider.name} API
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* LLM Model */}
          <section>
            <h3 className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-3">LLM Model</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5 bg-surface-raised rounded-lg p-1">
                {[
                  { id: 'fal', label: 'fal.ai' },
                  { id: 'replicate', label: 'Replicate' },
                  { id: 'gemini', label: 'Gemini' }
                ].map(p => (
                  <button key={p.id}
                    onClick={() => setClaudeProvider(p.id)}
                    disabled={!isValid(p.id)}
                    className={`py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40 ${
                      settings.claudeProvider === p.id
                        ? 'bg-surface text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >{p.label}</button>
                ))}
              </div>

              {settings.claudeProvider === 'gemini' && (
                <select value={settings.claudeModel} onChange={e => setClaudeModel(e.target.value)} className="w-full text-sm">
                  <option value="gemini-3-flash">Gemini 3 Flash (Recommended)</option>
                  <option value="gemini-3.1-pro">Gemini 3.1 Pro</option>
                  <option value="gemini-3-pro">Gemini 3 Pro</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                </select>
              )}
              {settings.claudeProvider === 'replicate' && (
                <select value={settings.claudeModel} onChange={e => setClaudeModel(e.target.value)} className="w-full text-sm">
                  <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="google/gemini-3-flash">Gemini 3 Flash</option>
                  <option value="google/gemini-3.1-pro">Gemini 3.1 Pro</option>
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                </select>
              )}
              {settings.claudeProvider === 'fal' && (
                <select value={settings.claudeModel} onChange={e => setClaudeModel(e.target.value)} className="w-full text-sm">
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                </select>
              )}
            </div>
          </section>

          {/* Image Generation */}
          <section>
            <h3 className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-3">Image Generation</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5 bg-surface-raised rounded-lg p-1">
                {[
                  { id: 'fal', label: 'fal.ai' },
                  { id: 'replicate', label: 'Replicate' },
                  { id: 'gemini', label: 'Gemini' }
                ].map(p => (
                  <button key={p.id}
                    onClick={() => setProvider(p.id)}
                    disabled={!isValid(p.id)}
                    className={`py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40 ${
                      settings.imageProvider === p.id
                        ? 'bg-surface text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >{p.label}</button>
                ))}
              </div>

              <select value={settings.imageModel} onChange={e => setModel(e.target.value)} className="w-full text-sm">
                {imageModels.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Video Generation */}
          <section>
            <h3 className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-3">Video Generation</h3>
            <div className="grid grid-cols-2 gap-1.5 bg-surface-raised rounded-lg p-1 mb-2">
              {[
                { id: 'fal', label: 'fal.ai (LTX-2)' },
                { id: 'replicate', label: 'Replicate' }
              ].map(p => (
                <button key={p.id}
                  onClick={() => setVideoProvider(p.id)}
                  disabled={!isValid(p.id)}
                  className={`py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40 ${
                    settings.videoProvider === p.id
                      ? 'bg-surface text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >{p.label}</button>
              ))}
            </div>
            {settings.videoProvider === 'replicate' && (
              <select
                value={settings.videoModel || 'lightricks/ltx-2-pro'}
                onChange={e => setVideoModel(e.target.value)}
                className="w-full text-sm"
              >
                {REPLICATE_VIDEO_MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            )}
          </section>
        </div>

        {/* Save footer */}
        <div className="px-5 py-4 border-t border-border">
          <button onClick={handleSave} disabled={saving} className="w-full btn-primary py-2.5 text-sm font-medium">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </motion.div>
    </>
  )
}

export default Layout
