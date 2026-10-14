import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  envDir: 'poultry-medix',
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-leaflet', 'leaflet'],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
