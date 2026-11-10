import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Thư viện tách chunk riêng: đổi code app không làm đổi hash (trình duyệt giữ cache giữa các lần deploy).
 * ⚠ Thư viện nhỏ dùng CHUNG giữa app và recharts/three (clsx, react-is, prop-types…) phải nằm ở `vendor-react` (chunk luôn
 * tải): nếu Rollup xếp chúng vào vendor-charts / vendor-three thì MỌI trang phải tải cả chunk đó. Sau khi đổi danh sách,
 * kiểm `dist/index.html` chỉ có modulepreload `vendor-react`.
 */
const VENDOR_CHUNKS: readonly [name: string, pattern: RegExp][] = [
  [
    'vendor-react',
    /[\\/]node_modules[\\/](react|react-dom|react-is|scheduler|react-router|react-router-dom|@remix-run|clsx|prop-types|object-assign)[\\/]/,
  ],
  // Lõi 3D (không gồm postprocessing – PostEffects vẫn là chunk lazy riêng, chỉ tải khi preset bật).
  ['vendor-three', /[\\/]node_modules[\\/](three|three-stdlib|@react-three[\\/](fiber|drei)|react-reconciler|its-fine)[\\/]/],
  ['vendor-charts', /[\\/]node_modules[\\/](recharts|recharts-scale|react-smooth|d3-[^\\/]+|decimal\.js-light|lodash|victory-vendor)[\\/]/],
];

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
  build: {
    // SVG luôn là file riêng (không inline data URI vào JS): bộ icon ~90 KB không còn nằm trong chunk chính, tải khi cần
    // và được cache. Ảnh khác < 4 KB vẫn inline như mặc định.
    assetsInlineLimit: (file) => (file.endsWith('.svg') ? false : undefined),
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Helper ảo của Vite/Rollup (`\0vite/preload-helper`, `\0commonjsHelpers`) dùng ở mọi chunk – để Rollup tự xếp thì
          // có thể rơi vào vendor-three/charts và kéo chúng vào mọi trang.
          if (id === '\0vite/preload-helper.js' || id === '\0commonjsHelpers.js') return 'vendor-react';
          return VENDOR_CHUNKS.find(([, re]) => re.test(id))?.[0];
        },
      },
    },
    // vendor-three (~900 KB: three + fiber + drei) chỉ tải khi mở bản đồ 3D / Editor – vượt ngưỡng mặc định 500 KB là có chủ đích.
    chunkSizeWarningLimit: 950,
  },
});
