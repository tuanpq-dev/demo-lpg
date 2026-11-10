/**
 * Vai trò + quyền phía FE – CHỈ dùng để ẩn/hiện (UX); backend kiểm tra lại mọi request.
 * Nguồn duy nhất: `packages/shared/src/roles.ts` (BE dùng cùng bảng cho guard `@Roles`). Thêm quyền mới → sửa ở đó rồi
 * `npm run build:shared` để backend nhận.
 */
export { ROLES, ROLE_LABELS, can, type Permission, type Role } from '@demo-lpg/shared/roles';
