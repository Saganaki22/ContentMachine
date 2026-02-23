import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { usePipelineStore } from './store/pipelineStore'
import Layout from './components/Layout'
import StorySelect from './pages/StorySelect'
import SceneImages from './pages/SceneImages'
import VideoGeneration from './pages/VideoGeneration'
import AudioGeneration from './pages/AudioGeneration'
import Export from './pages/Export'

function App() {
  const { selectedStory, selectedImages, selectedVideos } = usePipelineStore()
  
  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<StorySelect />} />
          <Route 
            path="/images" 
            element={selectedStory ? <SceneImages /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/videos" 
            element={
              selectedStory && Object.keys(selectedImages).length > 0 
                ? <VideoGeneration /> 
                : <Navigate to="/" replace />
            } 
          />
          <Route 
            path="/audio" 
            element={
              selectedStory && Object.keys(selectedVideos).length > 0 
                ? <AudioGeneration /> 
                : <Navigate to="/videos" replace />
            } 
          />
          <Route 
            path="/export" 
            element={
              selectedStory && Object.keys(selectedVideos).length > 0 
                ? <Export /> 
                : <Navigate to="/" replace />
            } 
          />
        </Routes>
      </AnimatePresence>
    </Layout>
  )
}

export default App
