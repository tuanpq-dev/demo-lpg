import type { LiveData, LiveValue, TagValue } from './types';

/*
 * Quy tắc hiển thị tín hiệu – dùng chung cho nhãn 3D, màu thiết bị, KPI, danh sách theo dõi, bản đồ 2.5D.
 * Mất tín hiệu = quality 'bad', HOẶC quá STALE_MS không cập nhật, HOẶC tag không có trong dữ liệu.
 * Khi mất tín hiệu UI hiện "Mất tín hiệu" (xám + icon) – KHÔNG hiển thị số cũ như số mới.
 */

/** Không cập nhật từ STALE_MS (ms) trở lên → coi như mất tín hiệu. */
export const STALE_MS = 10_000;

export const SIGNAL_LOST_LABEL = 'Mất tín hiệu';

/** ok · uncertain (vẫn hiển thị số, chất lượng không chắc chắn) · lost. */
export type TagSignal = 'ok' | 'uncertain' | 'lost';

export function tagSignal(tv: TagValue | undefined, now: number = Date.now()): TagSignal {
  // ≥ (không phải >): khớp `nextExpiry` (hẹn giờ khi at > now) – ở đúng mốc 10 s không bị kẹt "còn tươi".
  if (!tv || tv.quality === 'bad' || now - tv.ts >= STALE_MS) return 'lost';
  return tv.quality === 'uncertain' ? 'uncertain' : 'ok';
}

/** Giá trị dùng được (undefined khi mất tín hiệu). */
export function freshValue(tv: TagValue | undefined, now: number = Date.now()): LiveValue | undefined {
  return tagSignal(tv, now) === 'lost' ? undefined : tv!.value;
}

/** Số dùng được (undefined khi mất tín hiệu hoặc không phải số). */
export function freshNumber(tv: TagValue | undefined, now: number = Date.now()): number | undefined {
  const v = freshValue(tv, now);
  return typeof v === 'number' ? v : undefined;
}

/**
 * Thời điểm (ms) tag còn tươi sớm nhất sẽ quá hạn – để UI hẹn giờ vẽ lại đúng lúc chuyển "Mất tín hiệu"
 * kể cả khi nguồn không gửi gì nữa (mất kết nối). undefined nếu không còn tag tươi.
 */
export function nextExpiry(data: LiveData | undefined, now: number = Date.now()): number | undefined {
  let next: number | undefined;
  for (const tv of Object.values(data ?? {})) {
    if (tv.quality === 'bad') continue;
    const at = tv.ts + STALE_MS;
    if (at > now && (next === undefined || at < next)) next = at;
  }
  return next;
}
