import { describe, expect, it } from 'vitest';
import { eventDaysAgo, inLogRange } from '@/features/operations/logs';
import * as tags from '@/features/live/tags';
import { parsePlantDateTime } from '@/lib/plantTime';
import { buildOperationLogs } from './operationLogs';

const NOW = parsePlantDateTime('2026-11-02T18:30:00')!;

/** Mọi tên tag trực tiếp (giá trị chuỗi trong các bảng tag của features/live/tags). */
function liveTagNames(): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.add(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(tags);
  return out;
}

describe('buildOperationLogs', () => {
  const logs = buildOperationLogs(NOW);

  it('xác định: cùng `now` → cùng dữ liệu; qua giờ mới chỉ thêm sự kiện, sự kiện cũ giữ nguyên', () => {
    expect(buildOperationLogs(NOW)).toEqual(logs);
    const later = buildOperationLogs(new Date(NOW.getTime() + 60 * 60_000));
    const byId = new Map(later.map((e) => [e.id, e]));
    // Bỏ kịch bản (lùi theo phút từ `now`) và sự kiện còn "mới" (trạng thái theo dõi đổi theo thời gian).
    const stable = logs.filter((e) => !e.id.startsWith('scenario') && NOW.getTime() - Date.parse(e.at) > 3 * 3_600_000);
    expect(stable.length).toBeGreaterThan(100);
    stable.forEach((e) => expect(byId.get(e.id)).toEqual(e));
  });

  it('không có sự kiện tương lai; id + mã không trùng', () => {
    expect(logs.every((e) => Date.parse(e.at) <= NOW.getTime())).toBe(true);
    expect(new Set(logs.map((e) => e.id)).size).toBe(logs.length);
    expect(new Set(logs.map((e) => e.code)).size).toBe(logs.length);
  });

  it('phủ 31 ngày; số sự kiện mỗi ngày đủ dày cho demo', () => {
    expect(Math.max(...logs.map((e) => eventDaysAgo(e, NOW)))).toBe(30);
    const yesterday = logs.filter((e) => eventDaysAgo(e, NOW) === 1).length;
    expect(yesterday).toBeGreaterThan(90);
    expect(yesterday).toBeLessThan(144);
    expect(logs.filter((e) => inLogRange(e, 'today', NOW)).length).toBeGreaterThan(60);
  });

  it('kịch bản: 2 thiết bị mất kết nối chưa xử lý – không phải tag trực tiếp (không mâu thuẫn số đo Tổng quan)', () => {
    const open = logs.filter((e) => e.category === 'connection' && e.status === 'open');
    expect(open.map((e) => e.device).sort()).toEqual(['FT-102', 'TT-305']);
    const live = liveTagNames();
    open.forEach((e) => expect(live.has(e.device)).toBe(false));
  });

  it('thao tác người dùng luôn có người thực hiện, tên nằm trong nội dung', () => {
    const users = logs.filter((e) => e.category === 'user-action');
    expect(users.length).toBeGreaterThan(0);
    users.forEach((e) => expect(e.title).toContain(e.actor!));
  });

  it('không sinh cảnh báo (cảnh báo lấy từ store chung)', () => {
    expect(logs.some((e) => e.category === 'alert')).toBe(false);
  });
});
