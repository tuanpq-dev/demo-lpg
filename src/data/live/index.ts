import { useEffect, useState, useSyncExternalStore } from 'react';
import { nextExpiry } from '@/features/live/signal';
import type { LiveData, LiveDataSource, LiveSourceStatus, LiveValue } from '@/features/live/types';
import { liveBase, liveJitter, liveUnit } from '@/mocks/scenes/live';
import { MockLiveSource } from './MockLiveSource';

/*
 * Lớp dữ liệu trực tiếp: MỘT nguồn dùng chung cho cả app (`liveSource`), UI chỉ đọc qua `useLiveData` /
 * `useLiveStatus`. Khi có backend: thay `new MockLiveSource(...)` bằng `new WebSocketLiveSource(url)` (cùng interface
 * LiveDataSource trong features/live/types.ts) – không sửa UI.
 */

const mock = new MockLiveSource({ base: liveBase, jitter: liveJitter, unit: liveUnit, intervalMs: 2000 });

export const liveSource: LiveDataSource = mock;

/**
 * Giả lập qua URL (`?live=…`) + kịch bản tăng/giảm dần: CHỈ DEV, nạp động (`./devScenarios`) – bản build production không có
 * mã/chuỗi kịch bản và bỏ qua `?live=`. Danh sách tham số: xem đầu file devScenarios.ts.
 */
if (import.meta.env.DEV && typeof window !== 'undefined') void import('./devScenarios').then((m) => m.applyUrlSimulation(mock));

/** Điều khiển giả lập (playground, test). Chỉ có với nguồn mock. */
export const liveSimulator = {
  disconnect: (on: boolean) => mock.simulateDisconnect(on),
  setBad: (tags: readonly string[], bad = true) => mock.setQuality(tags, bad ? 'bad' : 'good'),
  freeze: (tags: readonly string[], frozen = true) => mock.freeze(tags, frozen),
  restore: () => mock.restore(),
  /** CHỈ DEV (production: không làm gì): dời giá trị nền dần tới `to` (playground "Mô phỏng nồng độ"). */
  rampTo: (tag: string, to: number) => {
    if (import.meta.env.DEV) void import('./devScenarios').then((m) => m.rampBase(mock, tag, to));
  },
  /** Đặt giá trị nền ngay (số live theo từ bước kế tiếp, ≤ 2 s) – test. */
  setBase: (tag: string, value: LiveValue) => mock.setBase(tag, value),
  get state() {
    return mock.simulation;
  },
};

// Dev: test tương tác điều khiển nguồn (playwright).
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __liveSource: mock, __liveSimulator: liveSimulator });

/**
 * Số liệu trực tiếp của `tags` (bỏ trống = mọi tag) dạng `LiveData` (TagValue: value, unit, ts, quality).
 * - Chưa nhận ảnh chụp đầu tiên → undefined (UI hiện "—", không báo mất tín hiệu).
 * - Tự vẽ lại đúng lúc tag tươi nhất kế tiếp quá hạn 10 s (kể cả khi nguồn im lặng do mất kết nối) – UI tính
 *   "Mất tín hiệu" bằng `tagSignal(tv, Date.now())` lúc render.
 * - `enabled = false` → không đăng ký, trả về undefined.
 */
export function useLiveData(tags?: readonly string[], { enabled = true }: { enabled?: boolean } = {}): LiveData | undefined {
  const key = tags ? [...tags].sort().join('|') : '*';
  const [data, setData] = useState<LiveData>();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setData(undefined);
      return;
    }
    return liveSource.subscribe(tags ?? null, setData);
    // `key` đại diện `tags`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled || !data) return;
    const at = nextExpiry(data);
    if (at === undefined) return;
    const t = window.setTimeout(() => setTick((n) => n + 1), at - Date.now() + 50);
    return () => window.clearTimeout(t);
  });

  return enabled ? data : undefined;
}

/** Trạng thái kết nối của nguồn (header "Dữ liệu trực tiếp"). Nghe trạng thái cũng giữ kết nối mở. */
export function useLiveStatus(): LiveSourceStatus {
  return useSyncExternalStore(subscribeStatus, readStatus);
}
// Hàm cố định: useSyncExternalStore đăng ký lại mỗi khi `subscribe` đổi tham chiếu (huỷ → nguồn ngắt kết nối).
const subscribeStatus = (cb: () => void) => liveSource.onStatusChange(cb);
const readStatus = () => liveSource.status;

/** Mọi tag cảm biến đã biết (Editor chọn binding). Khi có API: GET /api/tags. */
export const SENSOR_TAGS: readonly string[] = Object.keys(liveBase).sort();
