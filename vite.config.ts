import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

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
});
