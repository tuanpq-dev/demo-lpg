import { describe, expect, test } from 'vitest';
import { ALERT_KINDS, type AlertUpdateConfig } from '@/mocks/alertKinds';
import type { AlertRecord } from '@/mocks/alerts';
import type { CloseInput } from './pressure';
import {
  alertUpdate,
  followUpDue,
  followUpLabel,
  followUpUntil,
  followUpWindow,
  parseUpdateDraft,
  readingTone,
  suggestsSupport,
  updateCloseCheck,
  updateStateFields,
  updateStateOf,
  updateWarnings,
  validateAlertUpdate,
  verificationErrors,
  type AlertUpdateInput,
  type UpdateCheck,
  type UpdateClose,
} from './update';
import { acknowledgeAlert } from './workflow';

// Chuyển từ pressure.test.ts (28/10/2026): khung chung áp dụng cho mọi loại – tên hàm đổi (pressureUpdate → alertUpdate…),
// kỳ vọng "Đã xử lý" đổi có chủ đích: status resolved (chờ đóng) thay cho done.
const cfg = ALERT_KINDS['tank-overpressure'].update as AlertUpdateConfig;
const gasCfg = ALERT_KINDS['gas-leak'].update as AlertUpdateConfig;
const fireCfg = ALERT_KINDS.fire.update as AlertUpdateConfig;
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
const pClose = (p: Partial<CloseInput> = {}): UpdateClose => updateCloseCheck(cfg.close, { ...closeIn(p), limit: closeIn(p).warn });
const check = (close: UpdateClose = pClose()): UpdateCheck => ({ close, config: cfg, steps, verificationText: (id) => texts[id] ?? id, unit: 'bar' });
const input = (p: Partial<AlertUpdateInput> = {}): AlertUpdateInput => ({
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
const resolvedInput = (p: Partial<AlertUpdateInput> = {}) =>
  input({ state: 'resolved', cause: 'Bộ điều áp kẹt', actionTaken: 'Vệ sinh, chỉnh lại PR-101', verification: ['back-to-normal'], ...p });

describe('map trạng thái xử lý', () => {
  test('bản ghi → ô: resolved / done = Đã xử lý (báo động giả → false-alarm) · hold thắng phase · thiếu phase = Đang kiểm tra', () => {
    expect(updateStateOf({ status: 'resolved' })).toBe('resolved');
    expect(updateStateOf({ status: 'done' })).toBe('resolved');
    expect(updateStateOf({ status: 'resolved', resolution: { kind: 'false-alarm', closedBy: 'live' } })).toBe('false-alarm');
    expect(updateStateOf({ status: 'in-progress', phase: 'resolving', hold: { kind: 'paused', reason: 'x', at: 'T' } })).toBe('paused');
    expect(updateStateOf({ status: 'in-progress', hold: { kind: 'needs-support', reason: 'x', at: 'T' } })).toBe('needs-support');
    expect(updateStateOf({ status: 'in-progress', phase: 'resolving' })).toBe('resolving');
    expect(updateStateOf({ status: 'in-progress' })).toBe('inspecting');
  });
  test('ô → trường bản ghi (Đã xử lý / Báo động giả = resolved, KHÔNG phải done)', () => {
    expect(updateStateFields('inspecting', '', 'T')).toEqual({ status: 'in-progress', phase: 'inspecting', hold: undefined });
    expect(updateStateFields('resolving', '', 'T')).toEqual({ status: 'in-progress', phase: 'resolving', hold: undefined });
    expect(updateStateFields('paused', ' Chờ vật tư ', 'T')).toEqual({ status: 'in-progress', hold: { kind: 'paused', reason: 'Chờ vật tư', at: 'T' } });
    expect(updateStateFields('needs-support', 'Cần thêm người', 'T')).toEqual({ status: 'in-progress', hold: { kind: 'needs-support', reason: 'Cần thêm người', at: 'T' } });
    expect(updateStateFields('resolved', '', 'T')).toEqual({ status: 'resolved', hold: undefined });
    expect(updateStateFields('false-alarm', '', 'T')).toEqual({ status: 'resolved', hold: undefined });
  });
  test('xác nhận cảnh báo → phase mặc định = inspecting', () => {
    expect(updateStateOf(acknowledgeAlert(alert({ status: 'unacknowledged', phase: undefined }), ctx))).toBe('inspecting');
  });
});

describe('điều kiện "Đã xử lý" theo loại (giữ nguyên như modal cũ)', () => {
  test('áp suất: qua canClosePressure (chi tiết ở pressure.test.ts); căn cứ live / đo tay', () => {
    expect(pClose()).toEqual({ ok: true, value: 9.2, basis: 'live' });
    expect(pClose({ source: 'gauge', after: 9.8 })).toEqual({ ok: true, value: 9.8, basis: 'measured' });
    expect(pClose({ live: 11 })).toMatchObject({ ok: false, reason: 'live-high' });
  });
  test('gas: live < đầu mức cấp 1; mất tín hiệu → cần nguồn có máy đo cầm tay + số đo lại < ngưỡng; đang đọc → khoá', () => {
    const g = (p: Partial<Parameters<typeof updateCloseCheck>[1]>) => updateCloseCheck(gasCfg.close, { liveState: 'ok', live: 6, source: 'sensor', limit: 10, unit: '% LEL', ...p });
    expect(g({})).toEqual({ ok: true, value: 6, basis: 'live' });
    expect(g({ live: 25 })).toMatchObject({ ok: false, reason: 'above' });
    expect(g({ live: 10 })).toMatchObject({ ok: false, reason: 'above' });
    expect(g({ liveState: 'pending', live: undefined })).toMatchObject({ ok: false, reason: 'pending' });
    expect(g({ liveState: 'lost', live: undefined })).toMatchObject({ ok: false, reason: 'need-gauge' });
    expect(g({ liveState: 'lost', live: undefined, source: 'gauge' })).toMatchObject({ ok: false, reason: 'need-measure' });
    expect(g({ liveState: 'lost', live: undefined, source: 'gauge', after: 12, manual: true })).toMatchObject({ ok: false, reason: 'measured-above' });
    expect(g({ liveState: 'lost', live: undefined, source: 'gauge', after: 3, manual: true })).toEqual({ ok: true, value: 3, basis: 'measured' });
    // live dưới nhưng số đo tay vẫn trên → khoá
    expect(g({ source: 'both', after: 15, manual: true })).toMatchObject({ ok: false, reason: 'measured-above' });
  });
  test('cháy: đầu báo phải phục hồi; còn báo động → khoá (kể cả đã kiểm tra tại chỗ); mất tín hiệu → cần kiểm tra tại chỗ', () => {
    const f = (alarm: 'active' | 'cleared' | 'unknown', fieldChecked = false, device: 'online' | 'lost' | 'pending' = 'online') =>
      updateCloseCheck(fireCfg.close, { liveState: 'ok', source: 'sensor', limit: 57, unit: '°C', detector: { alarm, device, name: 'HD-02' }, fieldChecked });
    expect(f('cleared')).toEqual({ ok: true, basis: 'live' });
    expect(f('active', true)).toMatchObject({ ok: false, reason: 'still-alarm' });
    expect(f('unknown', false, 'lost')).toMatchObject({ ok: false, reason: 'need-field-check' });
    expect(f('unknown', true, 'lost')).toEqual({ ok: true, basis: 'field' });
    expect(f('unknown', false, 'pending')).toMatchObject({ ok: false, reason: 'pending' });
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
  test('cháy: "Có cháy thật" mâu thuẫn với "Báo động giả"; "Đầu báo đã phục hồi" chỉ khi đủ điều kiện, không bắt buộc', () => {
    expect(verificationErrors(['real-fire'], fireCfg, true, 'false-alarm', (id) => (id === 'real-fire' ? 'Có cháy thật' : id))[0]).toBe('"Có cháy thật" mâu thuẫn với "Báo động giả" – bỏ một mục.');
    expect(verificationErrors(['real-fire'], fireCfg, true, 'resolved', (id) => id)).toEqual([]);
    expect(verificationErrors(['detector-restored'], fireCfg, false, 'resolving', (id) => id)[0]).toMatch(/^Chỉ chọn/);
    expect(verificationErrors([], fireCfg, true, 'resolved', (id) => id)).toEqual([]);
  });
  test('gas: không có mục ràng buộc', () => {
    expect(verificationErrors(['leak-found', 'area-normal'], gasCfg, false, 'resolved', (id) => id)).toEqual([]);
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
  // Đổi có chủ đích: nhãn hiện cả khi Đã xử lý (chờ đóng); không có mục tiêu số (cháy) → chỉ giờ.
  test('nhãn "Đang theo dõi đến HH:MM" khi Đã xử lý / Hoàn thành và chưa hết giờ; hết giờ + chờ đóng → "Đến giờ kiểm tra lại"', () => {
    const a = alert({ status: 'resolved', followUp: { minutes: 30, until: '2026-10-28T07:36:00.000Z', target: 10, unit: 'bar', owner: 'A' } });
    expect(followUpLabel(a, ctx.at)).toBe('Đang theo dõi đến 14:36, mục tiêu < 10 bar');
    expect(followUpLabel({ ...a, status: 'done' }, ctx.at)).toBe('Đang theo dõi đến 14:36, mục tiêu < 10 bar');
    expect(followUpLabel(a, new Date('2026-10-28T07:36:00Z'))).toBeNull();
    expect(followUpLabel({ ...a, status: 'in-progress' }, ctx.at)).toBeNull();
    expect(followUpLabel({ ...a, followUp: { ...a.followUp!, target: undefined } }, ctx.at)).toBe('Đang theo dõi đến 14:36');
    expect(followUpDue(a, ctx.at)).toBe(false);
    expect(followUpDue(a, new Date('2026-10-28T07:36:00Z'))).toBe(true);
    expect(followUpDue({ ...a, status: 'done' }, new Date('2026-10-28T08:00:00Z'))).toBe(false);
    expect(followUpDue({ ...a, followUp: undefined }, new Date('2026-10-28T08:00:00Z'))).toBe(false);
  });
});

describe('kiểm tra form', () => {
  test('Tạm dừng / Cần hỗ trợ bắt buộc lý do (+ người hỗ trợ)', () => {
    expect(validateAlertUpdate(input({ state: 'paused' }), check(), ctx.at)).toEqual({ holdReason: 'Nhập lý do tạm dừng.' });
    expect(validateAlertUpdate(input({ state: 'needs-support' }), check(), ctx.at)).toEqual({ supportPeople: 'Chọn người hỗ trợ.', holdReason: 'Nhập lý do cần hỗ trợ.' });
  });
  test('Đã xử lý: bắt buộc nguyên nhân + nội dung + điều kiện đóng; theo dõi tùy chỉnh sai giờ', () => {
    const e = validateAlertUpdate(input({ state: 'resolved', verification: ['back-to-normal'] }), check(pClose({ live: 11 })), ctx.at);
    expect(e.cause).toBeTruthy();
    expect(e.actionTaken).toBeTruthy();
    expect(e.close).toMatch(/chưa dưới ngưỡng/);
    expect(e.verification).toMatch(/Chỉ chọn/);
    const f = validateAlertUpdate(resolvedInput({ followUp: { choice: 'custom', customAt: '2026-10-28T06:00:00Z', target: 10, owner: 'A' } }), check(), ctx.at);
    expect(f).toEqual({ followUp: 'Chọn thời điểm kiểm tra lại sau thời điểm lưu.' });
  });
  test('"Khác" bắt buộc mô tả; hạng mục "Có vấn đề" bắt buộc ghi chú', () => {
    const e = validateAlertUpdate(input({ issue: { kind: 'other', note: ' ' }, inspection: { regulator: { status: 'issue', note: '' } } }), check(), ctx.at);
    expect(e.issueNote).toBe('Mô tả vấn đề phát sinh.');
    expect(e.inspection).toEqual({ regulator: 'Nhập ghi chú cho hạng mục có vấn đề.' });
  });
  test('cảnh báo không chặn: nêu TÊN hạng mục "Có vấn đề" khi chọn Đã xử lý; gợi ý Cần hỗ trợ', () => {
    const w = updateWarnings(resolvedInput({ inspection: { 'field-gauge': { status: 'pass', note: '' }, regulator: { status: 'issue', note: 'Kẹt cơ cấu' } } }), check());
    expect(w).toEqual(['Còn hạng mục "Có vấn đề": Kiểm tra bộ điều áp PR-101.']);
    expect(updateWarnings(input({ inspection: { regulator: { status: 'issue', note: 'x' } } }), check())).toEqual([]);
    expect(suggestsSupport({ state: 'resolving', issue: { kind: 'need-staff', note: '' } }, cfg)).toBe(true);
    expect(suggestsSupport({ state: 'needs-support', issue: { kind: 'need-staff', note: '' } }, cfg)).toBe(false);
  });
});

describe('Lưu cập nhật', () => {
  test('Đang xử lý: hạng mục + thông số + một ghi chú + một dòng lịch sử; giữ Đang xử lý', () => {
    const r = alertUpdate(alert(), input({ inspection: { 'field-gauge': { status: 'pass', note: 'Khớp nhau', by: 'Nguyễn Văn A', at: 'T' } }, cause: 'Bộ điều áp kẹt' }), check(), ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record).toMatchObject({ status: 'in-progress', phase: 'resolving', cause: 'Bộ điều áp kẹt', followUp: undefined });
    expect(r.record.guide).toEqual({ 'field-gauge': { status: 'pass', by: 'Nguyễn Văn A', at: 'T', note: 'Khớp nhau' } });
    expect(r.record.notes).toHaveLength(1);
    expect(r.record.history).toEqual([expect.objectContaining({ kind: 'update', text: 'Cập nhật xử lý: Đang xử lý' })]);
  });
  test('Cần hỗ trợ → người phối hợp + cờ; quay lại Đang xử lý → bỏ cờ, lịch sử "Tiếp tục"', () => {
    const r = alertUpdate(alert(), input({ state: 'needs-support', supportPeople: ['Hoàng Minh E'], holdReason: 'Cần thêm người' }), check(), ctx);
    if (!r.ok) throw new Error('fail');
    expect(r.record.hold).toMatchObject({ kind: 'needs-support', reason: 'Cần thêm người' });
    expect(r.record.collaborators).toEqual(['Hoàng Minh E']);
    expect(r.record.history!.at(-1)).toMatchObject({ kind: 'hold', text: 'Cần hỗ trợ: Hoàng Minh E – Cần thêm người' });
    const back = alertUpdate(r.record, input(), check(), ctx);
    if (!back.ok) throw new Error('fail');
    expect(back.record.hold).toBeUndefined();
    expect(back.record.history!.at(-1)!.text).toBe('Tiếp tục xử lý (Đang xử lý)');
  });
  test('Đã xử lý: resolved (chờ đóng) + người xử lý + theo dõi tự tính từ lúc lưu + tệp chỉ giữ tên/kích thước/loại', () => {
    const r = alertUpdate(alert(), resolvedInput({ files: [{ name: 'a.jpg', size: 10, kind: 'image' }] }), check(), ctx);
    if (!r.ok) throw new Error('fail');
    expect(r.record).toMatchObject({ status: 'resolved', resolvedAt: ctx.at.toISOString(), resolvedBy: 'Nguyễn Văn A', closingReading: { value: 9.2, source: 'live' } });
    expect(r.record.followUp).toEqual({ minutes: 30, until: '2026-10-28T07:36:00.000Z', target: 10, unit: 'bar', owner: 'Nguyễn Văn A' });
    expect(r.record.attachments).toEqual([{ name: 'a.jpg', size: 10, kind: 'image', isTemp: true }]);
    expect(r.record.history!.at(-1)).toMatchObject({ kind: 'resolve', text: 'Đã xử lý – áp suất sau xử lý 9.2 bar (Cảm biến (SCADA)) · theo dõi đến 14:36, mục tiêu < 10 bar' });
  });
  test('bị chặn → không đổi bản ghi; không ở Đang xử lý → chặn', () => {
    const a = alert();
    const r = alertUpdate(a, resolvedInput(), check(pClose({ live: 11 })), ctx);
    expect(r.ok).toBe(false);
    expect(a.status).toBe('in-progress');
    expect(alertUpdate(alert({ status: 'done' }), input(), check(), ctx)).toMatchObject({ ok: false, errors: { state: expect.any(String) } });
  });
  test('chạy lại hai lần: thêm 2 ghi chú + 2 dòng lịch sử, không trùng id', () => {
    const r1 = alertUpdate(alert(), input(), check(), ctx);
    if (!r1.ok) throw new Error('fail');
    const r2 = alertUpdate(r1.record, input(), check(), ctx);
    if (!r2.ok) throw new Error('fail');
    expect(new Set(r2.record.history!.map((h) => h.id)).size).toBe(2);
    expect(new Set(r2.record.notes!.map((n) => n.id)).size).toBe(2);
  });
});

describe('nháp', () => {
  test('nhận nháp đúng dạng, bỏ nháp sai dạng', () => {
    const { files: _files, ...rest } = input();
    expect(parseUpdateDraft({ ...rest, savedAt: 'T' })).toMatchObject({ state: 'resolving' });
    expect(parseUpdateDraft({ ...rest, state: 'xyz', savedAt: 'T' })).toBeNull();
    expect(parseUpdateDraft({ ...rest, readings: { source: 'abc', rows: [] }, savedAt: 'T' })).toBeNull();
    expect(parseUpdateDraft(null)).toBeNull();
    expect(parseUpdateDraft('chuỗi')).toBeNull();
  });
});

describe('khung chung – gas và cháy', () => {
  const gasAlert = alert({ id: 'ALT-00127', code: 'ALT-00127', kind: 'gas-leak', severity: 'high', device: 'GS-04', area: 'Khu nạp xuất', value: '25', threshold: '20', unit: '% LEL' });
  const fireAlert = alert({ id: 'FIR-00018', code: 'FIR-00018', kind: 'fire', device: 'HD-02', area: 'Trạm hóa hơi', value: '68', threshold: '57', unit: '°C' });
  const base = { cause: 'Khớp nối lỏng', actionTaken: 'Siết lại khớp nối', verification: [] as string[] };
  test('gas Đã xử lý: resolved + nồng độ sau xử lý (đo tay) + theo dõi mục tiêu < 10 % LEL', () => {
    const close = updateCloseCheck(gasCfg.close, { liveState: 'lost', source: 'gauge', after: 3, manual: true, limit: 10, unit: '% LEL' });
    const r = alertUpdate(
      gasAlert,
      input({ state: 'resolved', ...base, readings: { source: 'gauge', at: ctx.at.toISOString(), rows: [{ id: 'concentration', before: 25, after: 3, manual: true }] }, followUp: { choice: 30, target: 10, owner: 'A' } }),
      { close, config: gasCfg, steps: [], verificationText: (id) => id, unit: '% LEL' },
      ctx,
    );
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.record).toMatchObject({ status: 'resolved', closingReading: { value: 3, source: 'measured' }, followUp: { minutes: 30, target: 10, unit: '% LEL' } });
    expect(r.record.history!.at(-1)!.text).toBe('Đã xử lý – nồng độ sau xử lý 3% LEL (Máy đo cầm tay) · theo dõi đến 14:36, mục tiêu < 10% LEL');
  });
  test('gas: nồng độ còn trên ngưỡng → không lưu được Đã xử lý, bản ghi không đổi', () => {
    const close = updateCloseCheck(gasCfg.close, { liveState: 'ok', live: 25, source: 'sensor', limit: 10, unit: '% LEL' });
    const r = alertUpdate(gasAlert, input({ state: 'resolved', ...base }), { close, config: gasCfg, steps: [], verificationText: (id) => id, unit: '% LEL' }, ctx);
    expect(r).toMatchObject({ ok: false, errors: { close: expect.stringMatching(/vẫn trên ngưỡng/) } });
  });
  test('cháy: Đã xử lý sự cố / Báo động giả → resolved + resolution; theo dõi KHÔNG có mục tiêu số; mất tín hiệu + kiểm tra tại chỗ → field', () => {
    const chk = (alarm: 'cleared' | 'unknown', fieldChecked: boolean): UpdateCheck => ({
      close: updateCloseCheck(fireCfg.close, { liveState: 'ok', source: 'sensor', limit: 57, unit: '°C', detector: { alarm, device: alarm === 'unknown' ? 'lost' : 'online', name: 'HD-02' }, fieldChecked }),
      config: fireCfg,
      steps: [],
      verificationText: (id) => id,
      unit: '°C',
    });
    const handled = alertUpdate(fireAlert, input({ state: 'resolved', ...base, followUp: { choice: 60, owner: 'A' } }), chk('cleared', false), ctx);
    if (!handled.ok) throw new Error(JSON.stringify(handled.errors));
    expect(handled.record).toMatchObject({ status: 'resolved', resolution: { kind: 'handled', closedBy: 'live' } });
    expect(handled.record.followUp).toEqual({ minutes: 60, until: '2026-10-28T08:06:00.000Z', unit: '°C', owner: 'A' });
    expect(handled.record.history!.at(-1)!.text).toBe('Đã xử lý sự cố (đầu báo HD-02 đã phục hồi) · theo dõi đến 15:06');
    const fa = alertUpdate(fireAlert, input({ state: 'false-alarm', ...base, verification: ['field-verified'], followUp: { choice: 0, owner: '' } }), chk('unknown', true), ctx);
    if (!fa.ok) throw new Error(JSON.stringify(fa.errors));
    expect(fa.record).toMatchObject({ status: 'resolved', resolution: { kind: 'false-alarm', closedBy: 'field' } });
    expect(fa.record.history!.at(-1)!.text).toBe('Báo động giả (đầu báo HD-02 mất tín hiệu – đã kiểm tra tại chỗ)');
  });
  test('cháy: ô "Báo động giả" không có ở áp suất; nhãn bắt buộc theo ô đã chọn', () => {
    expect(validateAlertUpdate(input({ state: 'false-alarm', ...base, verification: ['back-to-normal'] }), check(), ctx.at).state).toBeTruthy();
    const e = validateAlertUpdate(input({ state: 'false-alarm' }), { ...check(), config: fireCfg, close: { ok: true, basis: 'live' } }, ctx.at);
    expect(e.cause).toBe('Nhập nguyên nhân khi đánh dấu Báo động giả.');
  });
});
