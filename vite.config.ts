import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/** GitHub Pages: unknown paths must serve the SPA shell. */
function spaFallback404(): Plugin {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      const indexHtml = path.join(outDir, 'index.html');
      const notFound = path.join(outDir, '404.html');
      if (fs.existsSync(indexHtml)) {
        fs.copyFileSync(indexHtml, notFound);
      }
    },
  };
}

const devPort = Number(process.env.VITE_DEV_PORT || 5175);
const devOrigin = (process.env.VITE_DEV_ORIGIN || `http://localhost:${devPort}`).replace(/\/+$/, '');
const usePolling =
  process.env.CHOKIDAR_USEPOLLING === 'true' || process.env.VITE_USE_POLLING === 'true';

export default defineConfig({
  plugins: [react(), spaFallback404()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  base: '/',
  server: {
    host: true,
    port: devPort,
    strictPort: true,
    origin: devOrigin,
    cors: true,
    watch: usePolling ? { usePolling: true, interval: 1000 } : undefined,
    hmr: {
      clientPort: devPort,
      host: new URL(devOrigin).hostname,
      protocol: devOrigin.startsWith('https') ? 'wss' : 'ws',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
