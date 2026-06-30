import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': { target: 'http://backend:8000', changeOrigin: true },
      '/opds': { target: 'http://backend:8000', changeOrigin: true },
      '/uploads': { target: 'http://backend:8000', changeOrigin: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          epub: ['epubjs'],
        },
      },
    },
  },
})
