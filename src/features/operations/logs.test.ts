import { describe, expect, it } from 'vitest';
import { parsePlantDateTime } from '@/lib/plantTime';
import {
  alertLogLevel,
  alertLogStatus,
  alertToLogEvent,
  byNewestEvent,
  deriveLogKpis,
  distinctLogOptions,
  inLogRange,
  logTimeText,
  logsToCsv,
  matchLogEvent,
  shiftDayKey,
  type LogFilterValues,
  type OperationLogEvent,
} from './logs';

const at = (s: string) => parsePlantDateTime(s)!.toISOString();
const NOW = parsePlantDateTime('2026-11-02T10:30:00')!;

let n = 0;
function ev(p: Partial<OperationLogEvent> & { at: string }): OperationLogEvent {
  n += 1;
  return {
    id: `e${n}`,
    code: `EV-${String(n).padStart(3, '0')}`,
    category: 'operation',
    level: 'info',
    title: 'Khởi động Bơm P-101A',
    area: 'Khu bơm',
    device: 'P-101A',
    status: 'done',
    ...p,
  };
}

const ALL: LogFilterValues = { q: '', range: 'today', area: null, category: null };

describe('shiftDayKey', () => {
  it('lùi qua đầu tháng / đầu năm', () => {
    expect(shiftDayKey('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDayKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDayKey('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('cảnh báo → nhật ký', () => {
  it('mức: nghiêm trọng/cao → Cao; trung bình/thấp → Trung bình', () => {
    expect(alertLogLevel('critical')).toBe('high');
    expect(alertLogLevel('high')).toBe('high');
    expect(alertLogLevel('medium')).toBe('medium');
    expect(alertLogLevel('low')).toBe('medium');
  });

  it('trạng thái', () => {
    expect(alertLogStatus('unacknowledged')).toBe('open');
    expect(alertLogStatus('in-progress')).toBe('in-progress');
    expect(alertLogStatus('resolved')).toBe('monitoring');
    expect(alertLogStatus('done')).toBe('done');
  });

  it('thời điểm = hôm nay − daysAgo lúc `time` (giờ nhà máy); giữ mã cảnh báo + link', () => {
    const e = alertToLogEvent(
      {
        id: 'ALT-1',
        code: 'ALT-00001',
        daysAgo: 1,
        time: '23:59:30',
        severity: 'critical',
        message: 'Áp suất cao',
        device: 'V-101',
        area: 'Khu bồn LPG',
        status: 'unacknowledged',
        assignee: null,
      },
      NOW,
    );
    expect(e.at).toBe(at('2026-11-01T23:59:30'));
    expect(e).toMatchObject({ code: 'ALT-00001', category: 'alert', level: 'high', status: 'open', alertId: 'ALT-1', actor: undefined });
  });
});

describe('inLogRange', () => {
  it('hôm nay: từ 00:00 tới `now`; sự kiện tương lai bị loại', () => {
    expect(inLogRange({ at: at('2026-11-02T00:00:00') }, 'today', NOW)).toBe(true);
    expect(inLogRange({ at: at('2026-11-02T10:30:00') }, 'today', NOW)).toBe(true);
    expect(inLogRange({ at: at('2026-11-02T10:30:01') }, 'today', NOW)).toBe(false);
    expect(inLogRange({ at: at('2026-11-01T23:59:59') }, 'today', NOW)).toBe(false);
  });

  it('7 ngày = hôm nay + 6 ngày trước', () => {
    expect(inLogRange({ at: at('2026-10-27T00:00:00') }, '7d', NOW)).toBe(true);
    expect(inLogRange({ at: at('2026-10-26T23:59:59') }, '7d', NOW)).toBe(false);
    expect(inLogRange({ at: at('2026-10-04T08:00:00') }, '30d', NOW)).toBe(true);
    expect(inLogRange({ at: at('2026-10-03T08:00:00') }, '30d', NOW)).toBe(false);
  });
});

describe('deriveLogKpis', () => {
  const events = [
    ev({ at: at('2026-11-02T08:00:00') }),
    ev({ at: at('2026-11-02T09:00:00') }),
    ev({ at: at('2026-11-02T09:10:00'), category: 'alert', status: 'open' }),
    ev({ at: at('2026-11-02T09:20:00'), category: 'alert', status: 'done' }),
    ev({ at: at('2026-11-02T09:30:00'), category: 'user-action', actor: 'Lê Thị C' }),
    ev({ at: at('2026-11-02T09:40:00'), category: 'user-action', actor: 'Lê Thị C' }),
    ev({ at: at('2026-11-02T09:50:00'), category: 'user-action', actor: 'Trần Văn B' }),
    ev({ at: at('2026-11-02T10:00:00'), category: 'connection', status: 'open', device: 'FT-102' }),
    ev({ at: at('2026-11-02T10:05:00'), category: 'connection', status: 'open', device: 'FT-102' }),
    ev({ at: at('2026-11-02T10:10:00'), category: 'connection', status: 'done', device: 'GS-06' }),
    // Tương lai – không đếm.
    ev({ at: at('2026-11-02T11:00:00'), category: 'alert', status: 'open' }),
    // Hôm qua: 2 sự kiện trước 10:30, 1 sau 10:30 (không so).
    ev({ at: at('2026-11-01T07:00:00') }),
    ev({ at: at('2026-11-01T10:30:00') }),
    ev({ at: at('2026-11-01T15:00:00') }),
  ];

  it('đếm theo loại, % vận hành, cảnh báo chưa xử lý, người dùng, thiết bị cần kiểm tra (đếm thiết bị khác nhau)', () => {
    expect(deriveLogKpis(events, 'today', NOW)).toEqual({
      total: 10,
      delta: 8,
      operation: 2,
      operationShare: 20,
      alerts: 2,
      alertsOpen: 1,
      userActions: 3,
      activeUsers: 2,
      connectionIssues: 1,
    });
  });

  it('khoảng khác hôm nay → không có chênh lệch; gồm cả hôm qua', () => {
    const k = deriveLogKpis(events, '7d', NOW);
    expect(k.delta).toBeNull();
    expect(k.total).toBe(13);
  });

  it('danh sách rỗng → 0, không chia cho 0', () => {
    expect(deriveLogKpis([], 'today', NOW)).toMatchObject({ total: 0, delta: 0, operationShare: 0, activeUsers: 0 });
  });

  it('ít hơn hôm qua → chênh lệch âm', () => {
    const k = deriveLogKpis([ev({ at: at('2026-11-01T08:00:00') }), ev({ at: at('2026-11-01T09:00:00') })], 'today', NOW);
    expect(k.delta).toBe(-2);
  });
});

describe('matchLogEvent', () => {
  const e = ev({
    at: at('2026-11-02T09:00:00'),
    title: 'Đóng van cấp tuyến chính XV-101',
    area: 'Tuyến chính',
    device: 'XV-101',
    category: 'user-action',
    actor: 'Phạm Văn D',
  });

  it('tìm không dấu theo nội dung / mã / thiết bị / người', () => {
    expect(matchLogEvent(e, { ...ALL, q: 'dong van' }, NOW)).toBe(true);
    expect(matchLogEvent(e, { ...ALL, q: 'xv-101' }, NOW)).toBe(true);
    expect(matchLogEvent(e, { ...ALL, q: e.code.toLowerCase() }, NOW)).toBe(true);
    expect(matchLogEvent(e, { ...ALL, q: 'pham van' }, NOW)).toBe(true);
    expect(matchLogEvent(e, { ...ALL, q: 'bơm' }, NOW)).toBe(false);
  });

  it('khu vực + loại + khoảng thời gian', () => {
    expect(matchLogEvent(e, { ...ALL, area: 'Tuyến chính', category: 'user-action' }, NOW)).toBe(true);
    expect(matchLogEvent(e, { ...ALL, area: 'Khu bơm' }, NOW)).toBe(false);
    expect(matchLogEvent(e, { ...ALL, category: 'alert' }, NOW)).toBe(false);
    expect(matchLogEvent({ ...e, at: at('2026-11-01T09:00:00') }, ALL, NOW)).toBe(false);
  });
});

describe('sắp xếp / hiển thị', () => {
  it('mới nhất trước; cùng giờ → mã giảm dần', () => {
    const a = ev({ at: at('2026-11-02T09:00:00'), code: 'EV-1' });
    const b = ev({ at: at('2026-11-02T09:00:00'), code: 'EV-2' });
    const c = ev({ at: at('2026-11-02T10:00:00'), code: 'EV-0' });
    expect([a, b, c].sort(byNewestEvent).map((x) => x.code)).toEqual(['EV-0', 'EV-2', 'EV-1']);
  });

  it('giờ + nhãn ngày', () => {
    expect(logTimeText({ at: at('2026-11-02T08:05:09') }, NOW)).toEqual({ time: '08:05:09', day: null });
    expect(logTimeText({ at: at('2026-11-01T23:00:00') }, NOW)).toEqual({ time: '23:00:00', day: 'Hôm qua' });
    expect(logTimeText({ at: at('2026-10-30T07:00:00') }, NOW)).toEqual({ time: '07:00:00', day: '30/10/2026' });
  });

  it('lựa chọn lọc duy nhất, sắp theo tiếng Việt', () => {
    expect(distinctLogOptions(['Tuyến chính', 'Khu bơm', 'Khu bơm']).map((o) => o.value)).toEqual(['Khu bơm', 'Tuyến chính']);
  });

  it('CSV: BOM, CRLF, thoát dấu nháy', () => {
    const csv = logsToCsv([ev({ at: at('2026-11-02T09:00:00'), title: 'Van "XV-101" mở', actor: 'Lê Thị C', status: 'recorded' })]);
    expect(csv.startsWith('﻿"Ngày","Thời gian"')).toBe(true);
    const [, line] = csv.split('\r\n');
    expect(line).toContain('"02/11/2026","09:00:00","Thông tin"');
    expect(line).toContain('"Van ""XV-101"" mở"');
    expect(line).toContain('"Ghi nhận","Lê Thị C"');
  });
});
