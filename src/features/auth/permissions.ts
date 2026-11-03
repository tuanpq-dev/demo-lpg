/**
 * Vai trò + quyền phía FE – CHỈ dùng để ẩn/hiện (UX); backend kiểm tra lại mọi request.
 * FE tự định nghĩa (không phụ thuộc packages/shared). Giá trị `role` phải khớp `user.role` backend trả về
 * (schema ở src/api/types.ts) – ⚠ hợp đồng API chưa liệt kê tập giá trị role, đang dùng 4 vai trò của dự án.
 */
export const ROLES = ['viewer', 'operator', 'engineer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  viewer: 'Người xem',
  operator: 'Vận hành',
  engineer: 'Kỹ sư',
  admin: 'Quản trị',
};

/** Quyền → vai trò tối thiểu (vai trò sau có mọi quyền vai trò trước). */
export const PERMISSIONS = {
  'alert:acknowledge': 'operator',
  'maintenance:write': 'operator',
  // Nghiệm thu đạt / Yêu cầu làm lại (chi tiết bảo trì). TODO(backend): @Roles tương ứng khi có endpoint bảo trì.
  'maintenance:review': 'engineer',
  'scene:write': 'engineer',
  // Ký xác nhận báo cáo vận hành (bước Người kiểm tra). TODO(backend): máy chủ kiểm đúng người kiểm tra của báo cáo.
  'report:sign': 'operator',
  // Ghi nhận mốc kiểm tra báo cáo ngày (modal "Ghi nhận mốc kiểm tra"). TODO(backend): @Roles tương ứng.
  'report:record': 'operator',
  // Chạy kịch bản AI mô phỏng sự cố (chỉ tính trên dữ liệu tham chiếu, không tác động thiết bị). TODO(backend): @Roles tương ứng.
  'simulation:run': 'operator',
  // Lưu tham số đầu vào của kịch bản mô phỏng (màn Cấu hình kịch bản – chỉ lớp mô phỏng). TODO(backend): @Roles tương ứng.
  'simulation:configure': 'operator',
  'user:manage': 'admin',
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Chưa đăng nhập / vai trò lạ → false. */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return ROLES.indexOf(role) >= ROLES.indexOf(PERMISSIONS[permission]);
}
