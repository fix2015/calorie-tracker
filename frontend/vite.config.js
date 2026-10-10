import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const SW_TEMPLATE = new URL('./src/sw.js', import.meta.url)

/** Fill the build constants of the src/sw.js template. */
function renderServiceWorker({ base, assets }) {
  const buildId = assets.length
    ? createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 12)
    : 'dev'
  const source = readFileSync(SW_TEMPLATE, 'utf8')
  const replaced = source
    .replace("const BUILD_ID = 'dev';", `const BUILD_ID = ${JSON.stringify(buildId)};`)
    .replace("const BASE = '/';", `const BASE = ${JSON.stringify(base)};`)
    .replace('const PRECACHE_ASSETS = [];', `const PRECACHE_ASSETS = ${JSON.stringify(assets)};`)
  if (assets.length && !replaced.includes(buildId)) throw new Error('sw.js template constants not found')
  return replaced
}

/**
 * Emits /sw.js with the list of hashed chunks to precache (the app shell), so a full page reload
 * works offline. The list changes on every deploy, which makes browsers pick up the new worker.
 */
function serviceWorkerPlugin() {
  let base = '/'
  return {
    name: 'calorie-tracker-sw',
    enforce: 'post',
    configResolved(config) { base = config.base },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/sw.js') return next()
        res.setHeader('Content-Type', 'application/javascript')
        res.end(renderServiceWorker({ base, assets: [] }))
      })
    },
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((file) => file.startsWith('assets/') && !file.endsWith('.map'))
        .sort()
        .map((file) => `${base}${file}`)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: renderServiceWorker({ base, assets }) })
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
  base: process.env.CAPACITOR ? '/' : (process.env.VITE_BASE_PATH || '/'),
})
