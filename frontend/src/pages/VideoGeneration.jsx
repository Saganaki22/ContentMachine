import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePipelineStore } from '../store/pipelineStore'
import VideoCard from '../components/VideoCard'
import VideoModal from '../components/VideoModal'
import ExportModal from '../components/ExportModal'
import toast from 'react-hot-toast'
import api from '../services/api'

// Animated terminal for video prompt generation phase
function VideoPromptTerminal({ videoPrompts, settings = {}, videoBatches = [], onRetryBatch }) {
  const [lines, setLines] = useState([])
  const [cursor, setCursor] = useState(true)
  const termRef = useRef(null)

  const modelLabel = settings.videoModel?.split('/').pop() || 'ltx-2-pro'
  const aspect = settings.aspectRatio || '16:9'
  const resolution = settings.videoResolution || '1080p'

  const bootLines = [
    '> Analyzing selected images...',
    `> Model: ${modelLabel}  |  Aspect: ${aspect}  |  Resolution: ${resolution}`,
    '> Reading scene plan durations...',
    '> Matching camera movements to durations...',
    '> Writing motion descriptors...',
    '> Generating continuity notes...',
    '> Composing full_prompt_string fields...',
    '> Validating audio sync points...',
  ]

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Intentional: bootLines is captured at mount time so the animation plays once
  // with the initial settings. Re-running on settings changes would restart mid-animation.
  useEffect(() => {
    setLines([])
    let i = 0
    const interval = setInterval(() => {
      if (i < bootLines.length) {
        setLines(prev => [...prev, bootLines[i]])
        i++
      } else {
        clearInterval(interval)
      }
    }, 700)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setCursor(c => !c), 530)
    return () => clearInterval(t)
  }, [])

  const prevContentCount = useRef(0)
  useEffect(() => {
    const count = lines.length + videoPrompts.length
    if (count !== prevContentCount.current && termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight
      prevContentCount.current = count
    }
  }, [lines.length, videoPrompts.length])

  const promptPreviewLines = videoPrompts.length > 0
    ? videoPrompts.slice(0, 4).flatMap(vp => [
        `  scene_${String(vp.scene_number).padStart(2,'0')}: {`,
        `    duration: ${vp.duration_seconds}s,`,
        `    motion: "${(vp.video_prompt?.camera_motion || '').substring(0, 50)}...",`,
        `  },`,
      ])
    : []

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-xl overflow-hidden border border-border shadow-2xl">
        <div className="bg-surface-raised px-4 py-2.5 flex items-center gap-2 border-b border-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-error/70" />
            <div className="w-3 h-3 rounded-full bg-warning/70" />
            <div className="w-3 h-3 rounded-full bg-success/70" />
          </div>
          <span className="text-xs text-text-disabled font-mono ml-2">pipeline — video-prompt-writer</span>
          <span className="ml-auto text-xs text-text-disabled font-mono">{modelLabel} · {aspect} · {resolution}</span>
        </div>
        <div ref={termRef} className="bg-[#0d1117] p-4 h-64 overflow-y-auto font-mono text-xs leading-relaxed">
          {lines.map((line, i) => {
            const text = typeof line === 'string' ? line : ''
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={text.includes('✓') ? 'text-green-400' : 'text-emerald-300'}
              >
                {text}
              </motion.div>
            )
          })}
          {/* Batch progress */}
          {videoBatches.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
              <div className="text-blue-400 mb-1">&gt; Generating video prompts in batches:</div>
              {videoBatches.map(b => {
                const icon = b.status === 'done' ? '✓' : b.status === 'failed' ? '✗' : b.status === 'running' ? '▶' : '○'
                const colour = b.status === 'done' ? 'text-green-400' : b.status === 'failed' ? 'text-red-400' : b.status === 'running' ? 'text-yellow-300' : 'text-slate-500'
                return (
                  <div key={b.batchIndex} className="flex items-center gap-2">
                    <span className={colour}>
                      {icon} Batch {b.batchIndex + 1}/{videoBatches.length} — scenes {b.sceneNumbers[0]}–{b.sceneNumbers[b.sceneNumbers.length - 1]}
                    </span>
                    {b.status === 'failed' && onRetryBatch && (
                      <button
                        onClick={() => onRetryBatch(b.batchIndex)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-error/20 text-red-400 hover:bg-error/40 transition-colors"
                      >
                        retry
                      </button>
                    )}
                  </div>
                )
              })}
            </motion.div>
          )}
          {promptPreviewLines.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
              <div className="text-blue-400 mb-1">&gt; Video prompts ready:</div>
              {promptPreviewLines.map((line, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.06 }}
                  className="text-slate-400"
                >
                  {line.includes('duration') ? <span className="text-yellow-300">{line}</span>
                    : line.includes('motion') ? <span className="text-purple-300">{line}</span>
                    : line}
                </motion.div>
              ))}
              {videoPrompts.length > 4 && (
                <div className="text-slate-500">  ... +{videoPrompts.length - 4} more scenes</div>
              )}
            </motion.div>
          )}
          <span className="text-emerald-400">{cursor ? '█' : ' '}</span>
        </div>
      </div>
    </div>
  )
}

const VIDEO_SCENES_PER_PAGE = 80

function VideoGeneration() {
  const navigate = useNavigate()
  const [selectedModal, setSelectedModal] = useState(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const initializedRef = useRef(false)
  const pollingActiveRef = useRef(false)   // true while the poll loop is running
  const pollingTimerRef = useRef(null)     // the current setTimeout handle

  const {
    selectedStory,
    scenes,
    selectedImages,
    videoPrompts,
    videoPromptsLoading,
    videoPromptsError,
    videoBatches,
    videoJobs,
    selectedVideos,
    ttsScript,
    ttsLoading,
    ttsError,
    generationState,
    generationPhase,
    videoProgress,
    settings,
    fetchVideoPrompts,
    startVideoGeneration,
    pollVideoStatus,
    selectVideo,
    deselectVideo,
    regenerateVideo,
    fetchTtsScript,
    retryVideoPrompts,
    retryVideoBatch,
    retryTtsScript,
    exportProject,
    clearProject,
    resetGeneration,
    stopGeneration,
    resumeVideoPolling,
  } = usePipelineStore()

  const completedCount = Object.values(videoJobs).filter(j => j.status === 'completed').length
  const failedCount    = Object.values(videoJobs).filter(j => j.status === 'failed').length
  const totalCount     = videoPrompts.length || scenes.length
  const selectedCount  = Object.keys(selectedVideos).length
  const allSelected    = completedCount > 0 && selectedCount >= completedCount
  const progress       = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const allJobsDone    = totalCount > 0 && (completedCount + failedCount) === totalCount

  // Pagination — only active when videoPrompts exceed threshold
  const totalPages     = Math.ceil(videoPrompts.length / VIDEO_SCENES_PER_PAGE)
  const isPaginated    = videoPrompts.length > 80
  const visiblePrompts = isPaginated
    ? videoPrompts.slice(currentPage * VIDEO_SCENES_PER_PAGE, (currentPage + 1) * VIDEO_SCENES_PER_PAGE)
    : videoPrompts

  // Reset to page 0 when a new generation run loads a fresh prompt list
  const firstPromptScene = videoPrompts[0]?.scene_number ?? 0
  useEffect(() => { setCurrentPage(0) }, [firstPromptScene])

  // Toast errors
  useEffect(() => {
    if (videoPromptsError) {
      toast.error(`Video prompts failed: ${videoPromptsError}`, { id: 'vp-error', duration: 6000 })
    }
  }, [videoPromptsError])

  useEffect(() => {
    if (ttsError) {
      toast.error(`Script generation failed: ${ttsError}`, { id: 'tts-error', duration: 5000 })
    }
  }, [ttsError])

  // Initialization
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const init = async () => {
      try {
        // Read videoPromptsLoading from store directly — the closure value captured
        // by this useEffect may be stale if the component re-rendered before the
        // effect ran (React 18 concurrent mode batches renders)
        if (videoPrompts.length === 0 && !usePipelineStore.getState().videoPromptsLoading) {
          const prompts = await fetchVideoPrompts()
          if (prompts?.length) {
            await startVideoGeneration(prompts)
            if (!ttsScript) fetchTtsScript().catch(() => {})
          }
        } else if (videoPrompts.length > 0 && Object.keys(videoJobs).length === 0) {
          // If videos are already selected (loaded from project file), don't regenerate
          if (Object.keys(selectedVideos).length > 0 || completedCount > 0) {
            if (!ttsScript) fetchTtsScript().catch(() => {})
            return
          }
          await startVideoGeneration(videoPrompts)
          if (!ttsScript) fetchTtsScript().catch(() => {})
        } else if (videoPrompts.length > 0 && Object.keys(videoJobs).length > 0) {
          // Jobs exist from a previous run — resume polling for any still-pending jobs
          const hasPending = Object.values(videoJobs).some(j => j.status === 'pending')
          if (hasPending) {
            resumeVideoPolling()
          }
          if (!ttsScript) fetchTtsScript().catch(() => {})
        }
      } catch (error) {
        toast.error(`Failed to start video generation: ${error.message}`)
      }
    }

    init()
  }, [])

  // Single poll loop — runs every 4s, checks ALL pending jobs, stops itself when done
  const startPollLoop = useCallback(() => {
    if (pollingActiveRef.current) return   // already running
    pollingActiveRef.current = true

    const tick = async () => {
      if (!pollingActiveRef.current) return

      const { videoJobs, generationState } = usePipelineStore.getState()

      if (generationState === 'paused' || generationState === 'stopped') {
        pollingActiveRef.current = false
        return
      }

      const pending = Object.entries(videoJobs).filter(
        ([, j]) => j.status === 'pending' && j.jobId
      )

      if (pending.length === 0) {
        pollingActiveRef.current = false
        return
      }

      // Poll in chunks of 20 — enough concurrency for fast throughput without
      // triggering rate limits at 45+ scenes (status endpoint is lightweight)
      const POLL_CHUNK_SIZE = 20
      for (let ci = 0; ci < pending.length; ci += POLL_CHUNK_SIZE) {
        const chunk = pending.slice(ci, ci + POLL_CHUNK_SIZE)
        await Promise.all(chunk.map(async ([sceneNum]) => {
          const result = await usePipelineStore.getState().pollVideoStatus(parseInt(sceneNum))
          if (result?.status === 'completed') {
            toast.success(`Scene ${sceneNum} ready`, { id: `scene-${sceneNum}`, duration: 3000 })
          } else if (result?.status === 'failed') {
            toast.error(`Scene ${sceneNum} failed`, { id: `scene-${sceneNum}-err`, duration: 4000 })
          }
        }))
        // 200ms gap between chunks to spread out API calls
        if (ci + POLL_CHUNK_SIZE < pending.length) {
          await new Promise(r => setTimeout(r, 200))
        }
      }

      // Check again after polling — if nothing left, stop
      const stillPending = Object.values(usePipelineStore.getState().videoJobs)
        .filter(j => j.status === 'pending' && j.jobId)

      if (stillPending.length === 0) {
        pollingActiveRef.current = false
        stopGeneration()
        const jobs = Object.values(usePipelineStore.getState().videoJobs)
        const done = jobs.filter(j => j.status === 'completed').length
        const fail = jobs.filter(j => j.status === 'failed').length
        if (fail === 0) {
          toast.success(`All ${done} videos ready!`, { id: 'all-done' })
        } else {
          toast(`${done} videos ready, ${fail} failed`, { icon: '⚠️', id: 'partial-done' })
        }
        return
      }

      pollingTimerRef.current = setTimeout(tick, 4000)
    }

    tick()
  }, [stopGeneration])

  const stopPollLoop = useCallback(() => {
    pollingActiveRef.current = false
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
  }, [])

  // Start poll loop whenever generation is running for videos
  useEffect(() => {
    if (generationState === 'running' && generationPhase === 'videos') {
      startPollLoop()
    }
    if (generationState === 'paused' || generationState === 'stopped') {
      stopPollLoop()
    }
  }, [generationState, generationPhase])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPollLoop()
  }, [])

  const handleStartFresh = () => {
    if (confirm('This will permanently clear all videos, images, and progress. Are you sure?')) {
      stopPollLoop()
      clearProject()
      resetGeneration()
      initializedRef.current = false  // component will unmount via navigate; reset in case it ever remounts
      navigate('/')
      toast.success('Project cleared')
    }
  }

  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all
      videoPrompts.forEach(vp => deselectVideo(vp.scene_number))
    } else {
      // Select all completed videos
      videoPrompts.forEach(vp => {
        const job = videoJobs[vp.scene_number]
        if (job?.url && job?.status === 'completed') selectVideo(vp.scene_number)
      })
    }
  }

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 }
  }

  // ── Loading state: generating prompts ──────────────────────────────────────
  // Only show the loading terminal while actively fetching. Once fetching stops,
  // fall through to the error screen (empty result) or the main grid (has results).
  if (videoPromptsLoading || (videoPrompts.length === 0 && !videoPromptsError && generationPhase === 'videoPrompts')) {
    return (
      <motion.div
        variants={pageVariants} initial="initial" animate="animate" exit="exit"
        transition={{ duration: 0.25 }}
        className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center p-8 gap-8"
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-lg font-medium text-text-primary">Writing video prompts</span>
          </div>
          <p className="text-sm text-text-secondary">{selectedStory?.title}</p>
        </div>
        <VideoPromptTerminal
          videoPrompts={videoPrompts}
          settings={settings}
          videoBatches={videoBatches || []}
          onRetryBatch={async (batchIndex) => {
            try {
              await retryVideoBatch(batchIndex)
            } catch (err) {
              toast.error(`Batch retry failed: ${err.message}`, { duration: 5000 })
            }
          }}
        />
        <p className="text-xs text-text-disabled">Crafting motion instructions for each scene...</p>
      </motion.div>
    )
  }

  // ── Error: prompts returned empty (no error thrown, but zero scenes) ─────────
  // Treat an empty result the same as a failure — show error + retry button
  if (!videoPromptsLoading && videoPrompts.length === 0 && !videoPromptsError && generationPhase !== 'videoPrompts') {
    return (
      <motion.div
        variants={pageVariants} initial="initial" animate="animate" exit="exit"
        className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-8"
      >
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">No Video Prompts Yet</h2>
          <p className="text-sm text-text-secondary mb-6">
            No video prompts have been generated. If you just loaded a project, go back to Images and proceed from there. Otherwise the AI may have returned an empty response — retrying usually succeeds.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={retryVideoPrompts} className="btn-primary px-6 py-2">Retry</button>
            <button onClick={() => navigate('/images')} className="btn-ghost px-6 py-2">Back to Images</button>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Error: prompts failed ──────────────────────────────────────────────────
  if (videoPromptsError && videoPrompts.length === 0) {
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
          <h2 className="text-lg font-semibold text-text-primary mb-2">Video Prompts Failed</h2>
          <p className="text-sm text-text-secondary mb-6">{videoPromptsError}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={retryVideoPrompts} className="btn-primary px-6 py-2">Retry</button>
            <button onClick={() => navigate('/images')} className="btn-ghost px-6 py-2">Back to Images</button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={pageVariants} initial="initial" animate="animate" exit="exit"
      transition={{ duration: 0.2 }}
      className="min-h-[calc(100vh-3.5rem)] pb-24"
    >
      {/* Sticky header */}
      <div className="sticky top-14 bg-background/95 backdrop-blur-sm border-b border-border py-3 px-8 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-base font-semibold text-text-primary">Video Generation</h1>
              <p className="text-xs text-text-secondary">{selectedStory?.title}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-success font-semibold">{completedCount}</span>
                <span className="text-text-disabled">/</span>
                <span className="text-text-secondary">{totalCount}</span>
                <span className="text-text-disabled text-xs ml-1">videos ready</span>
                {failedCount > 0 && (
                  <span className="text-xs text-error ml-2">· {failedCount} failed</span>
                )}
              </div>

              {generationState === 'stopped' && (
                <button onClick={handleStartFresh}
                  className="py-1 px-3 text-xs rounded-lg border border-error/40 text-error hover:bg-error/10 transition-colors">
                  Start Fresh
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="w-full bg-surface-raised rounded-full h-1.5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: failedCount > 0 && allJobsDone ? 'var(--warning)' : 'var(--accent)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 space-y-8">
        {/* Pagination tabs — only shown when > 80 scenes */}
        {isPaginated && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-disabled mr-1">Page:</span>
            {Array.from({ length: totalPages }, (_, i) => {
              const startScene = i * VIDEO_SCENES_PER_PAGE + 1
              const endScene   = Math.min((i + 1) * VIDEO_SCENES_PER_PAGE, videoPrompts.length)
              const pageCompleted = videoPrompts
                .slice(i * VIDEO_SCENES_PER_PAGE, (i + 1) * VIDEO_SCENES_PER_PAGE)
                .filter(vp => videoJobs[vp.scene_number]?.status === 'completed').length
              const pageTotal = endScene - startScene + 1
              return (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    currentPage === i
                      ? 'bg-accent text-white'
                      : 'bg-surface-raised border border-border text-text-secondary hover:border-accent/50 hover:text-text-primary'
                  }`}
                >
                  <span>Scenes {startScene}–{endScene}</span>
                  {pageCompleted > 0 && (
                    <span className={`text-[10px] px-1 rounded ${currentPage === i ? 'bg-white/20' : 'bg-success/15 text-success'}`}>
                      {pageCompleted}/{pageTotal}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Video cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePrompts.map((vp) => (
            <VideoCard
              key={vp.scene_number}
              sceneNumber={vp.scene_number}
              videoPrompt={vp}
              job={videoJobs[vp.scene_number]}
              isSelected={!!selectedVideos[vp.scene_number]}
              onSelect={() => selectVideo(vp.scene_number)}
              onDeselect={() => deselectVideo(vp.scene_number)}
              onRegenerate={(newPrompt) => {
                regenerateVideo(vp.scene_number, newPrompt).catch(err =>
                  toast.error(`Regeneration failed: ${err.message}`)
                )
              }}
              onViewFull={() => setSelectedModal(vp.scene_number)}
            />
          ))}
        </div>

        {/* Pagination prev/next footer */}
        {isPaginated && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              onClick={() => { setCurrentPage(p => Math.max(0, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              disabled={currentPage === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:border-accent/50 hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <span className="text-xs text-text-disabled">
              Page {currentPage + 1} of {totalPages} · {videoPrompts.length} scenes total
            </span>
            <button
              onClick={() => { setCurrentPage(p => Math.min(totalPages - 1, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              disabled={currentPage === totalPages - 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:border-accent/50 hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Narration Script panel */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Narration Script</h3>
            {ttsError && (
              <button
                onClick={() => retryTtsScript().catch(err => toast.error(err.message))}
                className="text-xs text-accent hover:text-accent-hover"
              >
                Retry script generation
              </button>
            )}
          </div>

          {ttsLoading ? (
            <div className="space-y-2">
              <div className="h-3.5 skeleton rounded w-full" />
              <div className="h-3.5 skeleton rounded w-5/6" />
              <div className="h-3.5 skeleton rounded w-4/6" />
              <div className="h-3.5 skeleton rounded w-full" />
              <div className="h-3.5 skeleton rounded w-3/5" />
            </div>
          ) : ttsError ? (
            <div className="text-sm text-error bg-error/5 border border-error/15 rounded-lg p-3">
              Script generation failed: {ttsError}
            </div>
          ) : ttsScript?.script ? (
            <>
              <textarea
                value={ttsScript.script}
                readOnly
                className="w-full h-56 font-mono text-xs resize-none bg-surface-raised leading-relaxed"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-text-disabled">
                  {ttsScript.word_count} words ·
                  ~{Math.ceil((ttsScript.estimated_duration_seconds || 0) / 60)}m estimated
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(ttsScript.script)
                    toast.success('Script copied')
                  }}
                  className="btn-ghost py-1.5 px-3 text-xs"
                >
                  Copy
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-text-secondary italic">Script will appear here once generated...</p>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-sm border-t border-border py-4 px-8 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-semibold text-text-primary">{selectedCount}</span>
              <span className="text-sm text-text-secondary">/ {totalCount} selected</span>
            </div>
            {completedCount > 0 && (
              <button onClick={handleSelectAll} className="btn-ghost py-1 px-3 text-xs">
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {allSelected ? (
            <div className="flex gap-2">
              <button onClick={() => navigate('/audio')} className="btn-ghost px-4 py-2 text-sm">
                + Audio
              </button>
              <button onClick={() => navigate('/export')} className="btn-secondary px-4 py-2 text-sm">
                Thumbnail & Metadata
              </button>
              <button onClick={() => setShowExportModal(true)} className="btn-primary px-5 py-2 text-sm">
                Export Project
              </button>
            </div>
          ) : (
            <p className="text-xs text-text-disabled">Select all videos to export</p>
          )}
        </div>
      </div>

      {/* Video modal */}
      <AnimatePresence>
        {selectedModal !== null && (
          <VideoModal
            job={videoJobs[selectedModal]}
            videoPrompt={videoPrompts.find(v => v.scene_number === selectedModal)}
            sceneNumber={selectedModal}
            onClose={() => setSelectedModal(null)}
            onRegenerate={() => {
              regenerateVideo(selectedModal).catch(err =>
                toast.error(`Regeneration failed: ${err.message}`)
              )
            }}
          />
        )}
      </AnimatePresence>

      {/* Export modal */}
      <AnimatePresence>
        {showExportModal && (
          <ExportModal onClose={() => setShowExportModal(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}



export default VideoGeneration
