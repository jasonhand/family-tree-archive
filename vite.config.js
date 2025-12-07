import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  build: {
    // Ensure assets work correctly on Netlify
    assetsDir: 'assets',
    sourcemap: false
  }
})
