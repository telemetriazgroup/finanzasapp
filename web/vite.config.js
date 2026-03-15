import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // En desarrollo, reenvía /api al contenedor de la API
    // Así el navegador no tiene problemas de CORS
    proxy: {
      '/api': {
        target:       'http://api:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Divide el bundle en chunks para que el navegador cachee mejor
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          utils:  ['axios', 'date-fns', 'zustand'],
        },
      },
    },
  },
})