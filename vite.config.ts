import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('monaco-editor')) return undefined // stays lazy via dynamic import
          if (id.includes('elkjs')) return 'elk'
          if (id.includes('@xyflow')) return 'flow'
          if (id.includes('node_modules/react') || id.includes('react-dom')) return 'react'
          return undefined
        },
      },
    },
  },
})
