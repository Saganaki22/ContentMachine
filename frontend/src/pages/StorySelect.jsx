import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePipelineStore } from '../store/pipelineStore'
import api from '../services/api'
import toast from 'react-hot-toast'

const exampleTopics = [
  { label: 'The 1972 Andes plane crash', sub: 'Survival · 1972' },
  { label: 'The 2010 Chile mine rescue', sub: 'Rescue · 2010' },
  { label: 'The Great Escape from Stalag Luft III', sub: 'WWII · 1944' },
  { label: 'The disappearance of the Mary Celeste', sub: 'Mystery · 1872' },
  { label: 'Operation Anthropoid — killing Heydrich', sub: 'WWII · 1942' },
  { label: 'The Radium Girls factory poisoning', sub: 'True crime · 1920s' },
  { label: 'Ernest Shackleton\'s Endurance expedition', sub: 'Survival · 1915' },
  { label: 'The Dyatlov Pass incident', sub: 'Mystery · 1959' },
  { label: 'The Alcatraz escape of 1962', sub: 'Prison break · 1962' },
  { label: 'The 1980 MGM Grand Hotel fire', sub: 'Disaster · 1980' },
]

const PROMPT_STAGES = [
  { key: 'story',           label: 'Story Selection',    desc: 'How the LLM picks and frames historical stories from your topic' },
  { key: 'scenePlanning',   label: 'Scene Planning',      desc: 'How scenes are structured, paced, and shot-listed' },
  { key: 'imagePrompts',    label: 'Image Prompts',       desc: 'The visual style rules and prompt formula for scene images' },
  { key: 'videoPrompts',    label: 'Video Prompts',       desc: 'Camera movement and motion instructions for video generation' },
  { key: 'ttsScript',       label: 'Narration Script',    desc: 'Tone, pacing, and style rules for the documentary voiceover' },
  { key: 'metadata',        label: 'YouTube Metadata',    desc: 'How titles, descriptions, tags, and chapters are written' },
  { key: 'thumbnailPrompts',label: 'Thumbnail Prompts',   desc: 'Creative direction rules for YouTube thumbnail generation' },
]

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', sub: 'YouTube / Landscape' },
  { value: '9:16', label: '9:16', sub: 'TikTok / Reels' },
]

// Animated typing effect for the loading messages
function TypingMessage({ messages }) {
  const [index, setIndex] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [charIdx, setCharIdx] = useState(0)

  useEffect(() => {
    setDisplayed('')
    setCharIdx(0)
  }, [index])

  useEffect(() => {
    const msg = messages[index]
    if (charIdx < msg.length) {
      const t = setTimeout(() => {
        setDisplayed(msg.substring(0, charIdx + 1))
        setCharIdx(c => c + 1)
      }, 28)
      return () => clearTimeout(t)
    } else {
      // Pause then move to next message
      const t = setTimeout(() => {
        setIndex(i => (i + 1) % messages.length)
      }, 2200)
      return () => clearTimeout(t)
    }
  }, [charIdx, index, messages])

  return (
    <span className="text-text-secondary">
      {displayed}
      <span className="animate-pulse text-accent">|</span>
    </span>
  )
}

const loadingMessages = [
  'Searching historical archives...',
  'Cross-referencing verified sources...',
  'Identifying compelling narrative beats...',
  'Selecting dramatic story structures...',
  'Verifying documented facts...',
]

function StorySelect() {
  const navigate = useNavigate()
  const {
    topic, setTopic,
    maxMinutes, setMaxMinutes,
    fetchStories,
    stories,
    storiesLoading,
    storiesError,
    selectStory,
    clearProject,
    settings,
    setAspectRatio,
    customPrompts,
    setCustomPrompt,
  } = usePipelineStore()

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [defaultPrompts, setDefaultPrompts] = useState({})
  const [loadingDefaults, setLoadingDefaults] = useState(false)
  const defaultsLoadedRef = useRef(false)

  const handleToggleAdvanced = async () => {
    setAdvancedOpen(o => !o)
    if (!defaultsLoadedRef.current) {
      defaultsLoadedRef.current = true
      setLoadingDefaults(true)
      try {
        const defaults = await api.getDefaultPrompts()
        setDefaultPrompts(defaults)
        // Pre-fill any stage that hasn't been customised yet
        PROMPT_STAGES.forEach(({ key }) => {
          if (!customPrompts[key]) setCustomPrompt(key, defaults[key] || '')
        })
      } catch {
        toast.error('Could not load default prompts')
      }
      setLoadingDefaults(false)
    }
  }

  const handleResetPrompt = (key) => {
    setCustomPrompt(key, defaultPrompts[key] || '')
    toast.success('Reset to default')
  }

  const handleFindStories = async () => {
    if (!topic.trim()) {
      toast.error('Enter a story topic first')
      return
    }
    // errors are handled by storiesError state below — no toast needed here
    fetchStories().catch(() => {})
  }

  const handleSelectStory = (story) => {
    selectStory(story)
    navigate('/images')
  }

  const handleReset = () => {
    clearProject()
  }

  const pageVariants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (storiesLoading) {
    return (
      <motion.div
        variants={pageVariants} initial="initial" animate="animate" exit="exit"
        transition={{ duration: 0.25 }}
        className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center p-8 gap-10"
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Finding your story</h2>
          <div className="text-sm h-5">
            <TypingMessage messages={loadingMessages} />
          </div>
        </div>

        {/* Research terminal */}
        <div className="w-full max-w-lg">
          <div className="rounded-xl overflow-hidden border border-border shadow-xl">
            <div className="bg-surface-raised px-4 py-2.5 flex items-center gap-2 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-error/70" />
                <div className="w-3 h-3 rounded-full bg-warning/70" />
                <div className="w-3 h-3 rounded-full bg-success/70" />
              </div>
              <span className="text-xs text-text-disabled font-mono ml-2">pipeline — story-researcher</span>
            </div>
            <div className="bg-[#0d1117] p-4 h-48 font-mono text-xs">
              <ResearchStream topic={topic} />
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Story list ────────────────────────────────────────────────────────────
  if (stories.length > 0) {
    return (
      <motion.div
        variants={pageVariants} initial="initial" animate="animate" exit="exit"
        transition={{ duration: 0.2 }}
        className="min-h-[calc(100vh-3.5rem)] p-8"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Choose a Story</h2>
              <p className="text-sm text-text-secondary mt-0.5">Click any story to begin production</p>
            </div>
            <button
              onClick={handleReset}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              New search
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stories.map((story, index) => (
              <motion.button
                key={story.id || index}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.3 }}
                onClick={() => handleSelectStory(story)}
                className="card p-5 text-left hover:border-accent/60 group transition-all duration-200 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5 hover:bg-accent/[0.02]"
              >
                <div className="flex items-start justify-between mb-2.5">
                  <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors leading-snug pr-3">
                    {story.title}
                  </h3>
                  <span className="text-[10px] text-text-disabled bg-surface-raised border border-border px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                    {story.era}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-text-disabled mb-3">
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {story.location}
                </div>

                <p className="text-xs text-text-secondary mb-3 leading-relaxed line-clamp-2">
                  {story.summary}
                </p>

                <div className="p-2.5 bg-accent/5 border border-accent/10 rounded-lg text-xs text-text-secondary leading-relaxed">
                  <span className="text-accent font-medium">Why this works: </span>
                  {story.why_compelling}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-text-disabled">~{story.estimated_scenes} scenes</span>
                  <div className="flex flex-wrap gap-1">
                    {story.narrative_beats?.slice(0, 3).map(beat => (
                      <span key={beat} className="text-[9px] bg-surface-raised border border-border px-1.5 py-0.5 rounded text-text-disabled">
                        {beat.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Entry form ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={pageVariants} initial="initial" animate="animate" exit="exit"
      transition={{ duration: 0.25 }}
      className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-8"
    >
      <div className="w-full max-w-2xl">
        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-semibold text-text-primary mb-3 tracking-tight">
            What story do you want to tell?
          </h1>
          <p className="text-text-secondary text-base">
            Enter a topic and we'll find real, documented stories for your documentary
          </p>
        </div>

        {/* Main input */}
        <div className="mb-4">
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleFindStories())}
            placeholder="A heist that went wrong in 1970s New York..."
            className="w-full h-28 text-base resize-none"
            autoFocus
          />
        </div>

        {/* Example topics */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {exampleTopics.map((t, i) => (
            <button
              key={i}
              onClick={() => setTopic(t.label)}
              title={t.sub}
              className="px-3 py-1.5 rounded-full text-xs bg-surface-raised border border-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors flex items-center gap-1.5"
            >
              {t.label}
              <span className="text-text-disabled text-[9px]">· {t.sub}</span>
            </button>
          ))}
        </div>

        {/* Settings grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Duration */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Max Duration (min)</label>
            <input
              type="number"
              value={maxMinutes || ''}
              onChange={e => setMaxMinutes(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Auto"
              className="w-full text-sm"
              min={1}
              max={60}
            />
            {maxMinutes > 0 && (() => {
              const vm = settings.videoModel || 'lightricks/ltx-2-pro'
              const avgSec = vm === 'kwaivgi/kling-v2.5-turbo-pro' ? 7
                : vm === 'lightricks/ltx-2-fast' ? 10
                : 8
              const scenes = Math.round((maxMinutes * 60) / avgSec)
              return (
                <p className="text-[11px] text-text-disabled mt-1.5">
                  ~{scenes} scenes estimated
                </p>
              )
            })()}
          </div>

          {/* Aspect ratio */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Aspect Ratio</label>
            <select value={settings.aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full text-sm">
              {ASPECT_RATIOS.map(ar => (
                <option key={ar.value} value={ar.value}>{ar.label} — {ar.sub}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Advanced — System Prompts */}
        <div className="mb-6 border border-border rounded-xl overflow-hidden">
          <button
            onClick={handleToggleAdvanced}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Advanced — Customize System Prompts
            </span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {advancedOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border px-4 pt-3 pb-4 space-y-5 bg-surface-raised/40">
                  <p className="text-[11px] text-text-disabled leading-relaxed">
                    Each textarea below contains the system prompt used for that pipeline stage. Edit to change how the AI behaves. Reset to restore the default.
                  </p>

                  {loadingDefaults ? (
                    <div className="flex items-center gap-2 text-xs text-text-disabled py-4 justify-center">
                      <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      Loading defaults...
                    </div>
                  ) : (
                    PROMPT_STAGES.map(({ key, label, desc }) => (
                      <div key={key}>
                        <div className="flex items-start justify-between mb-1.5">
                          <div>
                            <span className="text-xs font-semibold text-text-primary">{label}</span>
                            <p className="text-[10px] text-text-disabled mt-0.5">{desc}</p>
                          </div>
                          <button
                            onClick={() => handleResetPrompt(key)}
                            className="text-[10px] text-accent hover:text-accent-hover whitespace-nowrap ml-4 mt-0.5"
                          >
                            Reset to default
                          </button>
                        </div>
                        <textarea
                          value={customPrompts[key] || ''}
                          onChange={e => setCustomPrompt(key, e.target.value)}
                          className="w-full h-40 text-xs font-mono resize-y leading-relaxed"
                          spellCheck={false}
                        />
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error */}
        {storiesError && (
          <div className="mb-4 p-3 bg-error/8 border border-error/20 rounded-lg flex items-start gap-2">
            <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs text-error font-medium">Search failed</p>
              <p className="text-xs text-text-secondary mt-0.5">{storiesError}</p>
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleFindStories}
          disabled={!topic.trim()}
          className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Find Stories
        </button>

        <p className="text-center text-[11px] text-text-disabled mt-4">
          AI will search for real, verified historical narratives matching your topic
        </p>
      </div>
    </motion.div>
  )
}

// Streaming research lines in the loading terminal
function ResearchStream({ topic }) {
  const [lines, setLines] = useState([])
  const [cursor, setCursor] = useState(true)

  const streamLines = [
    `> Querying historical databases for: "${topic}"`,
    '> Filtering by: documented events with traceable sources',
    '> Cross-referencing ≥2 independent sources per story...',
    '> Evaluating narrative beats: hook → climax → resolution',
    '> Scoring dramatic impact and visual potential...',
    '> Validating cinematic structure...',
    '> Compiling story candidates...',
  ]

  useEffect(() => {
    setLines([])
    let i = 0
    const interval = setInterval(() => {
      if (i < streamLines.length) {
        setLines(prev => [...prev, streamLines[i]])
        i++
      } else {
        clearInterval(interval)
      }
    }, 800)
    return () => clearInterval(interval)
  }, [topic])

  useEffect(() => {
    const t = setInterval(() => setCursor(c => !c), 530)
    return () => clearInterval(t)
  }, [])

  return (
    <>
      {lines.map((line, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="text-emerald-300 mb-0.5"
        >
          {line}
        </motion.div>
      ))}
      <span className="text-emerald-400">{cursor ? '█' : ' '}</span>
    </>
  )
}

export default StorySelect
