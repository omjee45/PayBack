import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy /api/* to the Express backend — no CORS config needed in dev
    proxy: {
      '/api': {
        target:       'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
