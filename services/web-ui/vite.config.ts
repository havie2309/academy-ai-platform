import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repoRoot = path.resolve(__dirname, '../..')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '')

  return {
    envDir: repoRoot,
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
      },
    },
  }
})
