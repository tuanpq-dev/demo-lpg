import { describe, expect, it } from 'vitest';
import { NAV_ROUTES, navIdFromPath, navPathFromId } from './navigation';

describe('navIdFromPath', () => {
  it('khớp đường dẫn và tiền tố', () => {
    expect(navIdFromPath('/overview')).toBe('overview');
    expect(navIdFromPath('/alerts/ALT-1')).toBe('alerts');
    expect(navIdFromPath('/map')).toBe('map');
  });
  it('mọi đường dẫn bắt đầu bằng /map sáng "Bản đồ nội khu"', () => {
    expect(navIdFromPath('/map/V-101')).toBe('map');
    expect(navIdFromPath('/map/v-101')).toBe('map');
    expect(navIdFromPath('/map/XYZ')).toBe('map');
  });
  it('/operations (đường dẫn cũ, chỉ để chuyển hướng) không gắn tab', () => {
    expect(navIdFromPath('/operations/V-101')).toBe('');
  });
  it('menu con "Vận hành": khớp đường dẫn dài nhất, mục cha không có trang riêng', () => {
    expect(navIdFromPath('/operations/overview')).toBe('operation-main');
    expect(navIdFromPath('/operations/logs')).toBe('operation-logs');
    expect(navIdFromPath('/operations/logs/123')).toBe('operation-logs');
    expect(navIdFromPath('/operations/ai-simulation')).toBe('operation-ai-simulation');
    expect(navIdFromPath('/operations/logsx')).toBe('');
    expect(navPathFromId('operation')).toBeUndefined();
    expect(navPathFromId('operation-logs')).toBe('/operations/logs');
    expect(navPathFromId('alerts')).toBe('/alerts');
  });
  it('id mục nav không trùng (cả mục con)', () => {
    const ids = NAV_ROUTES.flatMap((r) => [r.id, ...(r.children ?? []).map((c) => c.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('không khớp nửa chừng / route lạ → rỗng', () => {
    expect(navIdFromPath('/mapx')).toBe('');
    expect(navIdFromPath('/mapping')).toBe('');
    expect(navIdFromPath('/')).toBe('');
  });
});
