/**
 * Nhãn trạng thái nhân sự DÙNG CHUNG cho modal phân công bảo trì và cảnh báo: Sẵn sàng / Bận / Ngoài ca.
 * Không phụ thuộc gì (component thuần) – cách tính ở `features/staff/availability.ts`.
 */
export type Availability = 'available' | 'busy' | 'off-shift';

export const AVAILABILITY_LABEL: Readonly<Record<Availability, string>> = {
  available: 'Sẵn sàng',
  busy: 'Bận',
  'off-shift': 'Ngoài ca',
};
