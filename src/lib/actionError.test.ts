import { afterEach, describe, expect, test, vi } from 'vitest';
import { actionErrorText, runAction } from './actionError';

afterEach(() => vi.restoreAllMocks());

describe('actionErrorText', () => {
  test('Error → kèm message', () => {
    expect(actionErrorText(new Error('Mất kết nối máy chủ'))).toBe('Không thực hiện được thao tác: Mất kết nối máy chủ');
  });
  test('chuỗi → kèm chuỗi (đã cắt khoảng trắng)', () => {
    expect(actionErrorText('  hết hạn phiên ')).toBe('Không thực hiện được thao tác: hết hạn phiên');
  });
  test('không có nội dung (Error rỗng, undefined, object) → câu chung', () => {
    const generic = 'Không thực hiện được thao tác. Vui lòng thử lại.';
    expect(actionErrorText(new Error(''))).toBe(generic);
    expect(actionErrorText(undefined)).toBe(generic);
    expect(actionErrorText({ code: 'X' })).toBe(generic);
  });
});

describe('runAction', () => {
  test('thành công → true, không gọi onError', async () => {
    const onError = vi.fn();
    await expect(runAction(async () => 1, onError)).resolves.toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  test('promise bị từ chối → false + onError(câu lỗi, lỗi gốc), không ném ra ngoài', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    const boom = new Error('500');
    await expect(runAction(() => Promise.reject(boom), onError)).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith('Không thực hiện được thao tác: 500', boom);
  });

  test('task ném lỗi đồng bộ cũng được bắt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    await expect(
      runAction(() => {
        throw new Error('sync');
      }, onError),
    ).resolves.toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test('task chạy ngay khi gọi (không đợi microtask)', () => {
    const task = vi.fn();
    void runAction(task, vi.fn());
    expect(task).toHaveBeenCalledTimes(1);
  });

  test('task đồng bộ trả giá trị thường → true', async () => {
    await expect(runAction(() => 'ok', vi.fn())).resolves.toBe(true);
  });
});
