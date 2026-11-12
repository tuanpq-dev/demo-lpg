/*
 * Response của mock server đi qua ĐÚNG schema mà `api.request` sẽ dùng khi có backend (`src/api/*Schemas.ts`).
 * Kiểm ở dev + unit test: mock lệch hợp đồng → `ApiError('CONTRACT_ERROR')` nêu rõ trường sai, như backend lệch hợp đồng.
 * Bản build production bỏ qua (nhánh `import.meta.env.DEV` bị loại khi build) để bản demo không phải tải zod.
 * Nối API thật: thay `fromMock(endpoint, schema, …)` bằng `api.request(path, { schema, signal })` – giữ nguyên `schema`.
 */
import type { SchemaPick } from '@/api/client';

export async function fromMock<T>(endpoint: string, schema: SchemaPick<T>, data: Promise<T>): Promise<T> {
  const value = await data;
  if (import.meta.env.DEV) {
    const { validateContract } = await import('@/api/client');
    await validateContract(`${endpoint} (mock)`, schema, value);
  }
  return value;
}
