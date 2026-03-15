import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? './',
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
    host: '0.0.0.0',
  },
});
