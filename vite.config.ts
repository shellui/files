import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Always compile the local SDK from source so `shellui.storage` is not a stale dist/cache.
      '@shellui/sdk': path.resolve(__dirname, '../shellui/packages/sdk/src/index.ts'),
    },
    dedupe: ['react', 'react-dom', '@shellui/sdk'],
  },
  optimizeDeps: {
    exclude: ['@shellui/sdk'],
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
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
