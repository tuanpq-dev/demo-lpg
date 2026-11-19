import { describe, expect, it, vi } from 'vitest';

// `import.meta.glob` trỏ sai thư mục KHÔNG báo lỗi – chỉ trả danh sách rỗng → mọi trang 3D lặng lẽ rơi về ảnh tĩnh.
describe('cảnh mẫu (src/mocks/scenes)', () => {
  it('tìm thấy và nạp được cảnh mẫu theo id', async () => {
    // Kho cảnh Editor đọc window.localStorage lúc nạp module → giả trong bộ nhớ trước khi import (test chạy node).
    const mem = new Map<string, string>();
    const localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      key: (i: number) => [...mem.keys()][i] ?? null,
      get length() {
        return mem.size;
      },
    };
    vi.stubGlobal('window', { localStorage });
    const { fetchScene, isSampleScene } = await import('.');

    expect(isSampleScene('khu-bon-lpg')).toBe(true);
    expect(isSampleScene('v-101')).toBe(true);
    const scene = await fetchScene('khu-bon-lpg');
    expect(scene.objects.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});
