import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

function ImageCard({
  imageKey,
  image,
  isLoading,
  isSelected,
  onSelect,
  onRegenerate,
  onViewFull,
  variationLabel
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState(image?.prompt || '')

  // Keep editedPrompt in sync when image loads/changes
  useEffect(() => {
    if (!isEditing && image?.prompt) {
      setEditedPrompt(image.prompt)
    }
  }, [image?.prompt, isEditing])

  const handleRegenerate = () => {
    onRegenerate(isEditing ? editedPrompt : null)
    if (isEditing) setIsEditing(false)
  }

  const promptText = image?.prompt || ''

  return (
    <div className={`card overflow-hidden flex flex-col group/card ${isSelected ? 'card-selected' : ''}`}>
      {/* Image area */}
      <div
        className="relative aspect-[4/3] cursor-pointer overflow-hidden"
        onClick={() => !isLoading && image?.url && !image?.error && onViewFull()}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-surface-raised">
            {/* Pulsing bg */}
            <div className="absolute inset-0 bg-accent/3 animate-pulse" />
            <div className="relative">
              <div className="w-8 h-8 border-2 border-accent/20 rounded-full" />
              <div className="absolute inset-0 w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
            {variationLabel && (
              <span className="text-[10px] text-text-disabled tracking-wide">{variationLabel}</span>
            )}
          </div>
        ) : image?.error ? (
          <div className="absolute inset-0 bg-surface-raised flex flex-col items-center justify-center p-3 gap-2">
            <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[10px] text-error text-center leading-tight">{image.error.split(':')[0]}</span>
            <button
              onClick={e => { e.stopPropagation(); handleRegenerate() }}
              className="text-[10px] text-accent hover:text-accent-hover font-medium"
            >
              Retry
            </button>
          </div>
        ) : image?.url ? (
          <>
            <img
              src={image.url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-[1.02]"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-200" />

            {/* Variation badge */}
            {variationLabel && (
              <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white/80 font-medium backdrop-blur-sm">
                {variationLabel}
              </div>
            )}

            {/* Selected badge */}
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-md">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            {/* Hover expand icon */}
            <div className="absolute inset-0 flex items-end justify-center pb-3 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span className="text-[9px] text-white font-medium">Expand</span>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-surface-raised flex items-center justify-center">
            <span className="text-text-disabled text-xs">No image</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-2.5 flex flex-col flex-1">
        {isEditing ? (
          <div className="space-y-2 flex-1">
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full h-20 text-xs font-mono resize-none"
              placeholder="Edit prompt..."
              autoFocus
            />
            <div className="flex gap-1.5">
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
              <p className="text-[10px] text-text-disabled font-mono leading-relaxed line-clamp-2 mb-2">
                {promptText}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-1 mt-auto">
              {image?.url && !image?.error && (
                <button
                  onClick={onSelect}
                  className={`flex-1 py-1.5 text-[10px] rounded-md font-semibold transition-all ${
                    isSelected
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-surface-raised border border-border text-text-secondary hover:border-accent/50 hover:text-accent'
                  }`}
                >
                  {isSelected ? '✓ Selected' : 'Select'}
                </button>
              )}
              <button
                onClick={() => setIsEditing(true)}
                disabled={isLoading}
                className="btn-ghost py-1.5 px-2 text-[10px]"
                title="Edit prompt"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={handleRegenerate}
                disabled={isLoading}
                className="btn-ghost py-1.5 px-2 text-[10px]"
                title="Regenerate"
              >
                {isLoading ? (
                  <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

export default ImageCard
