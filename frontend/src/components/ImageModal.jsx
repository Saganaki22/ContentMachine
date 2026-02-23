import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

function ImageModal({ image, onClose, onRegenerate, onSelect }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState(image?.prompt || '')

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSelect = () => {
    onSelect()
    onClose()
  }

  const handleRegenerate = () => {
    onRegenerate(isEditing ? editedPrompt : null)
    setIsEditing(false)
    onClose()
  }

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
          {/* Image */}
          <div className="relative bg-black flex-shrink-0">
            {image?.url && (
              <img src={image.url} alt="" className="max-w-full max-h-[65vh] object-contain mx-auto block" />
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
                  {image?.prompt}
                </p>
                <div className="flex gap-2">
                  {image?.url && (
                    <button onClick={handleSelect} className="btn-primary py-2 px-4 text-sm">
                      Select this image
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
