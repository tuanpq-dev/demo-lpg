/**
 * Tắt bộ biên dịch JIT của zod TRƯỚC khi bất kỳ schema API nào được khai báo (zod thử `new Function` lúc tạo object
 * schema). CSP của bản deploy không cho `eval` (script-src 'self') – mỗi lần thử là một vi phạm CSP bị ghi vào console.
 * Mọi file schema trong `src/api/` import module này ĐẦU TIÊN.
 */
import { config } from 'zod/mini';

config({ jitless: true });
