/**
 * Hợp đồng Yêu cầu bảo trì (API) – khớp đúng `MaintenanceRecord` của FE (`src/mocks/maintenance.ts` dùng kiểu này).
 * FE chỉ `import type` từ file này.
 */
import { z } from 'zod';
import { SEVERITIES } from './alerts.js';

export const MAINTENANCE_STATUSES = ['pending', 'assigned', 'in-progress', 'review', 'done'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_TYPES = ['periodic', 'incident', 'inspection'] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

export const MAINTENANCE_SOURCES = ['alert', 'manual', 'schedule', 'inspection'] as const;
export type MaintenanceSource = (typeof MAINTENANCE_SOURCES)[number];

export const SHIFT_IDS = ['shift-1', 'shift-2', 'shift-3'] as const;
export type ShiftId = (typeof SHIFT_IDS)[number];

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'yyyy-mm-dd');
const dayTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'yyyy-mm-ddTHH:mm');

export const MaintenanceRequestSchema = z.object({
  id: z.string(),
  /** "MT-00128" */
  code: z.string(),
  /** Cột "Nội dung". */
  title: z.string(),
  description: z.string().optional(),
  device: z.string(),
  area: z.string(),
  type: z.enum(MAINTENANCE_TYPES),
  priority: z.enum(SEVERITIES),
  status: z.enum(MAINTENANCE_STATUSES),
  assignee: z.string().nullable(),
  /** Ngày theo giờ nhà máy (Asia/Bangkok). */
  createdAt: day,
  dueAt: dayTime,
  completedAt: day.nullable(),
  /** 0–100 */
  progress: z.number().min(0).max(100),
  /** Cảnh báo gốc (nếu tạo từ /alerts). */
  sourceAlertId: z.string().optional(),
  // ---- Trường của form "Tạo yêu cầu bảo trì" ----
  source: z.enum(MAINTENANCE_SOURCES).optional(),
  referenceCode: z.string().optional(),
  startAt: dayTime.optional(),
  department: z.string().optional(),
  shift: z.enum(SHIFT_IDS).optional(),
  collaborators: z.array(z.string()).optional(),
  checklist: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })).optional(),
  attachments: z.array(z.object({ id: z.string(), name: z.string(), size: z.number().nonnegative() })).optional(),
  notes: z.string().optional(),
  /** Yêu cầu Giấy phép Làm việc (Permit to Work – PTW). */
  requiresPermit: z.boolean().optional(),
});
export type MaintenanceRequest = z.infer<typeof MaintenanceRequestSchema>;

/** Tạo mới: server sinh id/code/createdAt/progress/status. */
export const CreateMaintenanceSchema = MaintenanceRequestSchema.omit({
  id: true,
  code: true,
  createdAt: true,
  completedAt: true,
  progress: true,
  status: true,
}).strict();
export type CreateMaintenanceRequest = z.infer<typeof CreateMaintenanceSchema>;
