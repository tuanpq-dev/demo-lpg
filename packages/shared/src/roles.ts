/**
 * Vai trò + quyền – NGUỒN DUY NHẤT cho cả BE (guard @Roles) và FE (ẩn nút – chỉ là UX).
 * Không phụ thuộc zod → FE import giá trị từ đây an toàn (không kéo zod vào bundle chính).
 */

/** Thứ tự = cấp tăng dần; vai trò sau có mọi quyền của vai trò trước (xem PERMISSIONS). */
export const ROLES = ['viewer', 'operator', 'engineer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  viewer: 'Người xem',
  operator: 'Vận hành',
  engineer: 'Kỹ sư',
  admin: 'Quản trị',
};

/**
 * Quyền nghiệp vụ → vai trò TỐI THIỂU. Quy tắc:
 * - viewer chỉ đọc · operator xác nhận cảnh báo + tạo/sửa yêu cầu bảo trì · engineer sửa scene · admin quản lý user.
 * - Phân cấp: engineer có quyền của operator, admin có mọi quyền (⚠ chờ duyệt – xem docs/guide/backend-auth.md (Phụ lục D)).
 */
export const PERMISSIONS = {
  'dashboard:read': 'viewer',
  'alert:read': 'viewer',
  'alert:acknowledge': 'operator',
  'maintenance:read': 'viewer',
  'maintenance:write': 'operator',
  // Nghiệm thu đạt / Yêu cầu làm lại (chi tiết bảo trì).
  'maintenance:review': 'engineer',
  // Ký xác nhận báo cáo vận hành (bước Người kiểm tra) – máy chủ kiểm thêm đúng người kiểm tra của báo cáo.
  'report:sign': 'operator',
  // Ghi nhận mốc kiểm tra báo cáo ngày.
  'report:record': 'operator',
  // Chạy kịch bản AI mô phỏng sự cố (chỉ tính trên dữ liệu tham chiếu, không tác động thiết bị).
  'simulation:run': 'operator',
  // Lưu tham số đầu vào của kịch bản mô phỏng (chỉ lớp mô phỏng).
  'simulation:configure': 'operator',
  'scene:read': 'viewer',
  'scene:write': 'engineer',
  'user:manage': 'admin',
  'audit:read': 'admin',
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Cấp của vai trò (0 = viewer). */
export function roleRank(role: Role): number {
  return ROLES.indexOf(role);
}

/** Vai trò có quyền `permission` không. null/undefined (chưa đăng nhập) → false. */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role || !isRole(role)) return false;
  return roleRank(role) >= roleRank(PERMISSIONS[permission]);
}

/** Danh sách vai trò có quyền – dùng cho `@Roles(...rolesFor('scene:write'))` ở BE. */
export function rolesFor(permission: Permission): Role[] {
  return ROLES.filter((r) => can(r, permission));
}
