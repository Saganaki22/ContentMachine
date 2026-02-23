import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePipelineStore } from '../store/pipelineStore'
import api from '../services/api'
import toast from 'react-hot-toast'

function AudioGeneration() {
  const navigate = useNavigate()
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)
  const [voicesLoading, setVoicesLoading] = useState(false)
  // Track per-item loading instead of a global boolean to avoid blocking
  const [itemLoading, setItemLoading] = useState({})
  const audioRefs = useRef({})

  const {
    selectedStory,
    scenePlan,
    ttsScript,
    settings,
    audio,
    setSceneAudio,
    setSfxAudio
  } = usePipelineStore()

  const hasElevenLabs = settings.keysConfigured?.elevenlabs
  const sceneAudio = audio.sceneAudio || {}
  const sfxAudio   = audio.sfxAudio   || {}

  useEffect(() => {
    if (hasElevenLabs) loadVoices()
  }, [hasElevenLabs])

  const loadVoices = async () => {
    setVoicesLoading(true)
    try {
      const voiceList = await api.getElevenLabsVoices()
      setVoices(voiceList)
      if (voiceList.length > 0) setSelectedVoice(voiceList[0].id)
    } catch (error) {
      toast.error('Failed to load voices')
      console.error('Voices error:', error)
    }
    setVoicesLoading(false)
  }

  const setLoading = (id, value) => setItemLoading(prev => ({ ...prev, [id]: value }))

  const handleGenerateSceneAudio = async (sceneId, lines) => {
    if (!selectedVoice) { toast.error('Select a voice first'); return }
    if (itemLoading[sceneId]) return

    setLoading(sceneId, true)
    setSceneAudio(sceneId, { loading: true })

    try {
      const result = await api.generateSceneTts(lines, selectedVoice)
      setSceneAudio(sceneId, { parts: result.parts, loading: false })
      toast.success(`Audio ready for ${sceneId}`, { id: `audio-${sceneId}` })
    } catch (error) {
      setSceneAudio(sceneId, { error: error.message, loading: false })
      toast.error(`Audio failed for ${sceneId}: ${error.message}`)
    }
    setLoading(sceneId, false)
  }

  const handleGenerateSfx = async (cue) => {
    if (itemLoading[cue]) return

    setLoading(cue, true)
    setSfxAudio(cue, { loading: true })

    try {
      const sfxPrompt = cue.replace('[SFX:', '').replace(']', '').replace(/_/g, ' ').toLowerCase()
      const result = await api.generateSfx(sfxPrompt, 3)
      setSfxAudio(cue, { audio: result.audio, loading: false })
      toast.success('Sound effect ready', { id: `sfx-${cue}` })
    } catch (error) {
      setSfxAudio(cue, { error: error.message, loading: false })
      toast.error(`SFX failed: ${error.message}`)
    }
    setLoading(cue, false)
  }

  const handlePlayAudio = (audioData, id) => {
    // Stop any currently playing audio for this id
    if (audioRefs.current[id]) {
      audioRefs.current[id].pause()
      audioRefs.current[id].currentTime = 0
    }
    const audio = new Audio(audioData)
    audioRefs.current[id] = audio
    audio.play().catch(err => toast.error(`Playback failed: ${err.message}`))
  }

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 }
  }

  if (!selectedStory || !scenePlan) {
    navigate('/')
    return null
  }

  const uniqueSfxCues = [...new Set(
    ttsScript?.scene_breakdown?.flatMap(s => (s.lines || []).filter(l => l.startsWith('[SFX:'))) || []
  )]

  const generatedSceneCount = Object.values(sceneAudio).filter(a => a?.parts).length
  const totalScenes = ttsScript?.scene_breakdown?.length || 0
  const generatedSfxCount = Object.values(sfxAudio).filter(a => a?.audio).length

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
            <h1 className="text-base font-semibold text-text-primary">Audio Generation</h1>
            <p className="text-xs text-text-secondary">Optional — Generate narration with ElevenLabs</p>
          </div>
          {totalScenes > 0 && (
            <div className="text-xs text-text-secondary">
              <span className="text-accent font-medium">{generatedSceneCount}</span>
              <span className="text-text-disabled">/{totalScenes} scenes narrated</span>
              {uniqueSfxCues.length > 0 && (
                <span className="ml-3">
                  <span className="text-accent font-medium">{generatedSfxCount}</span>
                  <span className="text-text-disabled">/{uniqueSfxCues.length} SFX</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 space-y-6">
        {!hasElevenLabs ? (
          /* No ElevenLabs key */
          <div className="bg-surface border border-border rounded-xl p-10 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-surface-raised flex items-center justify-center">
              <svg className="w-7 h-7 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-2">ElevenLabs Not Configured</h3>
            <p className="text-sm text-text-secondary mb-5">
              Add your ElevenLabs API key in Settings to generate narration and sound effects.
            </p>
            <button onClick={() => navigate('/export')} className="btn-secondary px-6 py-2 text-sm">
              Skip — Continue to Export
            </button>
          </div>
        ) : (
          <>
            {/* Voice selection */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Voice</h3>
              {voicesLoading ? (
                <div className="h-9 skeleton rounded-lg w-full" />
              ) : voices.length === 0 ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-text-secondary">No voices loaded.</p>
                  <button onClick={loadVoices} className="btn-secondary py-1.5 px-3 text-xs">Reload</button>
                </div>
              ) : (
                <select
                  value={selectedVoice || ''}
                  onChange={e => setSelectedVoice(e.target.value)}
                  className="w-full text-sm"
                >
                  {voices.map(voice => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}{voice.labels?.accent ? ` (${voice.labels.accent})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Scene narration */}
            {ttsScript?.scene_breakdown && (
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-text-primary">Scene Narration</h3>
                  <button
                    onClick={async () => {
                      const scenes = ttsScript.scene_breakdown
                      for (const scene of scenes) {
                        if (!sceneAudio[scene.scene_id]?.parts) {
                          await handleGenerateSceneAudio(scene.scene_id, scene.lines)
                        }
                      }
                    }}
                    disabled={!selectedVoice || voicesLoading}
                    className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                  >
                    Generate All
                  </button>
                </div>

                <div className="space-y-3">
                  {ttsScript.scene_breakdown.map((scene, idx) => {
                    const audioState = sceneAudio[scene.scene_id]
                    const spokenLines = (scene.lines || []).filter(l => !l.startsWith('['))
                    const isItemLoading = itemLoading[scene.scene_id] || audioState?.loading
                    const id = scene.scene_id || `scene-${idx}`

                    return (
                      <div key={id} className="flex gap-3 p-3 border border-border rounded-lg bg-surface-raised/50">
                        <div className="w-10 h-10 rounded-lg bg-surface-raised border border-border flex items-center justify-center shrink-0 text-xs font-bold text-text-secondary">
                          {idx + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-text-primary">{scene.scene_id}</span>
                            <span className="text-[10px] text-text-disabled">{scene.duration}s · {scene.spoken_word_count || spokenLines.join(' ').split(/\s+/).length} words</span>
                          </div>

                          <p className="text-[10px] text-text-disabled font-mono mb-2 leading-relaxed line-clamp-2">
                            {spokenLines.join(' ')}
                          </p>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleGenerateSceneAudio(scene.scene_id, scene.lines)}
                              disabled={isItemLoading || !selectedVoice}
                              className="btn-secondary py-1 px-2.5 text-[10px] disabled:opacity-40"
                            >
                              {isItemLoading ? (
                                <span className="flex items-center gap-1">
                                  <div className="w-2.5 h-2.5 border border-accent border-t-transparent rounded-full animate-spin" />
                                  Generating...
                                </span>
                              ) : audioState?.parts ? 'Regenerate' : 'Generate'}
                            </button>

                            {audioState?.parts && (
                              <button
                                onClick={() => {
                                  const audioParts = audioState.parts.filter(p => p.type === 'audio')
                                  if (audioParts.length > 0) handlePlayAudio(audioParts[0].content, id)
                                }}
                                className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover font-medium"
                              >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                                Play
                              </button>
                            )}

                            {audioState?.parts && (
                              <span className="text-[10px] text-success">✓ Ready</span>
                            )}

                            {audioState?.error && (
                              <span className="text-[10px] text-error">{audioState.error.split(':')[0]}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Sound effects */}
            {uniqueSfxCues.length > 0 && (
              <div className="bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">Sound Effects</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                   {uniqueSfxCues.map((cue, idx) => {
                     const sfxState = sfxAudio[cue]
                     const cueName = cue.replace('[SFX:', '').replace(']', '').replace(/_/g, ' ')
                     const isItemLoading = itemLoading[cue] || sfxState?.loading

                     return (
                       <div key={idx} className="border border-border rounded-lg p-3 bg-surface-raised/50">
                         <p className="text-[10px] font-semibold text-text-primary mb-2 leading-tight">{cueName}</p>
                         <div className="flex gap-1.5">
                           <button
                             onClick={() => handleGenerateSfx(cue)}
                             disabled={isItemLoading}
                             className="flex-1 btn-secondary py-1 text-[10px] disabled:opacity-40 flex items-center justify-center gap-1"
                           >
                             {isItemLoading ? (
                               <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                             ) : sfxState?.audio ? (
                               <>
                                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                 </svg>
                                 Redo
                               </>
                             ) : 'Generate'}
                           </button>
                           {sfxState?.audio && (
                             <button
                               onClick={() => handlePlayAudio(sfxState.audio, `sfx-${idx}`)}
                               className="btn-secondary py-1 px-2 text-[10px] flex items-center justify-center"
                               title="Play"
                             >
                               <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                 <path d="M8 5v14l11-7z"/>
                               </svg>
                             </button>
                           )}
                         </div>
                         {sfxState?.error && (
                           <p className="text-[9px] text-error mt-1 leading-tight">{sfxState.error.split(':')[0]}</p>
                         )}
                       </div>
                     )
                   })}
                 </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-sm border-t border-border py-4 px-8 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-end gap-3">
          <button onClick={() => navigate('/export')} className="btn-ghost px-5 py-2 text-sm">
            Skip
          </button>
          <button onClick={() => navigate('/export')} className="btn-primary px-6 py-2 text-sm">
            Continue to Export →
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default AudioGeneration
