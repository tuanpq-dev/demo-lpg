import { describe, expect, test } from 'vitest';
import { ALERT_KINDS, type PressureUpdateConfig } from '@/mocks/alertKinds';
import type { AlertRecord } from '@/mocks/alerts';
import {
  canClosePressure,
  followUpLabel,
  followUpUntil,
  followUpWindow,
  parsePressureDraft,
  pressureStateFields,
  pressureStateOf,
  pressureUpdate,
  pressureWarnings,
  readingTone,
  suggestsSupport,
  validatePressureUpdate,
  verificationErrors,
  type CloseInput,
  type PressureCheck,
  type PressureUpdateInput,
} from './pressure';
import { acknowledgeAlert } from './workflow';

const cfg = ALERT_KINDS['tank-overpressure'].update as PressureUpdateConfig;
const ctx = { by: 'Nguyễn Văn A', at: new Date('2026-10-28T07:06:00Z') }; // 14:06 giờ nhà máy
const alert = (patch: Partial<AlertRecord> = {}): AlertRecord => ({
  id: 'ALT-00128',
  code: 'ALT-00128',
  daysAgo: 0,
  time: '10:45:22',
  severity: 'critical',
  message: 'Áp suất bồn V-101 vượt ngưỡng',
  device: 'V-101',
  area: 'Khu bồn LPG',
  value: '11.8',
  threshold: '10.5',
  unit: 'bar',
  status: 'in-progress',
  assignee: 'Nguyễn Văn A',
  phase: 'inspecting',
  ...patch,
});
const steps = [
  { id: 'field-gauge', text: 'Đối chiếu PT-101 với đồng hồ cơ' },
  { id: 'regulator', text: 'Kiểm tra bộ điều áp PR-101' },
];
const texts: Record<string, string> = {
  'over-confirmed': 'Xác nhận áp suất thực tế vượt ngưỡng',
  'back-to-normal': 'Hệ thống đã trở về bình thường',
};
const closeIn = (p: Partial<CloseInput> = {}): CloseInput => ({ liveState: 'ok', live: 9.2, after: 9.2, source: 'sensor', warn: 10.5, unit: 'bar', ...p });
const check = (close = canClosePressure(closeIn())): PressureCheck => ({ close, config: cfg, steps, verificationText: (id) => texts[id] ?? id, unit: 'bar' });
const input = (p: Partial<PressureUpdateInput> = {}): PressureUpdateInput => ({
  state: 'resolving',
  holdReason: '',
  supportPeople: [],
  inspection: {},
  readings: { source: 'sensor', at: ctx.at.toISOString(), rows: [{ id: 'pressure', before: 11.8, after: 9.2 }] },
  verification: [],
  cause: '',
  actionTaken: '',
  issue: { kind: 'none', note: '' },
  files: [],
  followUp: { choice: 30, target: 10, owner: 'Nguyễn Văn A' },
  ...p,
});
const resolvedInput = (p: Partial<PressureUpdateInput> = {}) =>
  input({ state: 'resolved', cause: 'Bộ điều áp kẹt', actionTaken: 'Vệ sinh, chỉnh lại PR-101', verification: ['back-to-normal'], ...p });

describe('map trạng thái xử lý', () => {
  test('bản ghi → 5 ô: done = Đã xử lý · hold thắng phase · thiếu phase = Đang kiểm tra', () => {
    expect(pressureStateOf({ status: 'done' })).toBe('resolved');
    expect(pressureStateOf({ status: 'in-progress', phase: 'resolving', hold: { kind: 'paused', reason: 'x', at: 'T' } })).toBe('paused');
    expect(pressureStateOf({ status: 'in-progress', hold: { kind: 'needs-support', reason: 'x', at: 'T' } })).toBe('needs-support');
    expect(pressureStateOf({ status: 'in-progress', phase: 'resolving' })).toBe('resolving');
    expect(pressureStateOf({ status: 'in-progress' })).toBe('inspecting');
  });
  test('5 ô → trường bản ghi', () => {
    expect(pressureStateFields('inspecting', '', 'T')).toEqual({ status: 'in-progress', phase: 'inspecting', hold: undefined });
    expect(pressureStateFields('resolving', '', 'T')).toEqual({ status: 'in-progress', phase: 'resolving', hold: undefined });
    expect(pressureStateFields('paused', ' Chờ vật tư ', 'T')).toEqual({ status: 'in-progress', hold: { kind: 'paused', reason: 'Chờ vật tư', at: 'T' } });
    expect(pressureStateFields('needs-support', 'Cần thêm người', 'T')).toEqual({ status: 'in-progress', hold: { kind: 'needs-support', reason: 'Cần thêm người', at: 'T' } });
    expect(pressureStateFields('resolved', '', 'T')).toEqual({ status: 'done', hold: undefined });
  });
  test('xác nhận cảnh báo → phase mặc định = inspecting', () => {
    expect(pressureStateOf(acknowledgeAlert(alert({ status: 'unacknowledged', phase: undefined }), ctx))).toBe('inspecting');
  });
});

describe('điều kiện "Đã xử lý"', () => {
  test('live < ngưỡng VÀ sau xử lý < ngưỡng → đóng được', () => {
    expect(canClosePressure(closeIn())).toEqual({ ok: true, value: 9.2 });
  });
  test('live còn ≥ ngưỡng → khoá, kể cả khi số đo tay dưới ngưỡng (ranh giới = ngưỡng cũng khoá)', () => {
    expect(canClosePressure(closeIn({ live: 10.5, after: 9 })).ok).toBe(false);
    const c = canClosePressure(closeIn({ live: 11.2, after: 9, source: 'both' }));
    expect(c).toMatchObject({ ok: false, reason: 'live-high' });
  });
  test('sau xử lý ≥ ngưỡng (ảnh 10.8 bar) hoặc trống → khoá', () => {
    expect(canClosePressure(closeIn({ after: 10.8, source: 'both' }))).toMatchObject({ ok: false, reason: 'after-high' });
    expect(canClosePressure(closeIn({ after: undefined }))).toMatchObject({ ok: false, reason: 'need-after' });
  });
  test('mất tín hiệu: nguồn chỉ cảm biến → khoá; có đồng hồ cơ → bắt buộc số đo tay < ngưỡng', () => {
    expect(canClosePressure(closeIn({ liveState: 'lost', live: undefined, after: undefined }))).toMatchObject({ ok: false, reason: 'need-gauge' });
    expect(canClosePressure(closeIn({ liveState: 'lost', live: undefined, after: undefined, source: 'gauge' }))).toMatchObject({ ok: false, reason: 'need-after' });
    expect(canClosePressure(closeIn({ liveState: 'lost', live: undefined, after: 11, source: 'both' }))).toMatchObject({ ok: false, reason: 'after-high' });
    expect(canClosePressure(closeIn({ liveState: 'lost', live: undefined, after: 9.8, source: 'gauge' }))).toEqual({ ok: true, value: 9.8 });
    // không có tag = như mất tín hiệu
    expect(canClosePressure(closeIn({ liveState: 'none', live: undefined, after: 9.8, source: 'gauge' })).ok).toBe(true);
  });
  test('đang đọc số đầu tiên → khoá (không một nhịp chọn được)', () => {
    expect(canClosePressure(closeIn({ liveState: 'pending', live: undefined }))).toMatchObject({ ok: false, reason: 'pending' });
  });
  test('màu số theo ngưỡng cấu hình', () => {
    expect(readingTone(11.8, 10.5, 12)).toBe('warning');
    expect(readingTone(12, 10.5, 12)).toBe('danger');
    expect(readingTone(9.2, 10.5, 12)).toBe('normal');
    expect(readingTone(4.2)).toBe('normal');
    expect(readingTone(undefined, 10.5)).toBe('normal');
  });
});

describe('kết quả xác minh mâu thuẫn bị chặn', () => {
  const t = (id: string) => texts[id] ?? id;
  test('"Hệ thống đã trở về bình thường" khi chưa đủ điều kiện', () => {
    expect(verificationErrors(['back-to-normal'], cfg, false, 'resolving', t)).toEqual([
      'Chỉ chọn "Hệ thống đã trở về bình thường" khi áp suất hiện tại và sau xử lý đều dưới ngưỡng cảnh báo.',
    ]);
  });
  test('cùng lúc với "Xác nhận áp suất thực tế vượt ngưỡng"', () => {
    expect(verificationErrors(['over-confirmed', 'back-to-normal'], cfg, true, 'resolving', t)[0]).toMatch(/mâu thuẫn/);
  });
  test('Đã xử lý mà chưa chọn "trở về bình thường"', () => {
    expect(verificationErrors(['sensor-drift'], cfg, true, 'resolved', t)).toEqual(['Chọn "Hệ thống đã trở về bình thường" khi đánh dấu Đã xử lý.']);
    expect(verificationErrors(['back-to-normal'], cfg, true, 'resolved', t)).toEqual([]);
    expect(verificationErrors([], cfg, false, 'inspecting', t)).toEqual([]);
  });
});

describe('theo dõi sau xử lý + giờ kiểm tra lại', () => {
  test('giờ kiểm tra lại = lúc lưu + thời gian; 0 = không theo dõi', () => {
    expect(followUpUntil(ctx.at, 30).toISOString()).toBe('2026-10-28T07:36:00.000Z');
    expect(followUpWindow(120, undefined, ctx.at)).toEqual({ minutes: 120, until: new Date('2026-10-28T09:06:00Z') });
    expect(followUpWindow(0, undefined, ctx.at)).toBeNull();
  });
  test('Tùy chỉnh: phải sau lúc lưu; qua nửa đêm vẫn đúng', () => {
    expect(followUpWindow('custom', '2026-10-28T07:00:00.000Z', ctx.at)).toBeNull();
    expect(followUpWindow('custom', 'không-phải-ngày', ctx.at)).toBeNull();
    expect(followUpWindow('custom', '2026-10-28T17:30:00.000Z', ctx.at)?.minutes).toBe(624);
  });
  test('nhãn "Đang theo dõi đến HH:MM" chỉ khi đã đóng và chưa hết giờ', () => {
    const a = alert({ status: 'done', followUp: { minutes: 30, until: '2026-10-28T07:36:00.000Z', target: 10, unit: 'bar', owner: 'A' } });
    expect(followUpLabel(a, ctx.at)).toBe('Đang theo dõi đến 14:36, mục tiêu < 10 bar');
    expect(followUpLabel(a, new Date('2026-10-28T07:36:00Z'))).toBeNull();
    expect(followUpLabel({ ...a, status: 'in-progress' }, ctx.at)).toBeNull();
  });
});

describe('kiểm tra form', () => {
  test('Tạm dừng / Cần hỗ trợ bắt buộc lý do (+ người hỗ trợ)', () => {
    expect(validatePressureUpdate(input({ state: 'paused' }), check(), ctx.at)).toEqual({ holdReason: 'Nhập lý do tạm dừng.' });
    expect(validatePressureUpdate(input({ state: 'needs-support' }), check(), ctx.at)).toEqual({ supportPeople: 'Chọn người hỗ trợ.', holdReason: 'Nhập lý do cần hỗ trợ.' });
  });
  test('Đã xử lý: bắt buộc nguyên nhân + nội dung + điều kiện đóng; theo dõi tùy chỉnh sai giờ', () => {
    const e = validatePressureUpdate(input({ state: 'resolved', verification: ['back-to-normal'] }), check(canClosePressure(closeIn({ live: 11 }))), ctx.at);
    expect(e.cause).toBeTruthy();
    expect(e.actionTaken).toBeTruthy();
    expect(e.close).toMatch(/chưa dưới ngưỡng/);
    expect(e.verification).toMatch(/Chỉ chọn/);
    const f = validatePressureUpdate(resolvedInput({ followUp: { choice: 'custom', customAt: '2026-10-28T06:00:00Z', target: 10, owner: 'A' } }), check(), ctx.at);
    expect(f).toEqual({ followUp: 'Chọn thời điểm kiểm tra lại sau thời điểm lưu.' });
  });
  test('"Khác" bắt buộc mô tả; hạng mục "Có vấn đề" bắt buộc ghi chú', () => {
    const e = validatePressureUpdate(input({ issue: { kind: 'other', note: ' ' }, inspection: { regulator: { status: 'issue', note: '' } } }), check(), ctx.at);
    expect(e.issueNote).toBe('Mô tả vấn đề phát sinh.');
    expect(e.inspection).toEqual({ regulator: 'Nhập ghi chú cho hạng mục có vấn đề.' });
  });
  test('cảnh báo không chặn: nêu TÊN hạng mục "Có vấn đề" khi chọn Đã xử lý; gợi ý Cần hỗ trợ', () => {
    const w = pressureWarnings(resolvedInput({ inspection: { 'field-gauge': { status: 'pass', note: '' }, regulator: { status: 'issue', note: 'Kẹt cơ cấu' } } }), check());
    expect(w).toEqual(['Còn hạng mục "Có vấn đề": Kiểm tra bộ điều áp PR-101.']);
    expect(pressureWarnings(input({ inspection: { regulator: { status: 'issue', note: 'x' } } }), check())).toEqual([]);
    expect(suggestsSupport({ state: 'resolving', issue: { kind: 'need-staff', note: '' } }, cfg)).toBe(true);
    expect(suggestsSupport({ state: 'needs-support', issue: { kind: 'need-staff', note: '' } }, cfg)).toBe(false);
  });
});

describe('Lưu cập nhật', () => {
  test('Đang xử lý: hạng mục + thông số + một ghi chú + một dòng lịch sử; giữ Đang xử lý', () => {
    const r = pressureUpdate(alert(), input({ inspection: { 'field-gauge': { status: 'pass', note: 'Khớp nhau', by: 'Nguyễn Văn A', at: 'T' } }, cause: 'Bộ điều áp kẹt' }), check(), ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record).toMatchObject({ status: 'in-progress', phase: 'resolving', cause: 'Bộ điều áp kẹt', followUp: undefined });
    expect(r.record.guide).toEqual({ 'field-gauge': { status: 'pass', by: 'Nguyễn Văn A', at: 'T', note: 'Khớp nhau' } });
    expect(r.record.notes).toHaveLength(1);
    expect(r.record.history).toEqual([expect.objectContaining({ kind: 'update', text: 'Cập nhật xử lý: Đang xử lý' })]);
  });
  test('Cần hỗ trợ → người phối hợp + cờ; quay lại Đang xử lý → bỏ cờ, lịch sử "Tiếp tục"', () => {
    const r = pressureUpdate(alert(), input({ state: 'needs-support', supportPeople: ['Hoàng Minh E'], holdReason: 'Cần thêm người' }), check(), ctx);
    if (!r.ok) throw new Error('fail');
    expect(r.record.hold).toMatchObject({ kind: 'needs-support', reason: 'Cần thêm người' });
    expect(r.record.collaborators).toEqual(['Hoàng Minh E']);
    expect(r.record.history!.at(-1)).toMatchObject({ kind: 'hold', text: 'Cần hỗ trợ: Hoàng Minh E – Cần thêm người' });
    const back = pressureUpdate(r.record, input(), check(), ctx);
    if (!back.ok) throw new Error('fail');
    expect(back.record.hold).toBeUndefined();
    expect(back.record.history!.at(-1)!.text).toBe('Tiếp tục xử lý (Đang xử lý)');
  });
  test('Đã xử lý: done + theo dõi tự tính từ lúc lưu + tệp chỉ giữ tên/kích thước/loại', () => {
    const r = pressureUpdate(alert(), resolvedInput({ files: [{ name: 'a.jpg', size: 10, kind: 'image' }] }), check(), ctx);
    if (!r.ok) throw new Error('fail');
    expect(r.record).toMatchObject({ status: 'done', resolvedAt: ctx.at.toISOString(), closingReading: { value: 9.2, source: 'live' } });
    expect(r.record.followUp).toEqual({ minutes: 30, until: '2026-10-28T07:36:00.000Z', target: 10, unit: 'bar', owner: 'Nguyễn Văn A' });
    expect(r.record.attachments).toEqual([{ name: 'a.jpg', size: 10, kind: 'image', isTemp: true }]);
    expect(r.record.history!.at(-1)).toMatchObject({ kind: 'resolve', text: 'Đã xử lý – áp suất sau xử lý 9.2 bar (Cảm biến (SCADA)) · theo dõi đến 14:36, mục tiêu < 10 bar' });
  });
  test('bị chặn → không đổi bản ghi; không ở Đang xử lý → chặn', () => {
    const a = alert();
    const r = pressureUpdate(a, resolvedInput(), check(canClosePressure(closeIn({ live: 11 }))), ctx);
    expect(r.ok).toBe(false);
    expect(a.status).toBe('in-progress');
    expect(pressureUpdate(alert({ status: 'done' }), input(), check(), ctx)).toMatchObject({ ok: false, errors: { state: expect.any(String) } });
  });
  test('chạy lại hai lần: thêm 2 ghi chú + 2 dòng lịch sử, không trùng id', () => {
    const r1 = pressureUpdate(alert(), input(), check(), ctx);
    if (!r1.ok) throw new Error('fail');
    const r2 = pressureUpdate(r1.record, input(), check(), ctx);
    if (!r2.ok) throw new Error('fail');
    expect(new Set(r2.record.history!.map((h) => h.id)).size).toBe(2);
    expect(new Set(r2.record.notes!.map((n) => n.id)).size).toBe(2);
  });
});

describe('nháp', () => {
  test('nhận nháp đúng dạng, bỏ nháp sai dạng', () => {
    const { files: _files, ...rest } = input();
    expect(parsePressureDraft({ ...rest, savedAt: 'T' })).toMatchObject({ state: 'resolving' });
    expect(parsePressureDraft({ ...rest, state: 'xyz', savedAt: 'T' })).toBeNull();
    expect(parsePressureDraft({ ...rest, readings: { source: 'abc', rows: [] }, savedAt: 'T' })).toBeNull();
    expect(parsePressureDraft(null)).toBeNull();
    expect(parsePressureDraft('chuỗi')).toBeNull();
  });
});
