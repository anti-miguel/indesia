import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'

export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'copy-pdf-worker',
      buildStart() {
        // Ensure workers directory exists
        const workersDir = resolve('public/workers')
        if (!existsSync(workersDir)) {
          mkdirSync(workersDir, { recursive: true })
        }
        
        // Try to copy PDF worker from node_modules
        try {
          const workerSource = resolve('node_modules/pdfjs-dist/build/pdf.worker.min.js')
          const workerDest = resolve('public/workers/pdf.worker.min.js')
          
          if (existsSync(workerSource)) {
            copyFileSync(workerSource, workerDest)
            console.log('✓ PDF.js worker copied successfully')
          }
        } catch (error) {
          console.warn('⚠ Could not copy PDF.js worker:', error.message)
        }
      }
    }
  ],
  server: {
    port: 3000,
    host: true
  },
  build: {
    target: 'es2022'
  },
  optimizeDeps: {
    include: ['pdf-lib', 'pdfjs-dist', '@xenova/transformers']
  },
  define: {
    global: 'globalThis',
  },
  worker: {
    format: 'es'
  }
})
