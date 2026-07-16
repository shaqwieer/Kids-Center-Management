import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Reads VITE_* vars from the project-root .env (one level up).
export default defineConfig({
  plugins: [vue()],
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: { port: 5173, host: true },
});
