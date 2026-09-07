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
    port: 5175,
    strictPort: true,
    origin: 'http://localhost:5175',
    cors: true,
    hmr: {
      clientPort: 5175,
      host: 'localhost',
      protocol: 'ws',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
