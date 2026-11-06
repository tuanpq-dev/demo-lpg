import { describe, expect, test } from 'vitest';
import { updateFormReducer, type FormState, type UpdateFormValues } from './updateFormState';

const values: UpdateFormValues = {
  state: 'inspecting',
  holdReason: '',
  supportPeople: [],
  inspection: {},
  verification: [],
  cause: '',
  actionTaken: '',
  issue: { kind: 'none', note: '' },
  followUp: { choice: 30, target: 10, owner: '' },
  source: 'both',
  recordedAt: '2026-11-06T10:00',
  manualAfter: {},
  customAtLocal: '',
};
const s0 = (over: Partial<FormState> = {}): FormState => ({ values, saved: values, files: [], uploadError: '', errors: {}, submitError: '', triedSubmit: false, ...over });

describe('updateFormReducer', () => {
  test('sửa giá trị (set / inspection / verification) → bỏ lỗi trả về lúc lưu và lỗi mạng', () => {
    const withErr = s0({ errors: { state: 'x' }, submitError: 'mạng' });
    expect(updateFormReducer(withErr, { type: 'set', patch: { cause: 'a' } })).toMatchObject({ values: { cause: 'a' }, errors: {}, submitError: '' });
    expect(updateFormReducer(withErr, { type: 'verification', id: 'v1', on: true }).submitError).toBe('');
    expect(updateFormReducer(withErr, { type: 'inspection', id: 'i1', entry: { status: 'pass', note: '' } }).errors).toEqual({});
    const on = updateFormReducer(withErr, { type: 'verification', id: 'v1', on: true });
    expect(on).toMatchObject({ values: { verification: ['v1'] }, errors: {} });
    expect(updateFormReducer(on, { type: 'verification', id: 'v1', on: false }).values.verification).toEqual([]);
  });

  test('tệp: thêm (id theo số tệp đang có) / bỏ; không đụng lỗi', () => {
    const one = updateFormReducer(s0({ errors: { state: 'x' }, submitError: 'mạng' }), { type: 'files-added', files: [{ name: 'a.png', size: 1, kind: 'image' }] });
    const two = updateFormReducer(one, { type: 'files-added', files: [{ name: 'b.pdf', size: 2, kind: 'document' }] });
    expect(two.files.map((f) => f.id)).toEqual(['tmp-0-a.png', 'tmp-1-b.pdf']);
    expect(two.errors).toEqual({ state: 'x' });
    expect(two.submitError).toBe('mạng');
    expect(updateFormReducer(two, { type: 'file-removed', id: 'tmp-0-a.png' }).files.map((f) => f.name)).toEqual(['b.pdf']);
  });

  test('vòng gửi: submit-start (đã bấm lưu, bỏ lỗi cũ) → submit-sent (bỏ lỗi mạng) → rejected / error; draft-saved = bản đã lưu', () => {
    const started = updateFormReducer(s0({ errors: { state: 'x' }, submitError: 'cũ' }), { type: 'submit-start' });
    expect(started).toMatchObject({ triedSubmit: true, errors: {}, submitError: 'cũ' });
    expect(updateFormReducer(started, { type: 'submit-sent' }).submitError).toBe('');
    expect(updateFormReducer(started, { type: 'submit-rejected', errors: { cause: 'y' } }).errors).toEqual({ cause: 'y' });
    expect(updateFormReducer(started, { type: 'submit-error', text: 'mạng' }).submitError).toBe('mạng');
    const edited = updateFormReducer(s0(), { type: 'set', patch: { cause: 'b' } });
    expect(updateFormReducer(edited, { type: 'draft-saved' }).saved.cause).toBe('b');
  });
});
