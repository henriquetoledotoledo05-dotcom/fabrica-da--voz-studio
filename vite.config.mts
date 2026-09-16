import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'fabricadavozstudio.com.br',
      'www.fabricadavozstudio.com.br'
    ]
  },

  preview: {
    host: '0.0.0.0',
    allowedHosts: [
      'fabricadavozstudio.com.br',
      'www.fabricadavozstudio.com.br'
    ]
  }
})