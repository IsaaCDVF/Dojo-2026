import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En desarrollo (npm run dev, puerto 5173) las llamadas a /api se mandan a Nginx en el 8080.
// En producción Nginx sirve la carpeta dist/ en / y la API en /api, así que no hace falta proxy.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL || 'http://localhost:8080', changeOrigin: true } },
  },
});
