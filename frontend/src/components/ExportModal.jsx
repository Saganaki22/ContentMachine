import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePipelineStore } from '../store/pipelineStore'
import api from '../services/api'
import toast from 'react-hot-toast'

function ExportModal({ onClose }) {
  const [exporting, setExporting] = useState(false)
  const { selectedVideos, exportProject, clearProject } = usePipelineStore()
  const navigate = useNavigate()

  const handleExport = async () => {
    setExporting(true)
    try {
      const project = exportProject()
      await api.exportZip(project)
      toast.success('Project exported')
      onClose()
    } catch (error) {
      toast.error(`Export failed: ${error.message}`)
    }
    setExporting(false)
  }

  const handleNewProject = () => {
    clearProject()
    onClose()
    navigate('/')
  }

  const videoCount = Object.keys(selectedVideos).length

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={onClose}
      >
        <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-6 shadow-2xl"
          onClick={e => e.stopPropagation()}>
          <h2 className="text-base font-semibold text-text-primary mb-1">Export Project</h2>
          <p className="text-xs text-text-secondary mb-5">Download a zip with all assets generated so far</p>

          <div className="mb-5 space-y-1.5 text-sm text-text-secondary">
            <p className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-success/15 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              Selected images
            </p>
            {videoCount > 0 && (
              <p className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-success/15 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {videoCount} scene {videoCount === 1 ? 'video' : 'videos'}
              </p>
            )}
            <p className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-success/15 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              Narration script
            </p>
            <p className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-success/15 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              Project file (project.json)
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={handleExport} disabled={exporting} className="flex-1 btn-primary py-2.5 text-sm">
              {exporting ? 'Exporting...' : 'Download Zip'}
            </button>
            <button onClick={onClose} className="btn-ghost py-2.5 px-4 text-sm">Cancel</button>
          </div>

          <button onClick={handleNewProject} className="w-full mt-3 text-xs text-text-disabled hover:text-text-secondary py-1">
            Start new project
          </button>
        </div>
      </motion.div>
    </>
  )
}

export default ExportModal
