import { useState } from 'react'

function VideoCard({
  sceneNumber,
  videoPrompt,
  job,
  isSelected,
  onSelect,
  onDeselect,
  onRegenerate,
  onViewFull
}) {
  const [isEditing, setIsEditing] = useState(false)
  // Bug fix: always use full_prompt_string (string), not video_prompt (object)
  const promptText = videoPrompt?.full_prompt_string || ''
  const [editedPrompt, setEditedPrompt] = useState(promptText)

  const handleRegenerate = () => {
    onRegenerate(isEditing ? editedPrompt : null)
    if (isEditing) setIsEditing(false)
  }

  const status      = job?.status || 'pending'
  const isLoading   = status === 'pending'
  const isCompleted = status === 'completed'
  const isFailed    = status === 'failed'

  const handleDownload = () => {
    if (!job?.url) return
    const link = document.createElement('a')
    link.href = job.url
    link.download = `scene-${String(sceneNumber).padStart(2, '0')}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const StatusPill = () => {
    if (isCompleted) return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-success/12 text-success border border-success/20">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Ready
      </span>
    )
    if (isFailed) return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-error/12 text-error border border-error/20">
        <span className="w-1.5 h-1.5 rounded-full bg-error" />
        Failed
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-warning/10 text-warning border border-warning/20">
        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
        Rendering
      </span>
    )
  }

  return (
    <div className={`card overflow-hidden flex flex-col group/card ${isSelected ? 'card-selected' : ''}`}>
      {/* Video preview area */}
      <div
        className="relative aspect-video cursor-pointer overflow-hidden bg-surface-raised"
        onClick={() => isCompleted && onViewFull()}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="absolute inset-0 bg-accent/3 animate-pulse" />
            <div className="relative">
              <div className="w-10 h-10 border-2 border-accent/20 rounded-full" />
              <div className="absolute inset-0 w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span>Generating</span>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-text-secondary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-text-secondary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-text-secondary animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        ) : isFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 gap-2">
            <div className="w-9 h-9 rounded-full bg-error/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs text-error">Generation failed</span>
            <button
              onClick={(e) => { e.stopPropagation(); handleRegenerate() }}
              className="text-xs text-accent hover:text-accent-hover font-medium"
            >
              Retry
            </button>
          </div>
        ) : isCompleted && job?.url ? (
          <>
            <video
              src={job.url}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
              onMouseEnter={e => e.target.play()}
              onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-md">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-text-disabled text-xs">No video</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-primary">Scene {sceneNumber}</span>
            {videoPrompt?.duration_seconds && (
              <span className="text-[10px] text-text-disabled">{videoPrompt.duration_seconds}s</span>
            )}
          </div>
          <StatusPill />
        </div>

        {isEditing ? (
          <div className="space-y-2 flex-1">
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full h-24 text-xs font-mono resize-none"
              placeholder="Edit video prompt..."
            />
            <div className="flex gap-2">
              <button onClick={handleRegenerate} disabled={isLoading}
                className="flex-1 btn-primary py-1.5 text-xs">
                Regenerate
              </button>
              <button onClick={() => setIsEditing(false)} className="btn-ghost py-1.5 text-xs">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Prompt preview */}
            {promptText && (
              <p className="text-xs text-text-secondary font-mono leading-relaxed line-clamp-2 mb-3">
                {promptText}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-1.5 flex-wrap mt-auto">
              {isCompleted && (
                <button
                  onClick={isSelected ? onDeselect : onSelect}
                  className={`flex-1 py-1.5 text-xs rounded-md font-semibold transition-all ${
                    isSelected
                      ? 'bg-accent text-white shadow-sm hover:bg-accent-hover'
                      : 'bg-surface-raised border border-border text-text-secondary hover:border-accent/50 hover:text-accent'
                  }`}
                >
                  {isSelected ? '✓ Selected' : 'Select'}
                </button>
              )}

              {isCompleted && (
                <button
                  onClick={handleDownload}
                  title="Download video"
                  className="btn-ghost py-1.5 px-2.5 text-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              )}

              <button
                onClick={() => setIsEditing(true)}
                disabled={isLoading}
                className="btn-ghost py-1.5 px-2.5 text-xs"
                title="Edit prompt"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              <button
                onClick={handleRegenerate}
                disabled={isLoading}
                className="btn-ghost py-1.5 px-2.5 text-xs"
                title="Regenerate"
              >
                {isLoading ? (
                  <div className="w-3.5 h-3.5 border border-accent border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default VideoCard
