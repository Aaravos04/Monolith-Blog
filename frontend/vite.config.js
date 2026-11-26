import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In dev, /api (and uploaded images under /media) are forwarded to Django,
// so you don't need CORS setup while developing.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  // `npm test` (vitest). jsdom gives the tests a fake browser (localStorage, DOMParser, window).
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
