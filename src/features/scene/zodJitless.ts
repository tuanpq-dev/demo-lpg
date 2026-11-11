/**
 * Tắt bộ biên dịch JIT của zod TRƯỚC khi schema cảnh được khai báo (zod thử `new Function` ngay lúc tạo `z.object`).
 * CSP của bản deploy không cho `eval` (script-src 'self' – vercel.json): mỗi lần thử là một vi phạm CSP bị ghi nhận.
 * Chỉ đặt ở FE – BE (Node) vẫn dùng JIT. Module này PHẢI được import trước `@demo-lpg/shared/scene/parse`.
 */
import { config } from 'zod';

config({ jitless: true });
