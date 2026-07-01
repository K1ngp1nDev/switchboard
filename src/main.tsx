import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'

// apply the persisted theme before first paint to avoid a flash
const params = new URLSearchParams(window.location.search)
const theme = params.get('theme') ?? localStorage.getItem('sb-theme') ?? 'dark'
document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'

createRoot(document.getElementById('root')!).render(<App />)
