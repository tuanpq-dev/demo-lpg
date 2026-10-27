/*
 * Kịch bản giả lập CHỈ DÀNH CHO DEV – nạp bằng `import()` sau điều kiện `import.meta.env.DEV` ở `data/live/index.ts`, nên
 * KHÔNG có trong bản build production (Vite thay `import.meta.env.DEV` = false → nhánh và chunk này bị loại bỏ). Trên production
 * tham số `?live=` bị bỏ qua.
 *
 * `?live=disconnect` · `?live=bad:LT-101,TT-201` · `?live=stale:FT-101` (ngừng cập nhật → sau 10 s mất tín hiệu) – ghép bằng `;`.
 * Khí gas GS-04 (ALT-00127): `?live=gas-rise` tăng dần từ 25 lên 46 % LEL (qua ESD 40 – thử banner) · `?live=gas-clear` giảm dần
 * về 6 % LEL (dưới cấp 1 – thử "Đã xử lý xong").
 * Báo cháy HD-02 (FIR-00018): `?live=fire-clear` đầu báo phục hồi + nhiệt độ giảm về 32 °C (thử đóng) · `?live=fire-cross` khói
 * SD-02 báo động (banner xác nhận chéo) · `?live=fire-mcp` nút nhấn khẩn cấp kích hoạt.
 */
import { VAPORIZER_AREA_TAGS } from '@/features/live/tags';
import type { MockLiveSource } from './MockLiveSource';

/** Dời giá trị nền của tag từng bước 1,5 mỗi 2 s tới `to` (số live đi theo, không nhảy cóc). */
export function rampBase(mock: MockLiveSource, tag: string, to: number, step = 1.5) {
  const timer = window.setInterval(() => {
    const cur = mock.baseOf(tag);
    if (typeof cur !== 'number') return window.clearInterval(timer);
    const next = cur < to ? Math.min(to, cur + step) : Math.max(to, cur - step);
    mock.setBase(tag, Math.round(next * 10) / 10);
    if (next === to) window.clearInterval(timer);
  }, 2000);
}

/** Đọc `?live=` trên URL hiện tại và áp vào nguồn mock. */
export function applyUrlSimulation(mock: MockLiveSource, search: string = window.location.search) {
  const spec = new URLSearchParams(search).get('live');
  if (!spec) return;
  for (const part of spec.split(';')) {
    const [kind, list = ''] = part.split(':');
    const tags = list.split(',').filter(Boolean);
    if (kind === 'disconnect') mock.simulateDisconnect(true);
    else if (kind === 'bad') mock.setQuality(tags, 'bad');
    else if (kind === 'stale') mock.freeze(tags);
    else if (kind === 'gas-rise') rampBase(mock, 'GS-04', 46);
    else if (kind === 'gas-clear') rampBase(mock, 'GS-04', 6);
    else if (kind === 'fire-clear') {
      mock.setBase(VAPORIZER_AREA_TAGS.heatAlarm, 'normal');
      rampBase(mock, VAPORIZER_AREA_TAGS.heatTemp, 32, 4);
    } else if (kind === 'fire-cross') mock.setBase(VAPORIZER_AREA_TAGS.smokeAlarm, 'alarm');
    else if (kind === 'fire-mcp') mock.setBase(VAPORIZER_AREA_TAGS.callPoint, 'activated');
  }
}
