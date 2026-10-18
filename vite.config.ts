import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * Dev-only /testroms/* straight from the gitignored testroms/ folder. Keeping test ROMs out of
 * public/ means a production build can never ship them.
 */
const testRoms: Plugin = {
  name: 'cabinetcast-testroms',
  apply: 'serve',
  configureServer(server) {
    const root = resolve('testroms')
    server.middlewares.use('/testroms', (request, response) => {
      const file = resolve(root, decodeURIComponent((request.url ?? '').split('?')[0]).replace(/^\/+/, ''))
      if (!file.startsWith(root) || !existsSync(file)) {
        response.statusCode = 404
        return response.end()
      }
      response.setHeader('Content-Type', extname(file) === '.zip' ? 'application/zip' : 'application/octet-stream')
      response.end(readFileSync(file))
    })
  },
}

// Project pages are served from https://<user>.github.io/<repo>/
export default defineConfig({ base: '/CabinetCast/', plugins: [react(), testRoms] })
