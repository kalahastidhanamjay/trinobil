import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// The browser talks to /api on the same origin; Vite forwards it to the
// Trinobil gateway, so no CORS set-up is needed in development.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': { target: process.env.TRINOBIL_API ?? 'http://127.0.0.1:8080', changeOrigin: true },
    },
  },
});
