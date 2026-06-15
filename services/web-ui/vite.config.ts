import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const webUiDir = path.resolve(__dirname)
const repoRoot = path.resolve(__dirname, '../..')
const gatewayTarget = process.env.VITE_API_URL || 'http://localhost:3000'

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, repoRoot, ''),
    ...loadEnv(mode, webUiDir, ''),
  }

  return {
    envDir: webUiDir,
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api/openai': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/openai/, ''),
          headers: env.VITE_OPENAI_API_KEY
            ? { Authorization: `Bearer ${env.VITE_OPENAI_API_KEY}` }
            : {},
        },
        '/api': {
          target: gatewayTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
