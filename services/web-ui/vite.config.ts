import http from 'node:http'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Khong pool socket toi gateway: mot socket keep-alive bi hong sau khi stream
// SSE bi abort se khien request ke tiep nhan HTTP 400. Moi request mot socket moi.
const noKeepAliveAgent = new http.Agent({ keepAlive: false })

export default defineConfig(({ mode }) => {
  const envRoot = path.resolve(__dirname)
  const env = loadEnv(mode, envRoot, '')
  const gatewayTarget = env.VITE_API_URL || 'http://127.0.0.1:3000'
  const devHost = env.VITE_DEV_HOST || '127.0.0.1'
  const devPort = Number(env.VITE_PORT || 5174)

  return {
    envDir: envRoot,
    plugins: [react(), tailwindcss()],
    server: {
      host: devHost,
      port: devPort,
      proxy: {
        '/api': {
          target: gatewayTarget,
          changeOrigin: true,
          agent: noKeepAliveAgent,
        },
      },
    },
    preview: {
      host: devHost,
      port: devPort,
    },
  }
})
