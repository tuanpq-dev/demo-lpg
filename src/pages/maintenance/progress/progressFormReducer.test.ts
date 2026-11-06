import { describe, expect, test } from 'vitest';
import { progressFormReducer, type ProgressFormState, type TempFile } from './progressFormReducer';

const s0 = (over: Partial<ProgressFormState> = {}): ProgressFormState => ({ state: 'working', progress: 35, text: '', files: [], errors: {}, uploadError: '', preview: null, ...over });
const file = (id: string): TempFile => ({ id, name: `${id}.png`, size: 1, kind: 'image', url: `blob:${id}`, type: 'image/png' });

describe('progressFormReducer', () => {
  test('choose-state: bỏ lỗi trạng thái / nội dung / chung (giữ lỗi khác); "Hoàn thành" → 100 %', () => {
    const s = progressFormReducer(s0({ errors: { state: 'a', text: 'b', form: 'c' } }), { type: 'choose-state', state: 'paused' });
    expect(s).toMatchObject({ state: 'paused', progress: 35 });
    expect(s.errors).toEqual({ state: undefined, text: undefined, form: undefined });
    expect(progressFormReducer(s0(), { type: 'choose-state', state: 'completed' }).progress).toBe(100);
  });
  test('text: bỏ lỗi nội dung + chung; progress: giữ lỗi', () => {
    expect(progressFormReducer(s0({ errors: { text: 'a', form: 'b' } }), { type: 'text', value: 'x' }).errors).toEqual({ text: undefined, form: undefined });
    expect(progressFormReducer(s0({ errors: { form: 'b' } }), { type: 'progress', value: 40 })).toMatchObject({ progress: 40, errors: { form: 'b' } });
  });
  test('upload: ghi lỗi tệp bị từ chối; có tệp hợp lệ → thêm + bỏ lỗi chung; không có → giữ lỗi chung', () => {
    const a = progressFormReducer(s0({ errors: { form: 'x' } }), { type: 'upload', rejected: 'v.exe: sai loại', added: [file('a')] });
    expect(a).toMatchObject({ uploadError: 'v.exe: sai loại', errors: { form: undefined } });
    expect(a.files.map((f) => f.id)).toEqual(['a']);
    expect(progressFormReducer(s0({ errors: { form: 'x' } }), { type: 'upload', rejected: 'v.exe', added: [] }).errors.form).toBe('x');
  });
  test('remove-file: bỏ tệp; đang xem trước tệp đó → đóng xem trước, tệp khác → giữ', () => {
    const viewing = s0({ files: [file('a'), file('b')], preview: { kind: 'temp', file: file('a') } });
    expect(progressFormReducer(viewing, { type: 'remove-file', id: 'a' })).toMatchObject({ preview: null });
    expect(progressFormReducer(viewing, { type: 'remove-file', id: 'b' }).preview).not.toBeNull();
  });
  test('errors thay toàn bộ lỗi', () => {
    expect(progressFormReducer(s0({ errors: { text: 'a' } }), { type: 'errors', errors: { form: 'b' } }).errors).toEqual({ form: 'b' });
  });
});
