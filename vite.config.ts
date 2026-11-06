import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 开发环境把 /4byte 代理到 4byte.directory，绕开浏览器的 CORS 限制
      '/4byte': {
        target: 'https://www.4byte.directory/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/4byte/, ''),
      },
    },
  },
})
