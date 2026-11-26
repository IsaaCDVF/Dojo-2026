import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// En desarrollo (npm run dev, puerto 5173) las llamadas a /api se mandan a Nginx en el 8080.
// En producción Nginx sirve la carpeta dist/ en / y la API en /api, así que no hace falta proxy.
// npm run celular: lo mismo pero con HTTPS (certificado de prueba), porque el navegador del celular
// solo deja usar la cámara en páginas seguras. Sirve para usar el celular como tableta de asistencia.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'celular' ? [basicSsl()] : [])],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL || 'http://localhost:8080', changeOrigin: true } },
  },
}));
