import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/shift-calendar/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) return 'firebase';
        },
      },
    },
  },
})
