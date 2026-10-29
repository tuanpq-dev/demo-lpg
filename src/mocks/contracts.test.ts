import { describe, expect, test } from 'vitest';
import { AlertSchema } from '@demo-lpg/shared/alerts';
import { LiveDataSchema } from '@demo-lpg/shared/live';
import { MaintenanceRequestSchema } from '@demo-lpg/shared/maintenance';
import { ALERT_FE_ONLY_FIELDS, alertRecords } from './alerts';
import { AREAS } from './areas';
import { FE_ONLY_FIELDS, maintenanceRecords, type MaintenanceRecord } from './maintenance';

/** Bỏ trường chỉ có ở FE (trang chi tiết – chờ đưa vào hợp đồng API, docs/decisions.md) + đổi về dạng hợp đồng. */
function toContract(r: MaintenanceRecord) {
  const out: Record<string, unknown> = { ...r };
  for (const k of FE_ONLY_FIELDS) delete out[k];
  if (r.checklist) out.checklist = r.checklist.map(({ id, text, done }) => ({ id, text, done }));
  if (r.attachments) out.attachments = r.attachments.map(({ id, name, size }) => ({ id, name, size }));
  return out;
}

/** Mock FE phải khớp hợp đồng API dùng chung (packages/shared) → thay mock bằng API không vỡ UI. */
describe('mock khớp hợp đồng shared', () => {
  test('mọi yêu cầu bảo trì hợp lệ theo MaintenanceRequestSchema (phần thuộc hợp đồng; trạng thái "cancelled" chưa có trong API)', () => {
    for (const r of maintenanceRecords.filter((m) => m.status !== 'cancelled')) {
      const res = MaintenanceRequestSchema.strict().safeParse(toContract(r));
      expect(res.success, `${r.id}: ${res.error?.message}`).toBe(true);
    }
  });

  test('mọi cảnh báo hợp lệ theo AlertSchema (đổi daysAgo + time → occurredAt; trạng thái "resolved" chưa có trong API)', () => {
    for (const { daysAgo, time, ...full } of alertRecords.filter((a) => a.status !== 'resolved')) {
      const rest: Record<string, unknown> & { id: string } = { ...full };
      for (const k of ALERT_FE_ONLY_FIELDS) delete rest[k];
      const occurredAt = `2026-10-${String(22 - daysAgo).padStart(2, '0')}T${time}+07:00`;
      const res = AlertSchema.strict().safeParse({ ...rest, occurredAt });
      expect(res.success, `${rest.id}: ${res.error?.message}`).toBe(true);
    }
  });

  test('khu vực của cảnh báo và yêu cầu bảo trì nằm trong MỘT danh sách khu chung (AREAS)', () => {
    const areas: readonly string[] = AREAS;
    for (const r of [...alertRecords, ...maintenanceRecords]) expect(areas, r.id).toContain(r.area);
  });

  test('LiveData mẫu hợp lệ', () => {
    expect(LiveDataSchema.safeParse({ 'LT-101': { value: 72.4, unit: '%', ts: 0, quality: 'good' } }).success).toBe(true);
  });
});
