import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const configuration = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
    if (!configuration.VITE_API_BASE_URL || !configuration.VITE_CLERK_PUBLISHABLE_KEY) {
      throw new Error('Production builds require VITE_API_BASE_URL and VITE_CLERK_PUBLISHABLE_KEY.')
    }
    const api = new URL(configuration.VITE_API_BASE_URL)
    if (api.protocol !== 'https:' && api.hostname !== 'localhost' && api.hostname !== '127.0.0.1') {
      throw new Error('The production API URL must use HTTPS.')
    }
  }
  return { plugins: [react()] }
})
