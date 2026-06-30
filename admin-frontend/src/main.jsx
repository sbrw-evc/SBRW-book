import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/themes/light.css'
import './styles/themes/dark.css'
import './styles/themes/colorful.css'
import './styles/animations.css'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
