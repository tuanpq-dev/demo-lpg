import { describe, expect, test } from 'vitest';
import { PERMISSIONS, ROLES, can, isRole, roleRank, rolesFor } from './roles';

describe('roles', () => {
  test('thứ tự cấp: viewer < operator < engineer < admin', () => {
    expect(ROLES.map(roleRank)).toEqual([0, 1, 2, 3]);
  });

  test('quy tắc nghiệp vụ', () => {
    expect(can('viewer', 'alert:read')).toBe(true);
    expect(can('viewer', 'alert:acknowledge')).toBe(false);
    expect(can('operator', 'alert:acknowledge')).toBe(true);
    expect(can('operator', 'maintenance:write')).toBe(true);
    expect(can('operator', 'scene:write')).toBe(false);
    expect(can('engineer', 'scene:write')).toBe(true);
    expect(can('engineer', 'user:manage')).toBe(false);
    expect(can('admin', 'user:manage')).toBe(true);
  });

  test('admin có mọi quyền; viewer chỉ đọc dữ liệu vận hành (không đọc audit)', () => {
    const all = Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[];
    for (const p of all) expect(can('admin', p)).toBe(true);
    expect(all.filter((p) => can('viewer', p)).sort()).toEqual(['alert:read', 'dashboard:read', 'maintenance:read', 'scene:read']);
  });

  test('chưa đăng nhập / vai trò lạ → không có quyền', () => {
    expect(can(null, 'alert:read')).toBe(false);
    expect(can(undefined, 'alert:read')).toBe(false);
    expect(can('root' as never, 'alert:read')).toBe(false);
    expect(isRole('admin')).toBe(true);
    expect(isRole('Admin')).toBe(false);
    expect(isRole(1)).toBe(false);
  });

  test('rolesFor', () => {
    expect(rolesFor('scene:write')).toEqual(['engineer', 'admin']);
    expect(rolesFor('alert:read')).toEqual([...ROLES]);
    expect(rolesFor('user:manage')).toEqual(['admin']);
  });
});
