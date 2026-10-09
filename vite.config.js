import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' makes the build work on GitHub Pages under any repo name
export default defineConfig({
  base: './',
  plugins: [react()],
})
