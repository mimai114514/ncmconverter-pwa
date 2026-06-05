import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'assets/icon-ncmconverter-v1.png'],
      manifest: {
        name: 'NCM Converter PWA',
        short_name: 'NCM PWA',
        description: '简洁高效的网易云音乐 .ncm 格式文件离线转换工具。',
        theme_color: '#ef4444',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'assets/icon-ncmconverter-v1.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
