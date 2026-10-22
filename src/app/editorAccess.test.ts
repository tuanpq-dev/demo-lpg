import { describe, expect, test } from 'vitest';
import { canUseEditor } from './editorAccess';

describe('canUseEditor', () => {
  test('có đăng nhập: chỉ engineer/admin, không cần ?edit=1', () => {
    expect(canUseEditor('', 'engineer', 'api')).toBe(true);
    expect(canUseEditor('', 'admin', 'api')).toBe(true);
    expect(canUseEditor('?edit=1', 'operator', 'api')).toBe(false);
    expect(canUseEditor('?edit=1', 'viewer', 'api')).toBe(false);
    expect(canUseEditor('?edit=1', null, 'api')).toBe(false);
  });
  test('VITE_AUTH=off: theo ?edit=1 như trước', () => {
    expect(canUseEditor('?edit=1', 'admin', 'off')).toBe(true);
    expect(canUseEditor('', 'admin', 'off')).toBe(false);
  });
});
