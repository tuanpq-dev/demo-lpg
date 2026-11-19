/**
 * Tắt bộ biên dịch JIT của zod TRƯỚC khi bất kỳ schema nào được khai báo (zod thử `new Function` ngay lúc tạo object
 * schema). CSP của bản deploy không cho `eval` (script-src 'self' – vercel.json): mỗi lần thử là một vi phạm CSP bị ghi nhận.
 *
 * MỘT chỗ cho cả FE: schema API (`src/api/*Schemas.ts`, `zod/mini`) và schema cảnh 3D (`features/scene/parse` →
 * `@demo-lpg/shared/scene/parse`, `zod`) – `zod` và `zod/mini` dùng chung cấu hình toàn cục của `zod/v4/core`.
 * Module nào khai báo schema phải import file này ĐẦU TIÊN. Chỉ ở FE – BE (Node) vẫn dùng JIT.
 */
import { config } from 'zod/mini';

config({ jitless: true });
