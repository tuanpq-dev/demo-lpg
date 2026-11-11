import { describe, expect, it } from 'vitest';
import { parsePlantDateTime } from '@/lib/plantTime';
import type { DailyReadingRow } from './daily';
import { DAILY_CHECKPOINTS } from './period';
import {
  applyInspectorSign,
  approvalFlow,
  canInspectorSign,
  draftVersionLabel,
  formatSignTime,
  inspectorSignStatus,
  openSensorFaults,
  signConditions,
  signReady,
  type SignCondition,
  type SignConditionId,
  type SignContext,
} from './sign';
import type { ReportRecord, StoredSignature } from './status';

const NOW = parsePlantDateTime('2026-06-24T18:10')!;
const DAY = '2026-06-23';

const report = (patch: Partial<ReportRecord> = {}, missing: readonly string[] = []): ReportRecord => ({
  id: 'R',
  code: 'BCVH-N-23062026',
  period: 'daily',
  periodKey: DAY,
  shift: 'Ca 1',
  checkpoints: DAILY_CHECKPOINTS.map((t) => ({ key: t, label: t, dueAt: `${DAY}T${t}`, done: !missing.includes(t) })),
  inspector: 'Nguyễn Văn A',
  approver: 'Trần Văn B',
  signature: { status: 'pending', step: 'inspector' },
  updatedAt: `${DAY}T18:20`,
  shiftRemark: 'Ổn định.',
  ...patch,
});

const row = (id: string, patch: Partial<DailyReadingRow> = {}, value = 50): DailyReadingRow => ({
  id,
  groupId: 'V-101',
  label: id,
  device: `${id.toUpperCase()} / V-101`,
  unit: '%',
  digits: 1,
  limits: { lowWarn: 10, warn: 90 },
  source: 'auto',
  values: Object.fromEntries(DAILY_CHECKPOINTS.map((t) => [t, value])),
  ...patch,
});

const ctx = (patch: Partial<SignContext> = {}): SignContext => ({
  report: report(),
  rows: [row('lt'), row('pt'), row('field', { source: 'field' })],
  sensorFaults: [],
  draftReviewed: true,
  responsibility: true,
  ...patch,
});

const byId = (c: SignContext) => Object.fromEntries(signConditions(c).map((x) => [x.id, x])) as Record<SignConditionId, SignCondition>;

describe('signConditions', () => {
  it('đủ điều kiện: 8 mục đạt, nhãn như ảnh, thứ tự đọc cột trái rồi cột phải', () => {
    const list = signConditions(ctx());
    expect(list.map((c) => c.label)).toEqual([
      'Đã hoàn thành đủ 6/6 mốc kiểm tra',
      'Đã xác nhận đủ 2/2 thông số PLC/SCADA',
      'Không còn dữ liệu thiếu',
      'Không có lỗi cảm biến chưa xử lý',
      'Đã kiểm tra biểu mẫu bản nháp',
      'Đã hoàn thành nhận xét cuối ca',
      'Người kiểm tra xác nhận trách nhiệm',
      'Không có bất thường chưa ghi chú',
    ]);
    expect(signReady(list)).toBe(true);
  });

  it('thao tác trong modal: chưa xem trước biểu mẫu, chưa tick trách nhiệm → khoá', () => {
    const c = byId(ctx({ draftReviewed: false, responsibility: false }));
    expect(c['draft-reviewed']).toMatchObject({ met: false, label: 'Chưa xem trước biểu mẫu bản nháp' });
    expect(c.responsibility).toMatchObject({ met: false, label: 'Người kiểm tra chưa xác nhận trách nhiệm' });
    expect(signReady(signConditions(ctx({ responsibility: false })))).toBe(false);
  });

  it('thiếu mốc: mốc + PLC/SCADA + dữ liệu thiếu cùng không đạt', () => {
    const r = report({}, ['18:00']);
    const blank = (id: string, source: 'auto' | 'field' = 'auto') =>
      row(id, { source, values: Object.fromEntries(DAILY_CHECKPOINTS.map((t) => [t, t === '18:00' ? null : 50])) });
    const c = byId(ctx({ report: r, rows: [blank('lt'), blank('pt'), blank('field', 'field')] }));
    expect(c.checkpoints).toMatchObject({ met: false, label: 'Mới hoàn thành 5/6 mốc kiểm tra' });
    expect(c.scada).toMatchObject({ met: false, label: 'Mới xác nhận 0/2 thông số PLC/SCADA' });
    expect(c['no-missing']).toMatchObject({ met: false, label: 'Còn thiếu dữ liệu mốc 18:00' });
  });

  it('ô trống chỉ ở số đọc tại chỗ → "Còn thiếu dữ liệu", PLC/SCADA vẫn đạt', () => {
    const field = row('field', { source: 'field', values: { ...row('x').values, '10:00': null } });
    const c = byId(ctx({ rows: [row('lt'), field] }));
    expect(c.scada.met).toBe(true);
    expect(c['no-missing']).toMatchObject({ met: false, label: 'Còn thiếu dữ liệu mốc 10:00' });
  });

  it('mốc "Cần xác minh" → PLC/SCADA chưa xác nhận', () => {
    const r = report();
    const checkpoints = r.checkpoints.map((c) => (c.key === '14:00' ? { ...c, needsVerify: true } : c));
    expect(byId(ctx({ report: { ...r, checkpoints } })).scada).toMatchObject({ met: false, label: 'Thông số PLC/SCADA mốc 14:00 cần xác minh lại' });
  });

  it('lỗi cảm biến chưa xử lý (rút gọn khi nhiều mã)', () => {
    expect(byId(ctx({ sensorFaults: ['ALT-1'] }))['no-sensor-fault']).toMatchObject({ met: false, label: 'Còn lỗi cảm biến chưa xử lý: ALT-1' });
    expect(byId(ctx({ sensorFaults: ['A', 'B', 'C'] }))['no-sensor-fault'].label).toBe('Còn lỗi cảm biến chưa xử lý: A, B +1');
  });

  it('nhận xét cuối ca rỗng / chỉ khoảng trắng → chưa đạt', () => {
    expect(byId(ctx({ report: report({ shiftRemark: undefined }) }))['shift-remark']).toMatchObject({
      met: false,
      label: 'Chưa có nhận xét cuối ca',
    });
    expect(byId(ctx({ report: report({ shiftRemark: '   ' }) }))['shift-remark'].met).toBe(false);
  });

  it('bất thường: ô ngoài ngưỡng cần ghi chú ĐÚNG mốc', () => {
    const high = row('gs', { device: 'GS-03 / Khu nạp', limits: { warn: 10, danger: 20 }, values: { ...row('x', {}, 3).values, '10:00': 12 } });
    expect(byId(ctx({ rows: [high] }))['anomalies-noted']).toMatchObject({ met: false, label: 'Còn 1 bất thường chưa ghi chú: GS-03 lúc 10:00' });
    expect(byId(ctx({ rows: [{ ...high, notes: { '12:00': 'sai mốc' } }] }))['anomalies-noted'].met).toBe(false);
    expect(byId(ctx({ rows: [{ ...high, notes: { '10:00': 'Đã siết mặt bích' } }] }))['anomalies-noted'].met).toBe(true);
  });
});

describe('openSensorFaults', () => {
  const a = (code: string, status: string, day = DAY, kind: string | undefined = 'sensor-signal-lost') => ({ code, status, day, kind });
  it('chỉ lỗi cảm biến trong NGÀY báo cáo, chưa xử lý', () => {
    expect(
      openSensorFaults(
        [
          a('A', 'unacknowledged'),
          a('B', 'in-progress'),
          a('C', 'resolved'),
          a('D', 'done'),
          a('E', 'in-progress', '2026-06-24'),
          a('F', 'in-progress', DAY, 'gas-leak'),
          { code: 'G', status: 'in-progress', day: DAY },
        ],
        DAY,
      ),
    ).toEqual(['A', 'B']);
  });
});

describe('canInspectorSign', () => {
  const sig = (signature: StoredSignature) => report({ signature });
  it('báo cáo ngày đã đủ mốc, chờ Người kiểm tra / bị trả lại / chưa gửi', () => {
    expect(canInspectorSign(sig({ status: 'pending', step: 'inspector' }), NOW)).toBe(true);
    expect(canInspectorSign(sig({ status: 'rejected' }), NOW)).toBe(true);
    expect(canInspectorSign(sig({ status: 'not-sent' }), NOW)).toBe(true);
  });
  it('không mở: đã qua bước Người kiểm tra, đã ký, thiếu dữ liệu, kỳ chưa qua, báo cáo tháng', () => {
    expect(canInspectorSign(sig({ status: 'pending', step: 'approver' }), NOW)).toBe(false);
    expect(canInspectorSign(sig({ status: 'signed' }), NOW)).toBe(false);
    expect(canInspectorSign(report({}, ['08:00']), NOW)).toBe(false);
    expect(canInspectorSign(report({ periodKey: '2026-06-24' }), NOW)).toBe(false);
    expect(canInspectorSign(report({ period: 'monthly', periodKey: '2026-05' }), NOW)).toBe(false);
  });
});

describe('approvalFlow', () => {
  it('chờ Người kiểm tra – như ảnh', () => {
    expect(approvalFlow(report(), NOW)).toEqual([
      { step: 'inspector', label: '1. Người kiểm tra ký', state: 'current', detail: 'Đang thực hiện - Nguyễn Văn A' },
      { step: 'approver', label: '2. Người duyệt ký', state: 'waiting', detail: 'Chờ sau bước người kiểm tra - Trần Văn B' },
      { step: 'tap', label: '3. TAP vận hành xác nhận', state: 'waiting', detail: 'Chờ sau bước người duyệt' },
    ]);
  });
  it('bị trả lại → bước 1 "Ký lại…"; chưa có người duyệt → "Chưa chỉ định"', () => {
    const flow = approvalFlow(report({ signature: { status: 'rejected' }, approver: undefined }), NOW);
    expect(flow[0]!.detail).toBe('Ký lại sau khi bị trả lại - Nguyễn Văn A');
    expect(flow[1]!.detail).toBe('Chờ sau bước người kiểm tra - Chưa chỉ định');
  });
  it('sau khi Người kiểm tra ký → bước 1 xong, bước 2 hiện tại; đã ký đủ → 3 bước xong', () => {
    expect(approvalFlow(report({ signature: { status: 'pending', step: 'approver' } }), NOW).map((s) => s.state)).toEqual([
      'done',
      'current',
      'waiting',
    ]);
    const all = approvalFlow(report({ signature: { status: 'signed' } }), NOW);
    expect(all.map((s) => s.detail)).toEqual(['Đã ký - Nguyễn Văn A', 'Đã ký - Trần Văn B', 'Đã xác nhận']);
  });
});

describe('applyInspectorSign', () => {
  it('chuyển sang chờ Người duyệt, ghi nhật ký + giờ cập nhật; ghi chú cắt khoảng trắng', () => {
    const r = applyInspectorSign(report(), { note: '  Đã rà soát  ', at: NOW });
    expect(r.signature).toEqual({ status: 'pending', step: 'approver' });
    expect(r.updatedAt).toBe('2026-06-24T18:10');
    expect(r.signLog).toEqual([{ step: 'inspector', by: 'Nguyễn Văn A', at: '2026-06-24T18:10', note: 'Đã rà soát' }]);
  });
  it('ghi chú rỗng không lưu; giữ nhật ký cũ (ký lại sau khi bị trả lại)', () => {
    const old = { step: 'inspector' as const, by: 'Nguyễn Văn A', at: '2026-06-21T08:00' };
    const r = applyInspectorSign(report({ signature: { status: 'rejected' }, signLog: [old] }), { note: ' ', at: NOW });
    expect(r.signLog).toEqual([old, { step: 'inspector', by: 'Nguyễn Văn A', at: '2026-06-24T18:10' }]);
  });
});

describe('hiển thị', () => {
  it('trạng thái chờ Người kiểm tra / bị trả lại', () => {
    expect(inspectorSignStatus(report())).toEqual({ label: 'Chờ người kiểm tra ký', short: 'Chờ ký', tone: 'warning' });
    expect(inspectorSignStatus(report({ signature: { status: 'rejected' } })).tone).toBe('danger');
  });
  it('phiên bản bản nháp + giờ ký', () => {
    expect(draftVersionLabel(report())).toBe('Bản nháp hoàn chỉnh');
    expect(draftVersionLabel(report({}, ['18:00']))).toBe('Bản nháp chưa đủ dữ liệu');
    expect(formatSignTime(NOW)).toBe('18:10 · 24/06/2026');
  });
});
