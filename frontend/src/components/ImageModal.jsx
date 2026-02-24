import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'

// history: array of { url, prompt } oldest-first (from imageHistory[key])
// image:   current/latest { url, prompt, error, loading }
// onSelect(url, prompt): called with the viewed version's data
// onRegenerate(prompt): called with the viewed version's prompt (or edited)
function ImageModal({ image, history = [], onClose, onRegenerate, onSelect }) {
  // Build full version list: history entries + current (latest)
  const allVersions = useMemo(() => {
    const current = image?.url ? [{ url: image.url, prompt: image.prompt }] : []
    return [...history, ...current]
  }, [history, image])

  // Start viewing the latest version
  const [viewIndex, setViewIndex] = useState(allVersions.length - 1)
  const [isEditing, setIsEditing] = useState(false)

  const viewed = allVersions[viewIndex] || { url: image?.url, prompt: image?.prompt }
  const [editedPrompt, setEditedPrompt] = useState(viewed?.prompt || '')

  // Keep editedPrompt in sync when navigating between versions
  useEffect(() => {
    setEditedPrompt(viewed?.prompt || '')
    setIsEditing(false)
  }, [viewIndex])

  // Always start at latest when modal opens
  useEffect(() => {
    setViewIndex(allVersions.length - 1)
  }, [allVersions.length])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft')  setViewIndex(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setViewIndex(i => Math.min(allVersions.length - 1, i + 1))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, allVersions.length])

  const handleSelect = () => {
    onSelect(viewed?.url, viewed?.prompt)
    onClose()
  }

  const handleRegenerate = () => {
    onRegenerate(isEditing ? editedPrompt : viewed?.prompt || null)
    setIsEditing(false)
    onClose()
  }

  const isLatest  = viewIndex === allVersions.length - 1
  const isOldest  = viewIndex === 0
  const total     = allVersions.length
  const versionLabel = total > 1
    ? `Version ${viewIndex + 1} of ${total}${isLatest ? ' (latest)' : ''}`
    : null

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
          className="bg-surface border border-border rounded-xl overflow-hidden max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Image with navigation arrows */}
          <div className="relative bg-black flex-shrink-0">
            {viewed?.url && (
              <img src={viewed.url} alt="" className="max-w-full max-h-[65vh] object-contain mx-auto block" />
            )}

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
          <div className="p-4 border-t border-border flex-shrink-0">
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
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
                <p className="text-xs text-text-secondary font-mono mb-4 whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                  {viewed?.prompt}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {viewed?.url && (
                    <button onClick={handleSelect} className="btn-primary py-2 px-4 text-sm">
                      {isLatest ? 'Select this image' : `Use version ${viewIndex + 1}`}
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

export default ImageModal
