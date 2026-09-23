import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'local-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/api/gemini-ocr') && req.method === 'POST') {
              let body = ''
              req.on('data', (chunk) => { body += chunk })
              req.on('end', async () => {
                try {
                  req.body = JSON.parse(body || '{}')
                  if (!process.env.GEMINI_API_KEY) {
                    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || ''
                  }
                  const { default: handler } = await import('./api/gemini-ocr.js')
                  res.status = (code) => { res.statusCode = code; return res }
                  res.json = (data) => {
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify(data))
                    return res
                  }
                  await handler(req, res)
                } catch (err) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }))
                }
              })
              return
            }
            next()
          })
        }
      }
    ],
    server: {
      port: 5173,
      host: true
    }
  }
})
