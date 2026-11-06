import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [{
    name: 'legacy-css-layer',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0];
      if (file.includes('/src/') && file.endsWith('.css') && !file.includes('/src/ui/')) {
        return {code: `@layer mongle-legacy {\n${code}\n}`, map: null};
      }
    },
  }],
  base: mode === 'demo' ? './' : '/',
  define: { __MONGLE_DEMO__: JSON.stringify(mode === 'demo') },
  build: { outDir: mode === 'demo' ? 'demo-dist' : 'dist' },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } } },
}));
