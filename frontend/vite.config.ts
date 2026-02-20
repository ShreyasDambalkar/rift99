import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/validate-vcf': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/predict-risk': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
