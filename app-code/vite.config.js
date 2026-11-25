import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// App del alumno y del responsable. Nginx la sirve compilada en /app (app-code/dist).
// npm run dev → http://localhost:5174/app/  (las llamadas a /api van a Nginx en el 8080)
// npm run celular → lo mismo con https, para abrirla desde el celular en la misma red.
export default defineConfig(({ mode }) => ({
  base: '/app/',
  plugins: [react(), tailwindcss(), ...(mode === 'celular' ? [basicSsl()] : [])],
  server: {
    host: true,
    port: 5174,
    proxy: { '/api': { target: process.env.API_URL || 'http://localhost:8080', changeOrigin: true } },
  },
}));
