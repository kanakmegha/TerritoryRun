import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Exposes the server to the network
    proxy: {
      '/api': {
        target: 'http://192.168.68.113:5001',
        changeOrigin: true,
      }
    }
  }
})
