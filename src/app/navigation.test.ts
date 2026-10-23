import { describe, expect, it } from 'vitest';
import { navIdFromPath } from './navigation';

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
  it('không khớp nửa chừng / route lạ → rỗng', () => {
    expect(navIdFromPath('/mapx')).toBe('');
    expect(navIdFromPath('/mapping')).toBe('');
    expect(navIdFromPath('/')).toBe('');
  });
});
