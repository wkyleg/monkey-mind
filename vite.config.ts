import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  base: process.env.GITHUB_PAGES ? '/monkey-mind/' : '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@elata-biosciences/eeg-web', '@elata-biosciences/eeg-web-ble', '@elata-biosciences/rppg-web'],
  },
  server: {
    port: 3000,
    open: true,
  },
  publicDir: 'public',
});
