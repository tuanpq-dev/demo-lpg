/**
 * Validate SceneConfig bằng zod – nội dung ở `packages/shared/src/scene/parse.ts` (BE dùng cùng schema).
 * Chỉ import động (`import('@/features/scene/parse')`) để zod nằm ở chunk lazy riêng.
 */
// Thứ tự import có chủ đích: tắt JIT của zod trước khi module schema chạy (xem ./zodJitless).
import './zodJitless';

export * from '@demo-lpg/shared/scene/parse';
