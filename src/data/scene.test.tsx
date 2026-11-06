// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

const list = vi.fn();
vi.mock('./sceneRepository', () => ({ sceneRepository: { list: () => list(), get: vi.fn(), save: vi.fn(), remove: vi.fn() } }));

const { SCENE_IDS, useSceneList } = await import('./scene');

describe('useSceneList', () => {
  test('cảnh đã lưu đứng trước cảnh mẫu; đọc kho lỗi → error, items null; Thử lại → có danh sách', async () => {
    list.mockRejectedValueOnce(new Error('localStorage bị chặn'));
    const { result } = renderHook(() => useSceneList());
    expect(result.current.items).toBeNull();
    await act(async () => {});
    expect(result.current.items).toBeNull();
    expect(result.current.error?.message).toBe('localStorage bị chặn');

    list.mockResolvedValueOnce([{ id: 'canh-1', name: 'Cảnh 1', version: 2, objectCount: 3, updatedAt: '2026-11-05T08:00:00Z' }]);
    act(() => result.current.refetch());
    expect(result.current.items).toBeNull(); // về "Đang tải…"
    expect(result.current.error).toBeUndefined();
    await act(async () => {});
    expect(result.current.items?.[0]).toMatchObject({ id: 'canh-1', sample: false });
    expect(result.current.items?.slice(1).map((s) => s.id)).toEqual(SCENE_IDS);
  });
});
