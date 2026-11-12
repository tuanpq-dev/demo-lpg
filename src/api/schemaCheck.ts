/*
 * Kiểm LÚC BIÊN DỊCH schema zod khớp kiểu TS của FE (không có mã chạy): parse ra gán được cho kiểu đích, khai đủ mọi khoá,
 * danh sách enum đủ mọi giá trị. Lệch → `npm run typecheck` báo lỗi ngay tại schema.
 */
import type { z } from 'zod/mini';

type Infer<S> = S extends z.ZodMiniType<infer O> ? O : never;

/** `true` khi schema S parse ra đúng hình dạng T; ngược lại là mô tả chỗ lệch (để lỗi biên dịch dễ đọc). */
export type Matches<S, T> = [Infer<S>] extends [T]
  ? [Exclude<keyof T, keyof Infer<S>>] extends [never]
    ? true
    : { 'schema thiếu khoá': Exclude<keyof T, keyof Infer<S>> }
  : { 'schema parse ra kiểu không gán được cho': T };

/** Dùng: `export type _X = Assert<Matches<typeof XSchema, X>>`. */
export type Assert<T extends true> = T;

/** Danh sách giá trị cho `z.enum` – phải đủ mọi thành viên của union T (thiếu → lỗi biên dịch nêu giá trị thiếu). */
export const allOf =
  <T extends string>() =>
  <const A extends readonly [T, ...T[]]>(values: A & ([Exclude<T, A[number]>] extends [never] ? unknown : { thiếu: Exclude<T, A[number]> })): A =>
    values;
