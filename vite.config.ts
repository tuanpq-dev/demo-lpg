import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/** Backend dev (repo riêng ../demo-lpg-server, NestJS) – FE gọi `/api/*` cùng origin, Vite chuyển tiếp để cookie refresh là first-party. */
const API_TARGET = process.env.VITE_API_PROXY ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      // packages/shared dùng thẳng mã nguồn TS (BE dùng bản build dist/).
      { find: /^@demo-lpg\/shared\/scene$/, replacement: path.resolve(__dirname, 'packages/shared/src/scene/index.ts') },
      { find: /^@demo-lpg\/shared\/(.*)$/, replacement: path.resolve(__dirname, 'packages/shared/src/$1.ts') },
    ],
  },
  server: {
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } },
  },
  preview: {
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } },
  },
});
