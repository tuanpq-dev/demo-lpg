/**
 * Chuyên môn của nhân sự – dùng để GỢI Ý sắp xếp trong modal phân công cảnh báo (`ALERT_KINDS[kind].skills` ↔ `STAFF[].skills`).
 * Danh mục tạm do dev đặt (chưa có từ khách – CLAUDE.md mục 7). TODO(backend): GET danh mục chuyên môn + chuyên môn của nhân sự.
 */
export const STAFF_SKILLS = ['pressure', 'mechanical', 'gas', 'fire', 'safety', 'instrument', 'electrical', 'operations'] as const;
export type StaffSkill = (typeof STAFF_SKILLS)[number];

export const STAFF_SKILL_LABEL: Readonly<Record<StaffSkill, string>> = {
  pressure: 'Thiết bị áp lực',
  mechanical: 'Cơ khí',
  gas: 'Khí gas',
  fire: 'PCCC',
  safety: 'An toàn',
  instrument: 'Đo lường',
  electrical: 'Điện',
  operations: 'Vận hành',
};
