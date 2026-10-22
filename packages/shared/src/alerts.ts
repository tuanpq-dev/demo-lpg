/**
 * Hợp đồng Cảnh báo (API). FE chỉ `import type` từ file này.
 * Mock FE (`src/mocks/alerts.ts`) dùng `daysAgo` + `time` thay cho `occurredAt` (ngày tương đối để demo) – khi nối API, chuyển đổi ở `src/data/alerts.ts`.
 */
import { z } from 'zod';

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ALERT_STATUSES = ['unacknowledged', 'in-progress', 'done'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const AlertSchema = z.object({
  id: z.string(),
  /** Thời điểm phát sinh, ISO 8601 có múi giờ. */
  occurredAt: z.string().datetime({ offset: true }),
  severity: z.enum(SEVERITIES),
  /** Mã cảnh báo hiển thị (cột "Mã CB"). */
  code: z.string(),
  message: z.string(),
  device: z.string(),
  area: z.string(),
  value: z.string(),
  threshold: z.string(),
  /** Đơn vị: "bar", "% LEL", "°C", "m³/h". */
  unit: z.string(),
  status: z.enum(ALERT_STATUSES),
  assignee: z.string().nullable(),
});
export type Alert = z.infer<typeof AlertSchema>;

/** POST /api/alerts/acknowledge (quyền alert:acknowledge). */
export const AcknowledgeAlertsSchema = z.object({ ids: z.array(z.string()).min(1).max(500) }).strict();
export type AcknowledgeAlertsRequest = z.infer<typeof AcknowledgeAlertsSchema>;
