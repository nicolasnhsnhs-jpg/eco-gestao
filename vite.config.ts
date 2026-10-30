import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Arquivos da pasta public que o app precisa para abrir sem internet.
const PUBLICOS_OFFLINE = [
  '/index.html',
  '/logo.webp',
  '/logo-pdf.jpg',
  '/site.webmanifest',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

/**
 * Gera o sw.js no build, com a lista dos arquivos daquela versão (os nomes mudam
 * a cada build). Assim o celular guarda exatamente a versão publicada.
 */
function serviceWorker(): Plugin {
  return {
    name: 'eco-service-worker',
    apply: 'build',
    generateBundle(_opcoes, bundle) {
      const doBuild = Object.keys(bundle)
        .filter((nome) => !nome.endsWith('.map'))
        .map((nome) => `/${nome}`)
      const arquivos = [...new Set([...doBuild, ...PUBLICOS_OFFLINE])].sort()
      const modelo = readFileSync(new URL('./service-worker/sw.js', import.meta.url), 'utf8')
      // A versão muda quando muda qualquer arquivo do app ou o próprio worker.
      const versao = createHash('sha256')
        .update(arquivos.join('\n') + modelo)
        .digest('hex')
        .slice(0, 12)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: modelo
          .replace('__VERSAO__', versao)
          .replace('__ARQUIVOS__', JSON.stringify(arquivos)),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  resolve: {
    // Permite importar com "@/..." em vez de "../../.."
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
  },
})
