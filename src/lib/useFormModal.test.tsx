// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useFormModal, type UseFormModalOptions } from './useFormModal';

type V = { text: string };
function setup(over: Partial<UseFormModalOptions<V, V, unknown>> = {}, values: V = { text: '' }) {
  const onClose = vi.fn();
  const onSubmit = vi.fn(async () => {});
  const onSubmitError = vi.fn();
  const draft = { exists: false, save: vi.fn(() => true), clear: vi.fn() };
  const props = { initial: { text: '' }, values, draft, onSubmit, onClose, onSubmitError, ...over };
  const hook = renderHook((p: UseFormModalOptions<V, V, unknown>) => useFormModal(p), { initialProps: props });
  return { ...hook, onClose, onSubmit, onSubmitError, draft, props };
}

describe('useFormModal – đóng', () => {
  test('chưa sửa, không nháp → requestClose đóng ngay', () => {
    const { result, onClose } = setup();
    expect(result.current.dirty).toBe(false);
    act(() => result.current.requestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.confirming).toBe(false);
  });

  test('đã sửa → hỏi; requestClose lần hai (Esc) = quay lại sửa; keepEditing cũng thôi hỏi', () => {
    const { result, onClose } = setup({}, { text: 'x' });
    expect(result.current.dirty).toBe(true);
    act(() => result.current.requestClose());
    expect(result.current.confirming).toBe(true);
    act(() => result.current.requestClose());
    expect(result.current.confirming).toBe(false);
    act(() => result.current.requestClose());
    act(() => result.current.keepEditing());
    expect(result.current.confirming).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('chưa sửa nhưng có nháp → vẫn hỏi; discard xoá nháp + đóng', () => {
    const draft = { exists: true, save: vi.fn(() => true), clear: vi.fn() };
    const { result, onClose } = setup({ draft });
    expect(result.current.hasDraft).toBe(true);
    act(() => result.current.requestClose());
    expect(result.current.confirming).toBe(true);
    act(() => result.current.discard());
    expect(draft.clear).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('isDirty riêng (bỏ qua trường không tính)', () => {
    const { result } = setup({ isDirty: () => false }, { text: 'khác' });
    expect(result.current.dirty).toBe(false);
  });
});

describe('useFormModal – nháp', () => {
  test('saveDraft lưu values + đóng, hasDraft = true', () => {
    const { result, draft, onClose } = setup({}, { text: 'nháp' });
    let ok = false;
    act(() => {
      ok = result.current.saveDraft();
    });
    expect(ok).toBe(true);
    expect(draft.save).toHaveBeenCalledWith({ text: 'nháp' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('lưu nháp thất bại (bộ nhớ không khả dụng) → false, KHÔNG đóng', () => {
    const draft = { exists: false, save: vi.fn(() => false), clear: vi.fn() };
    const { result, onClose } = setup({ draft });
    let ok = true;
    act(() => {
      ok = result.current.saveDraft();
    });
    expect(ok).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('useFormModal – gửi', () => {
  test('thành công → trả kết quả, xoá nháp, submitting về false', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    const { result, draft } = setup({ onSubmit });
    let res: unknown;
    await act(async () => {
      res = await result.current.submit({ text: 'a' });
    });
    expect(onSubmit).toHaveBeenCalledWith({ text: 'a' });
    expect(res).toEqual({ ok: true });
    expect(draft.clear).toHaveBeenCalledTimes(1);
    expect(result.current.submitting).toBe(false);
  });

  test('kết quả { ok: false } → trả về cho modal, GIỮ nháp', async () => {
    const onSubmit = vi.fn(async () => ({ ok: false as const, error: 'Đã có người ký' }));
    const { result, draft } = setup({ onSubmit });
    let res: unknown;
    await act(async () => {
      res = await result.current.submit({ text: 'a' });
    });
    expect(res).toEqual({ ok: false, error: 'Đã có người ký' });
    expect(draft.clear).not.toHaveBeenCalled();
  });

  test('ném lỗi → onSubmitError(câu lỗi, lỗi gốc), undefined, giữ nháp, không đóng', async () => {
    const boom = new Error('Mất kết nối máy chủ');
    const onSubmit = vi.fn(async () => {
      throw boom;
    });
    const { result, draft, onClose, onSubmitError } = setup({ onSubmit });
    let res: unknown = 'x';
    await act(async () => {
      res = await result.current.submit({ text: 'a' });
    });
    expect(res).toBeUndefined();
    expect(onSubmitError).toHaveBeenCalledWith('Không thực hiện được thao tác: Mất kết nối máy chủ', boom);
    expect(draft.clear).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
  });

  test('đang gửi → bấm lần hai bị chặn (onSubmit chỉ chạy một lần); submitting = true trong lúc chờ', async () => {
    let release!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((r) => (release = r)));
    const { result } = setup({ onSubmit });
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.submit({ text: 'a' });
    });
    expect(result.current.submitting).toBe(true);
    await act(async () => {
      expect(await result.current.submit({ text: 'a' })).toBeUndefined();
    });
    await act(async () => {
      release();
      await first;
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('useFormModal – tuỳ chọn nháp (modal cập nhật xử lý cảnh báo)', () => {
  test('stayOpenAfterDraft: lưu nháp KHÔNG đóng', () => {
    const { result, onClose, draft } = setup({ stayOpenAfterDraft: true }, { text: 'x' });
    act(() => {
      result.current.saveDraft();
    });
    expect(draft.save).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.hasDraft).toBe(true);
  });

  test('keepDraftOnDiscard: "Bỏ thay đổi" đóng nhưng GIỮ nháp', () => {
    const { result, onClose, draft } = setup({ keepDraftOnDiscard: true }, { text: 'x' });
    act(() => result.current.discard());
    expect(draft.clear).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('confirmIfDraft: false – có nháp nhưng chưa sửa → đóng không hỏi; đã sửa → vẫn hỏi', () => {
    const draft = { exists: true, save: vi.fn(() => true), clear: vi.fn() };
    const a = setup({ draft, confirmIfDraft: false });
    act(() => a.result.current.requestClose());
    expect(a.onClose).toHaveBeenCalledTimes(1);
    const b = setup({ draft, confirmIfDraft: false }, { text: 'x' });
    act(() => b.result.current.requestClose());
    expect(b.result.current.confirming).toBe(true);
  });
});
