import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// No StrictMode: the host opens one PeerJS session and one emulator per mount, and the dev
// double-invoke would leave duplicate rooms behind.
createRoot(document.getElementById('root')!).render(<App />)
