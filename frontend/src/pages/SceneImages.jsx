import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePipelineStore } from '../store/pipelineStore'
import ImageCard from '../components/ImageCard'
import ImageModal from '../components/ImageModal'
import toast from 'react-hot-toast'

// Animated terminal that streams the scene plan JSON as it arrives
function LivePlanningTerminal({ scenePlan, phase }) {
  const [displayedLines, setDisplayedLines] = useState([])
  const [cursor, setCursor] = useState(true)
  const termRef = useRef(null)

  const phaseLines = {
    scenePlan: [
      '> Analyzing narrative structure...',
      '> Calculating optimal scene count...',
      '> Applying SMART pacing algorithm...',
      '> Assigning durations (6s / 8s / 10s)...',
      '> Writing visual descriptions...',
      '> Configuring mannequin details...',
      '> Building environment specs...',
    ],
    images: [
      '> Scene plan complete ✓',
      '> Generating image prompt variations...',
      '> Applying cinematography vocabulary...',
      '> Mapping continuity requirements...',
      '> Dispatching to image generation API...',
    ]
  }

  const lines = phaseLines[phase] || phaseLines.scenePlan

  useEffect(() => {
    setDisplayedLines([])
    let i = 0
    const interval = setInterval(() => {
      if (lines && i < lines.length) {
        const nextLine = lines[i]
        if (nextLine) {
          setDisplayedLines(prev => [...prev, nextLine])
        }
        i++
      } else {
        clearInterval(interval)
      }
    }, 600)
    return () => clearInterval(interval)
  }, [phase])

  // Blink cursor
  useEffect(() => {
    const t = setInterval(() => setCursor(c => !c), 530)
    return () => clearInterval(t)
  }, [])

  // Show scene plan JSON lines once available
  const jsonLines = scenePlan ? JSON.stringify(scenePlan, null, 2).split('\n').slice(0, 22) : []

  // Only scroll when content actually changes (not on every render)
  const prevLineCount = useRef(0)
  useEffect(() => {
    const currentCount = displayedLines.length + jsonLines.length
    if (currentCount !== prevLineCount.current && termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight
      prevLineCount.current = currentCount
    }
  }, [displayedLines.length, jsonLines.length])

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-xl overflow-hidden border border-border shadow-2xl">
        {/* Title bar */}
        <div className="bg-surface-raised px-4 py-2.5 flex items-center gap-2 border-b border-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-error/70" />
            <div className="w-3 h-3 rounded-full bg-warning/70" />
            <div className="w-3 h-3 rounded-full bg-success/70" />
          </div>
          <span className="text-xs text-text-disabled font-mono ml-2">pipeline — scene-planner</span>
        </div>

        {/* Terminal body */}
        <div
          ref={termRef}
          className="bg-[#0d1117] p-4 h-72 overflow-y-auto font-mono text-xs leading-relaxed"
        >
          {displayedLines.filter(Boolean).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className={line.includes('✓') ? 'text-green-400' : 'text-emerald-300'}
            >
              {line}
            </motion.div>
          ))}

          {jsonLines.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2"
            >
              <div className="text-blue-400 mb-1">&gt; Scene plan received:</div>
              {jsonLines.filter(Boolean).map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="text-slate-400"
                >
                  {line.includes('"scene_id"') || line.includes('"duration_seconds"')
                    ? <span className="text-yellow-300">{line}</span>
                    : line.includes('"visual_description"') || line.includes('"shot_type"')
                    ? <span className="text-purple-300">{line}</span>
                    : line}
                </motion.div>
              ))}
              {jsonLines.length === 22 && (
                <div className="text-slate-500">  ...</div>
              )}
            </motion.div>
          )}

          <span className="text-emerald-400">
            {cursor ? '█' : ' '}
          </span>
        </div>
      </div>
    </div>
  )
}

function SceneImages() {
  const navigate = useNavigate()
  const [selectedModal, setSelectedModal] = useState(null)
  const [regeneratingAll, setRegeneratingAll] = useState(false)

  const {
    selectedStory,
    scenePlan,
    scenePlanLoading,
    scenePlanError,
    scenes,
    images,
    selectedImages,
    imagesLoading,
    imagesError,
    generationState,
    generationPhase,
    imageProgress,
    selectImage,
    regenerateImage,
    resumeImageGeneration,
    retryScenePlan,
    retryImagePrompts,
    fetchScenePlan,
    regenerateAllImages,
  } = usePipelineStore()

  const completedCount = Object.keys(selectedImages).length
  const totalSceneCount = scenes.length
  const allSelected = completedCount === totalSceneCount && totalSceneCount > 0

  const imagesCompleteCount = Object.values(images).filter(img => img?.url && !img?.error).length
  const imagesTotalCount = scenes.length * 4
  const allImagesComplete = imagesTotalCount > 0 && imagesCompleteCount === imagesTotalCount

  // Toast on error states
  useEffect(() => {
    if (scenePlanError) {
      toast.error(`Scene planning failed: ${scenePlanError}`, { id: 'scene-plan-error', duration: 6000 })
    }
  }, [scenePlanError])

  useEffect(() => {
    if (imagesError) {
      toast.error(`Image generation failed: ${imagesError}`, { id: 'images-error', duration: 6000 })
    }
  }, [imagesError])

  // Toast when all images complete
  useEffect(() => {
    if (allImagesComplete) {
      toast.success('All images generated!', { id: 'images-done' })
    }
  }, [allImagesComplete])

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 }
  }

  if (!selectedStory) {
    navigate('/')
    return null
  }

  // ── Scene planning loading screen ──────────────────────────────────────────
  if (scenePlanLoading || (scenes.length === 0 && !scenePlanError && !imagesError && generationState !== 'idle' && generationState !== 'stopped')) {
    return (
      <motion.div
        variants={pageVariants} initial="initial" animate="animate" exit="exit"
        transition={{ duration: 0.25 }}
        className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center p-8 gap-8"
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-lg font-medium text-text-primary">Planning your documentary</span>
          </div>
          <p className="text-sm text-text-secondary">{selectedStory.title}</p>
        </div>

        <LivePlanningTerminal
          scenePlan={scenePlan}
          phase={generationPhase === 'images' ? 'images' : 'scenePlan'}
        />

        <div className="text-center space-y-1">
          <p className="text-xs text-text-disabled">
            {generationPhase === 'scenePlan'
              ? 'AI is designing scene structure and pacing...'
              : 'Generating image prompts for each scene...'}
          </p>
        </div>
      </motion.div>
    )
  }

  // ── Idle + no scenes = generation hasn't started (e.g. store rehydrated but no plan yet)
  if (scenes.length === 0 && generationState === 'idle' && !scenePlanError) {
    return (
      <motion.div
        variants={pageVariants} initial="initial" animate="animate" exit="exit"
        className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-8"
      >
        <div className="text-center max-w-md">
          <p className="text-sm text-text-secondary mb-4">Ready to plan your documentary.</p>
          <button
            onClick={() => fetchScenePlan()}
            className="btn-primary px-6 py-2"
          >
            Start Planning
          </button>
        </div>
      </motion.div>
    )
  }

  // ── Error screen ───────────────────────────────────────────────────────────
  if (scenePlanError || (imagesError && scenes.length === 0)) {
    return (
      <motion.div
        variants={pageVariants} initial="initial" animate="animate" exit="exit"
        className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-8"
      >
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            {scenePlanError ? 'Scene Planning Failed' : 'Image Prompts Failed'}
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            {scenePlanError || imagesError}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={scenePlanError ? retryScenePlan : retryImagePrompts}
              className="btn-primary px-6 py-2"
            >
              Retry
            </button>
            <button onClick={() => navigate('/')} className="btn-ghost px-6 py-2">
              Back to Stories
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  const totalDuration = scenePlan?.total_duration_seconds || 0
  const durationMinutes = Math.floor(totalDuration / 60)
  const durationSeconds = totalDuration % 60

  return (
    <motion.div
      variants={pageVariants} initial="initial" animate="animate" exit="exit"
      transition={{ duration: 0.2 }}
      className="min-h-[calc(100vh-3.5rem)] pb-24"
    >
      {/* Sticky header */}
      <div className="sticky top-14 bg-background/95 backdrop-blur-sm border-b border-border py-3 px-8 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-text-primary">{selectedStory.title}</h1>
            <p className="text-xs text-text-secondary">
              {scenePlan?.total_scenes} scenes · {durationMinutes}m {durationSeconds}s · Select one image per scene
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Progress bar */}
            {imageProgress.total > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 bg-surface-raised rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-accent rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(imageProgress.completed.length / imageProgress.total) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <span className="text-xs text-text-secondary whitespace-nowrap">
                  <span className="text-accent font-medium">{imageProgress.completed.length}</span>
                  <span className="text-text-disabled">/{imageProgress.total}</span>
                </span>
              </div>
            )}

            {generationState === 'paused' && generationPhase === 'images' && (
              <button
                onClick={resumeImageGeneration}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                Resume
              </button>
            )}

            {generationState === 'stopped' && imagesError && (
              <button
                onClick={retryImagePrompts}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 text-error border border-error/20 text-xs font-medium hover:bg-error/20 transition-colors"
              >
                Retry Failed
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scene grid */}
      <div className="max-w-6xl mx-auto p-8 space-y-10">
        {scenes.map((scene) => {
          const planScene = scenePlan?.scenes?.find(s => s.scene_number === scene.scene_number)
          return (
            <div key={scene.scene_number}>
              {/* Scene header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-xs font-bold text-text-secondary">
                    {scene.scene_number}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-text-primary">{scene.scene_title}</span>
                    {planScene && (
                      <span className="ml-2 text-xs text-text-disabled">
                        {planScene.duration_seconds}s · {planScene.shot_type}
                      </span>
                    )}
                  </div>
                </div>
                {selectedImages[scene.scene_number] && (
                  <span className="flex items-center gap-1 text-xs text-success font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Selected
                  </span>
                )}
              </div>

              {/* Visual description */}
              {planScene?.visual_description && (
                <p className="text-xs text-text-disabled mb-3 pl-9 leading-relaxed italic">
                  {planScene.visual_description}
                </p>
              )}

              {/* Image grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pl-9">
                {scene.prompts.map((prompt, idx) => {
                  const key = `${scene.scene_number}_${idx}`
                  return (
                    <ImageCard
                      key={key}
                      imageKey={key}
                      image={images[key]}
                      isLoading={!!imagesLoading[key]}
                      isSelected={selectedImages[scene.scene_number]?.promptIndex === idx}
                      onSelect={() => selectImage(scene.scene_number, idx)}
                      onRegenerate={(newPrompt) => {
                        regenerateImage(scene.scene_number, idx, newPrompt)
                          .catch(err => toast.error(`Regeneration failed: ${err.message}`))
                      }}
                      onViewFull={() => setSelectedModal({ sceneNumber: scene.scene_number, promptIndex: idx })}
                      variationLabel={['Establishing', 'Intimate', 'Detail', 'Atmospheric'][idx] || `v${idx + 1}`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-sm border-t border-border py-4 px-8 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-semibold text-text-primary">{completedCount}</span>
              <span className="text-sm text-text-secondary">/ {totalSceneCount} scenes selected</span>
            </div>
            {!allSelected && completedCount > 0 && (
              <span className="text-xs text-text-disabled">
                {totalSceneCount - completedCount} remaining
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (regeneratingAll) return
                setRegeneratingAll(true)
                try {
                  await regenerateAllImages()
                  toast.success('All images regenerated!')
                } catch (err) {
                  toast.error(`Regeneration failed: ${err.message}`)
                } finally {
                  setRegeneratingAll(false)
                }
              }}
              disabled={regeneratingAll || scenes.length === 0}
              className="btn-secondary px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {regeneratingAll ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  <span>Regenerating...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Regenerate All</span>
                </>
              )}
            </button>
            <button
              onClick={() => navigate('/videos')}
              disabled={!allSelected}
              className="btn-primary px-6 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue to Videos →
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen image modal */}
      <AnimatePresence>
        {selectedModal && (
          <ImageModal
            image={images[`${selectedModal.sceneNumber}_${selectedModal.promptIndex}`]}
            onClose={() => setSelectedModal(null)}
            onRegenerate={(newPrompt) => {
              regenerateImage(selectedModal.sceneNumber, selectedModal.promptIndex, newPrompt)
                .catch(err => toast.error(`Regeneration failed: ${err.message}`))
            }}
            onSelect={() => selectImage(selectedModal.sceneNumber, selectedModal.promptIndex)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default SceneImages
