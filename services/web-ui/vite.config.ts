import http from 'node:http'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const gatewayTarget = process.env.VITE_API_URL || 'http://localhost:3000'

// Không pool socket tới gateway: một socket keep-alive bị hỏng sau khi stream
// SSE bị abort sẽ khiến request kế tiếp nhận HTTP 400. Mỗi request một socket mới.
const noKeepAliveAgent = new http.Agent({ keepAlive: false })

export default defineConfig({
  envDir: path.resolve(__dirname),
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: gatewayTarget,
        changeOrigin: true,
        agent: noKeepAliveAgent,
      },
    },
  },
})
