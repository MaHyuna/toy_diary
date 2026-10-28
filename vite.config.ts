import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'demo' ? './' : '/',
  define: { __MONGLE_DEMO__: JSON.stringify(mode === 'demo') },
  build: { outDir: mode === 'demo' ? 'demo-dist' : 'dist' },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } } },
}));
