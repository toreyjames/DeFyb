import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('jspdf')) return 'vendor-jspdf'
          if (id.includes('html2canvas')) return 'vendor-html2canvas'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('@stripe')) return 'vendor-stripe'
          return 'vendor'
        },
      },
    },
  },
})
