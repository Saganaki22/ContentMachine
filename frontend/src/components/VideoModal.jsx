import { useEffect } from 'react'
import { motion } from 'framer-motion'

function VideoModal({ job, videoPrompt, sceneNumber, onClose, onRegenerate }) {
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleDownload = () => {
    if (!job?.url) return
    const link = document.createElement('a')
    link.href = job.url
    link.download = `scene-${String(sceneNumber).padStart(2, '0')}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Bug fix: use full_prompt_string (string), not video_prompt (object)
  const promptText = videoPrompt?.full_prompt_string || ''

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
          {/* Video */}
          <div className="relative bg-black">
            {job?.url && (
              <video
                src={job.url}
                className="max-w-full max-h-[60vh] mx-auto block"
                controls
                autoPlay
              />
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

          {/* Info */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-text-primary">Scene {sceneNumber}</span>
              <span className="text-xs text-text-disabled">{videoPrompt?.duration_seconds}s</span>
            </div>

            {promptText && (
              <p className="text-xs text-text-secondary font-mono mb-4 whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto">
                {promptText}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={handleDownload} className="btn-secondary py-2 px-4 text-sm">
                Download
              </button>
              <button onClick={() => { onRegenerate(); onClose() }} className="btn-ghost py-2 px-4 text-sm">
                Regenerate
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}

export default VideoModal
