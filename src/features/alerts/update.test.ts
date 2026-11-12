import { describe, expect, test } from 'vitest';
import { followUpDue, followUpLabel, followUpWindow } from './followUp';
import { parseUpdateDraft, readingTone, updateCloseCheck, updateStateOf, type CloseRuleInput } from './update';

const base: CloseRuleInput = { liveState: 'ok', live: 9.5, after: 9.5, source: 'sensor', limit: 10.5, unit: 'bar' };
const SAVED = new Date('2026-10-27T03:00:00Z'); // 10:00 giờ nhà máy

describe('điều kiện chọn "Đã xử lý" theo loại', () => {
  test('áp suất: số live phải dưới ngưỡng; mất tín hiệu bắt buộc nguồn có đồng hồ cơ + số đo tay', () => {
    expect(updateCloseCheck({ rule: 'pressure' }, base)).toEqual({ ok: true, value: 9.5, basis: 'live' });
    expect(updateCloseCheck({ rule: 'pressure' }, { ...base, live: 10.8 })).toMatchObject({ ok: false, reason: 'live-high' });
    expect(updateCloseCheck({ rule: 'pressure' }, { ...base, liveState: 'lost', live: undefined })).toMatchObject({
      ok: false,
      reason: 'need-gauge',
    });
    expect(updateCloseCheck({ rule: 'pressure' }, { ...base, liveState: 'lost', live: undefined, source: 'gauge', after: 9 })).toEqual({
      ok: true,
      value: 9,
      basis: 'measured',
    });
  });

  test('gas: số đo tay chỉ tính khi `manual`; trên ngưỡng → chặn', () => {
    const gas = { rule: 'gas' as const, closeBelow: 'level-1' as const };
    expect(updateCloseCheck(gas, { ...base, live: 4, limit: 10, unit: '%LEL' })).toEqual({ ok: true, value: 4, basis: 'live' });
    expect(updateCloseCheck(gas, { ...base, live: 12, limit: 10, unit: '%LEL' })).toMatchObject({ ok: false, reason: 'above' });
    expect(
      updateCloseCheck(gas, { ...base, liveState: 'lost', live: undefined, source: 'both', manual: true, after: 3, limit: 10, unit: '%LEL' }),
    ).toEqual({ ok: true, value: 3, basis: 'measured' });
  });

  test('cháy: đầu báo phục hồi → đạt; mất tín hiệu cần xác nhận kiểm tra tại chỗ', () => {
    const fire = { rule: 'fire' as const };
    const detector = (alarm: 'active' | 'cleared' | 'unknown') => ({ ...base, detector: { alarm, device: 'online' as const, name: 'FD-01' } });
    expect(updateCloseCheck(fire, detector('cleared'))).toEqual({ ok: true, basis: 'live' });
    expect(updateCloseCheck(fire, detector('active'))).toMatchObject({ ok: false, reason: 'still-alarm' });
    expect(updateCloseCheck(fire, detector('unknown'))).toMatchObject({ ok: false, reason: 'need-field-check' });
    expect(updateCloseCheck(fire, { ...detector('unknown'), fieldChecked: true })).toEqual({ ok: true, basis: 'field' });
  });
});

describe('trạng thái + màu số', () => {
  test('ô trạng thái suy từ bản ghi; thiếu phase = Đang kiểm tra', () => {
    expect(updateStateOf({ status: 'in-progress' })).toBe('inspecting');
    expect(updateStateOf({ status: 'in-progress', phase: 'resolving', hold: { kind: 'paused', reason: 'x', at: '' } })).toBe('paused');
    expect(updateStateOf({ status: 'done', resolution: { kind: 'false-alarm', closedBy: 'live' } })).toBe('false-alarm');
    expect(updateStateOf({ status: 'resolved' })).toBe('resolved');
  });

  test('màu theo ngưỡng cấu hình', () => {
    expect(readingTone(12, 10, 11)).toBe('danger');
    expect(readingTone(10.2, 10, 11)).toBe('warning');
    expect(readingTone(9, 10, 11)).toBe('normal');
    expect(readingTone(undefined, 10, 11)).toBe('normal');
  });
});

describe('theo dõi sau xử lý', () => {
  test('khoảng theo dõi: 0 → không theo dõi; tùy chỉnh phải sau lúc lưu', () => {
    expect(followUpWindow(0, undefined, SAVED)).toBeNull();
    expect(followUpWindow(30, undefined, SAVED)?.until.toISOString()).toBe('2026-10-27T03:30:00.000Z');
    expect(followUpWindow('custom', '2026-10-27T02:00:00Z', SAVED)).toBeNull();
    expect(followUpWindow('custom', '2026-10-27T04:30:00Z', SAVED)?.minutes).toBe(90);
  });

  test('nhãn chỉ khi chưa hết giờ; hết giờ mà vẫn chờ đóng → "Đến giờ kiểm tra lại"', () => {
    const followUp = { minutes: 30, until: '2026-10-27T03:30:00.000Z', target: 10, unit: 'bar', owner: 'A' };
    expect(followUpLabel({ status: 'resolved', followUp }, SAVED)).toBe('Đang theo dõi đến 10:30, mục tiêu < 10 bar');
    const later = new Date('2026-10-27T03:31:00Z');
    expect(followUpLabel({ status: 'resolved', followUp }, later)).toBeNull();
    expect(followUpDue({ status: 'resolved', followUp }, later)).toBe(true);
    expect(followUpDue({ status: 'done', followUp }, later)).toBe(false);
  });
});

describe('nháp form', () => {
  const draft = {
    state: 'resolving',
    holdReason: '',
    supportPeople: [],
    inspection: {},
    readings: { source: 'sensor', at: '2026-10-27T10:00', rows: [] },
    verification: [],
    cause: '',
    actionTaken: '',
    issue: { kind: 'none', note: '' },
    followUp: { choice: 30, owner: '' },
    savedAt: '2026-10-27T03:00:00Z',
  };
  test('đúng dạng → giữ; sai dạng → null (coi như không có nháp)', () => {
    expect(parseUpdateDraft(draft)).toEqual(draft);
    expect(parseUpdateDraft({ ...draft, state: 'bogus' })).toBeNull();
    expect(parseUpdateDraft({ ...draft, readings: { ...draft.readings, source: 'x' } })).toBeNull();
    expect(parseUpdateDraft({ ...draft, followUp: { choice: '30' } })).toBeNull();
    expect(parseUpdateDraft('{}')).toBeNull();
  });
});
