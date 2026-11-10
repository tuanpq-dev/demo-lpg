import { parsePlantDateTime } from './plantTime';

/**
 * "Bây giờ" của ứng dụng, có thể dời để xem trạng thái theo giờ (đồng hồ hạn chót 04:15:00, quá hạn…) mà không phải chờ:
 * - `?now=` (URL) – CHỈ khi `import.meta.env.DEV` hoặc `VITE_DEMO=true`; bản build thường bỏ qua.
 * - `VITE_FIXED_NOW` (đặt LÚC BUILD, không qua URL, mặc định tắt) – ghim mốc giờ cho bản demo nội bộ để KPI/hạn ổn định
 *   khi trình bày. ⚠ Không đặt trên bản công khai (người dùng thật sẽ thấy giờ sai). `?now=` (nếu được phép) thắng.
 *
 * - `?now=2026-10-26T11:45` (không múi giờ) = giờ nhà máy Asia/Bangkok; `?now=2026-10-26T04:45:00Z` = ISO đầy đủ.
 * - Đọc MỘT lần lúc nạp app → độ lệch giữ suốt phiên (chuyển trang mất query vẫn giữ); F5 bỏ `?now=` → về giờ thật.
 * - Đồng hồ vẫn chạy (lệch cố định so với giờ thật). Dùng cho `useNow` và ngày tương đối của mock.
 * - KHÔNG dùng cho quy tắc mất tín hiệu (`tagSignal` so `ts` của số liệu với `Date.now()` thật).
 */

/** Đọc `?now=`: giờ nhà máy "yyyy-mm-ddTHH:mm[:ss]" hoặc ISO có `Z`/`±hh:mm`. Sai → null. */
export function parseNowParam(value: string | null | undefined): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parsePlantDateTime(v);
}

/**
 * Độ lệch (ms) so với giờ thật. Ưu tiên `?now=` hợp lệ khi được phép (`enabled`), rồi `fixed` (VITE_FIXED_NOW) hợp lệ;
 * không có → 0. Giá trị sai bị bỏ qua (không ném lỗi). Thuần – `realNow` truyền vào.
 */
export function nowOffsetFrom(search: string, enabled: boolean, realNow: number, fixed?: string): number {
  const fromUrl = enabled ? parseNowParam(new URLSearchParams(search).get('now')) : null;
  const d = fromUrl ?? parseNowParam(fixed);
  return d ? d.getTime() - realNow : 0;
}

const enabled = import.meta.env.DEV || import.meta.env.VITE_DEMO === 'true';
const offsetMs = typeof window === 'undefined' ? 0 : nowOffsetFrom(window.location.search, enabled, Date.now(), import.meta.env.VITE_FIXED_NOW);

/** Đang dời giờ (`?now=` hoặc `VITE_FIXED_NOW`). */
export const isNowOverridden = offsetMs !== 0;

/** Thời điểm hiện tại của app (giờ thật + độ lệch `?now=`). */
export const appNow = () => new Date(Date.now() + offsetMs);
