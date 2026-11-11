/**
 * Phần SDK Sentry app thật sự dùng – CHỈ import động từ `./monitoring` (chunk lười). Import đích danh từng hàm để bundler cắt
 * phần còn lại của `@sentry/browser` (ghi lại phiên, form phản hồi, đo hiệu năng…): `import('@sentry/browser')` trực tiếp
 * kéo cả gói (~154 KB gzip).
 */
export { captureException, init } from '@sentry/browser';
