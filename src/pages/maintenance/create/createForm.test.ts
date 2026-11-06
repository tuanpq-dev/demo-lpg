import { describe, expect, test } from 'vitest';
import { alertRecords } from '@/mocks/alerts';
import { blankForm, createFormReducer, formFromAlert, toCreateInput, validateCreate, type CreateFormState } from './createForm';

const state = (over: Partial<CreateFormState> = {}): CreateFormState => ({
  form: blankForm(null),
  errors: {},
  submitting: false,
  submitError: '',
  draftInfo: null,
  touched: { department: false, shift: false },
  errorTick: 0,
  ...over,
});

describe('validateCreate', () => {
  const now = new Date('2026-11-06T10:00:00');
  const ok = { ...blankForm('V-101'), title: 'Kiểm tra van', startAt: '2026-11-06T11:00', dueAt: '2026-11-06T15:00' };

  test('hợp lệ → không lỗi', () => {
    expect(validateCreate(ok, now)).toEqual({});
  });
  test('tên < 5 ký tự (sau trim), thiếu thiết bị, thiếu hạn', () => {
    expect(validateCreate({ ...ok, title: '  abcd ', device: null, dueAt: '' }, now)).toEqual({
      title: 'Nhập tên yêu cầu (ít nhất 5 ký tự).',
      device: 'Chọn thiết bị.',
      dueAt: 'Chọn hạn hoàn thành.',
    });
  });
  test('hạn = giờ bắt đầu → lỗi; hạn trước hôm qua → lỗi quá khứ (không có giờ bắt đầu)', () => {
    expect(validateCreate({ ...ok, dueAt: ok.startAt }, now).dueAt).toBe('Hạn hoàn thành phải sau thời gian bắt đầu.');
    expect(validateCreate({ ...ok, startAt: '', dueAt: '2026-11-01T08:00' }, now).dueAt).toBe('Hạn hoàn thành không được trong quá khứ.');
  });
});

describe('formFromAlert / toCreateInput', () => {
  const a = { ...alertRecords.find((x) => x.id === 'ALT-00128')!, assignee: 'Nguyễn Văn A' };
  test('điền từ cảnh báo: nguồn, mã tham chiếu, mức độ, người xử lý, checklist mẫu (tên thiết bị trong bước đầu); tên tuỳ chọn', () => {
    const f = formFromAlert(a);
    expect(f).toMatchObject({ source: 'alert', referenceCode: 'ALT-00128', priority: 'critical', assignee: 'Nguyễn Văn A', device: 'V-101' });
    expect(f.checklist[0]!.text).toBe('Kiểm tra trực quan van V-101');
    expect(formFromAlert(a, 'Tên riêng').title).toBe('Tên riêng');
  });
  test('cảnh báo mức thấp → ưu tiên Thường', () => {
    expect(formFromAlert({ ...a, severity: 'low' }).priority).toBe('medium');
  });
  test('dữ liệu gửi: khu vực truyền vào, sourceAlertId theo cảnh báo, phòng ban null → undefined', () => {
    const input = toCreateInput({ ...blankForm('V-101'), department: null }, 'Khu bồn', a);
    expect(input).toMatchObject({ device: 'V-101', area: 'Khu bồn', sourceAlertId: 'ALT-00128', department: undefined });
    expect(toCreateInput(blankForm('V-101'), 'Khu bồn', undefined).sourceAlertId).toBeUndefined();
  });
});

describe('createFormReducer', () => {
  test('set: đổi giá trị + bỏ lỗi của ô đó', () => {
    const s = createFormReducer(state({ errors: { title: 'x', device: 'y' } }), { type: 'set', key: 'title', value: 'Kiểm tra' });
    expect(s.form.title).toBe('Kiểm tra');
    expect(s.errors).toEqual({ title: undefined, device: 'y' });
  });
  test('device: tự điền phòng ban + checklist mẫu (khi checklist trống), bỏ lỗi thiết bị; đã chọn phòng ban tay thì giữ', () => {
    const s = createFormReducer(state({ errors: { device: 'Chọn thiết bị.' } }), { type: 'device', device: 'GS-04' });
    expect(s.form.department).toBe('Đo lường – Tự động hóa');
    expect(s.form.checklist.length).toBeGreaterThan(0);
    expect(s.errors.device).toBeUndefined();
    const manual = createFormReducer(state(), { type: 'department', department: 'An toàn – HSE' });
    expect(createFormReducer(manual, { type: 'device', device: 'GS-04' }).form.department).toBe('An toàn – HSE');
  });
  test('start: ca theo giờ bắt đầu, trừ khi đã chọn ca tay', () => {
    expect(createFormReducer(state(), { type: 'start', startAt: '2026-11-06T15:00' }).form.shift).toBe('shift-2');
    const manual = createFormReducer(state(), { type: 'shift', shift: 'shift-3' });
    expect(createFormReducer(manual, { type: 'start', startAt: '2026-11-06T15:00' }).form.shift).toBe('shift-3');
  });
  test('toggle-suggestion thêm rồi bỏ; invalid tăng errorTick; reset bỏ dải nháp; submit-end giữ / ghi lỗi', () => {
    const added = createFormReducer(state(), { type: 'toggle-suggestion', text: 'Đo áp suất' });
    expect(added.form.checklist.map((c) => c.text)).toEqual(['Đo áp suất']);
    expect(createFormReducer(added, { type: 'toggle-suggestion', text: 'Đo áp suất' }).form.checklist).toEqual([]);
    expect(createFormReducer(state(), { type: 'invalid', errors: { title: 'x' } }).errorTick).toBe(1);
    expect(createFormReducer(state({ draftInfo: '10:00' }), { type: 'reset', form: blankForm(null) }).draftInfo).toBeNull();
    const started = createFormReducer(state({ submitError: 'cũ', errors: { title: 'x' } }), { type: 'submit-start' });
    expect(started).toMatchObject({ submitting: true, submitError: '', errors: {} });
    expect(createFormReducer(started, { type: 'submit-end', error: 'lỗi' })).toMatchObject({ submitting: false, submitError: 'lỗi' });
  });
});
