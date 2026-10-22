import { describe, expect, test } from 'vitest';
import { AlertSchema } from '@demo-lpg/shared/alerts';
import { LiveDataSchema } from '@demo-lpg/shared/live';
import { MaintenanceRequestSchema } from '@demo-lpg/shared/maintenance';
import { alertRecords } from './alerts';
import { maintenanceRecords } from './maintenance';

/** Mock FE phải khớp hợp đồng API dùng chung (packages/shared) → thay mock bằng API không vỡ UI. */
describe('mock khớp hợp đồng shared', () => {
  test('mọi yêu cầu bảo trì hợp lệ theo MaintenanceRequestSchema', () => {
    for (const r of maintenanceRecords) {
      const res = MaintenanceRequestSchema.strict().safeParse(r);
      expect(res.success, `${r.id}: ${res.error?.message}`).toBe(true);
    }
  });

  test('mọi cảnh báo hợp lệ theo AlertSchema (đổi daysAgo + time → occurredAt)', () => {
    for (const { daysAgo, time, ...rest } of alertRecords) {
      const occurredAt = `2026-10-${String(22 - daysAgo).padStart(2, '0')}T${time}+07:00`;
      const res = AlertSchema.strict().safeParse({ ...rest, occurredAt });
      expect(res.success, `${rest.id}: ${res.error?.message}`).toBe(true);
    }
  });

  test('LiveData mẫu hợp lệ', () => {
    expect(LiveDataSchema.safeParse({ 'LT-101': { value: 72.4, unit: '%', ts: 0, quality: 'good' } }).success).toBe(true);
  });
});
