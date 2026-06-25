import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2018',
    cssTarget: 'chrome61',
    chunkSizeWarningLimit: 1200,
  },
  esbuild: {
    target: 'es2018',
  },
});
