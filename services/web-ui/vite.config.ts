import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const gatewayTarget = process.env.VITE_API_URL || 'http://localhost:3000'

export default defineConfig({
  envDir: path.resolve(__dirname),
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: gatewayTarget,
        changeOrigin: true,
      },
    },
  },
})
