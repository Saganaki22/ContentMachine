import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'

// job:      current videoJobs[sceneNumber] — { url, status, error, ... }
// history:  videoHistory[sceneNumber] — array of { url, prompt } oldest-first
// videoPrompt: the videoPrompts entry for this scene
// onRegenerate(newPrompt): triggers regen with optional edited prompt
// onSelectVersion(url): called when user selects a historical version as active
function VideoModal({ job, history = [], videoPrompt, sceneNumber, onClose, onRegenerate, onSelectVersion }) {
  const promptText = videoPrompt?.full_prompt_string || ''

  // Build full version list: history + current (if completed)
  const allVersions = useMemo(() => {
    const current = job?.url ? [{ url: job.url, prompt: promptText }] : []
    return [...history, ...current]
  }, [history, job?.url, promptText])

  const [viewIndex, setViewIndex] = useState(allVersions.length - 1)
  const [isEditing, setIsEditing] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState(promptText)

  useEffect(() => {
    setViewIndex(allVersions.length - 1)
  }, [allVersions.length])

  useEffect(() => {
    const viewed = allVersions[viewIndex]
    setEditedPrompt(viewed?.prompt || promptText)
    setIsEditing(false)
  }, [viewIndex])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft')  setViewIndex(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setViewIndex(i => Math.min(allVersions.length - 1, i + 1))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, allVersions.length])

  const viewed   = allVersions[viewIndex]
  const isLatest = viewIndex === allVersions.length - 1
  const isOldest = viewIndex === 0
  const total    = allVersions.length
  const versionLabel = total > 1
    ? `Version ${viewIndex + 1} of ${total}${isLatest ? ' (latest)' : ''}`
    : null

  const handleDownload = () => {
    const url = viewed?.url || job?.url
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `scene-${String(sceneNumber).padStart(2, '0')}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleRegenerate = () => {
    onRegenerate(isEditing ? editedPrompt : null)
    setIsEditing(false)
    onClose()
  }

  const handleSelectVersion = () => {
    if (viewed?.url && onSelectVersion) onSelectVersion(viewed.url)
    onClose()
  }

  const isPending = job?.status === 'pending' || job?.status === 'processing'

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-8"
        onClick={onClose}
      >
        <div
          className="bg-surface border border-border rounded-xl overflow-hidden max-w-[80vw] max-h-[90vh] flex flex-col shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Video / pending state */}
          <div className="relative bg-black">
            {viewed?.url ? (
              <video
                key={viewed.url}
                src={viewed.url}
                className="max-w-full max-h-[60vh] mx-auto block"
                controls
                autoPlay
              />
            ) : isPending ? (
              <div className="max-h-[60vh] h-64 flex items-center justify-center text-text-disabled text-sm">
                Generating new version...
              </div>
            ) : null}

            {/* Left arrow */}
            {total > 1 && !isOldest && (
              <button
                onClick={() => setViewIndex(i => i - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Right arrow */}
            {total > 1 && !isLatest && (
              <button
                onClick={() => setViewIndex(i => i + 1)}
                className="absolute right-12 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Version badge */}
            {versionLabel && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full">
                {versionLabel}
              </div>
            )}

            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Info & actions */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-text-primary">Scene {sceneNumber}</span>
              <span className="text-xs text-text-disabled">{videoPrompt?.duration_seconds}s</span>
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editedPrompt}
                  onChange={e => setEditedPrompt(e.target.value)}
                  className="w-full h-28 text-xs font-mono resize-none"
                  placeholder="Edit prompt..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleRegenerate} className="btn-primary py-2 px-4 text-sm">
                    Regenerate with edit
                  </button>
                  <button onClick={() => setIsEditing(false)} className="btn-ghost py-2 px-4 text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {(viewed?.prompt || promptText) && (
                  <p className="text-xs text-text-secondary font-mono mb-4 whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto">
                    {viewed?.prompt || promptText}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  {viewed?.url && (
                    <button onClick={handleDownload} className="btn-secondary py-2 px-4 text-sm">
                      Download
                    </button>
                  )}
                  {/* Only show "Use this version" if viewing a non-latest version */}
                  {viewed?.url && !isLatest && (
                    <button onClick={handleSelectVersion} className="btn-primary py-2 px-4 text-sm">
                      Use version {viewIndex + 1}
                    </button>
                  )}
                  <button onClick={() => setIsEditing(true)} className="btn-secondary py-2 px-4 text-sm">
                    Edit & Regenerate
                  </button>
                  <button onClick={handleRegenerate} className="btn-ghost py-2 px-4 text-sm">
                    Regenerate
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}

export default VideoModal
