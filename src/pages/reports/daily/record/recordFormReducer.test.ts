import { describe, expect, test } from 'vitest';
import { recordFormReducer, type RecordFormState } from './useCheckpointRecordForm';

const s0 = (over: Partial<RecordFormState> = {}): RecordFormState => ({ remark: '', manual: {}, files: [], editingGauge: false, error: '', ...over });

describe('recordFormReducer', () => {
  test('remark: đổi nhận xét + bỏ lỗi', () => {
    expect(recordFormReducer(s0({ error: 'x' }), { type: 'remark', value: 'Ổn' })).toMatchObject({ remark: 'Ổn', error: '' });
  });
  test('append-remark: nối câu gợi ý, giữ lỗi', () => {
    const s = recordFormReducer(s0({ remark: 'Hệ thống ổn định', error: 'x' }), { type: 'append-remark', text: 'Không có bất thường' });
    expect(s.remark).toContain('Hệ thống ổn định');
    expect(s.remark).toContain('Không có bất thường');
    expect(s.error).toBe('x');
  });
  test('manual: ghi số, null = xoá ô; bỏ lỗi', () => {
    const a = recordFormReducer(s0({ error: 'x' }), { type: 'manual', id: 'pt', value: 7.2 });
    expect(a).toMatchObject({ manual: { pt: 7.2 }, error: '' });
    expect(recordFormReducer(a, { type: 'manual', id: 'pt', value: null }).manual).toEqual({});
  });
  test('files / toggle-gauge / error', () => {
    const file = { id: 'f1', name: 'a.jpg', size: 1 };
    expect(recordFormReducer(s0({ error: 'x' }), { type: 'files', files: [file] })).toMatchObject({ files: [file], error: 'x' });
    expect(recordFormReducer(s0(), { type: 'toggle-gauge' }).editingGauge).toBe(true);
    expect(recordFormReducer(s0(), { type: 'error', text: 'lỗi' }).error).toBe('lỗi');
  });
});
