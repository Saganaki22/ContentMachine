import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#161616',
            color: '#f0f0f0',
            border: '1px solid #2a2a2a',
          },
          success: {
            style: { borderLeft: '3px solid #22c55e' }
          },
          error: {
            duration: 5000,
            style: { borderLeft: '3px solid #ef4444' }
          }
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
