/**
 * Chuyên môn của nhân sự – dùng để GỢI Ý sắp xếp trong modal phân công cảnh báo (`ALERT_KINDS[kind].skills` ↔ `STAFF[].skills`).
 * Danh mục tạm do dev đặt (chưa có từ khách – docs/questions.md). TODO(backend): GET danh mục chuyên môn + chuyên môn của nhân sự.
 */
export type StaffSkill = 'pressure' | 'mechanical' | 'gas' | 'fire' | 'safety' | 'instrument' | 'electrical' | 'operations';
