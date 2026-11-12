/*
 * Schema response các endpoint bảo trì (hợp đồng FE – docs/decisions.md "Truy vấn phía máy chủ – trang Bảo trì"): bản ghi
 * `MaintenanceRecord` (hợp đồng `MaintenanceRequest` + trường chỉ FE), trang danh sách, tóm tắt KPI, tải việc, danh bạ thiết bị.
 * Nạp LƯỜI cùng ./schemas – chỉ `import type` từ code tải đầu.
 */
import './zodJitless';
import { z } from 'zod/mini';
import type { StaffWorkload } from '@/features/maintenance/assign';
import type { MaintenanceCounts, MaintenanceListResult, MaintenanceSummary } from '@/features/maintenance/query';
import type {
  ApiMaintenanceStatus,
  MaintenanceHistoryKind,
  MaintenanceRecord,
  MaintenanceSource,
  MaintenanceStatus,
  MaintenanceType,
  ShiftId,
} from '@/features/maintenance/types';
import { allOf, type Assert, type Matches } from './schemaCheck';

const str = z.string();
const optStr = z.optional(z.string());
const count = z.number().check(z.int(), z.gte(0));
const percent = z.number().check(z.gte(0), z.lte(100));
/** "yyyy-mm-dd" giờ nhà máy. */
const day = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/));
/** "yyyy-mm-ddTHH:mm" giờ nhà máy. */
const dayTime = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/));

const API_STATUSES = allOf<ApiMaintenanceStatus>()(['pending', 'assigned', 'in-progress', 'review', 'done']);
const STATUS = z.enum(allOf<MaintenanceStatus>()([...API_STATUSES, 'cancelled']));
const HISTORY_KIND = z.enum(
  allOf<MaintenanceHistoryKind>()([
    'create',
    'notify',
    'priority',
    'assign',
    'reassign',
    'accept',
    'start',
    'progress',
    'pause',
    'block',
    'resume',
    'review',
    'rework',
    'submit',
    'review-pass',
    'review-needs-info',
    'review-fail',
    'done',
    'cancel',
  ]),
);
const reading = z.object({ tag: optStr, value: z.nullable(z.number()), warn: z.optional(z.number()) });

export const MaintenanceRecordSchema = z.object({
  // ---- Hợp đồng `MaintenanceRequest` (packages/shared) ----
  id: str,
  code: str,
  title: str,
  description: optStr,
  device: str,
  area: str,
  type: z.enum(allOf<MaintenanceType>()(['periodic', 'incident', 'inspection'])),
  priority: z.enum(allOf<MaintenanceRecord['priority']>()(['critical', 'high', 'medium', 'low'])),
  status: STATUS,
  assignee: z.nullable(str),
  createdAt: day,
  dueAt: dayTime,
  completedAt: z.nullable(day),
  progress: percent,
  sourceAlertId: optStr,
  source: z.optional(z.enum(allOf<MaintenanceSource>()(['alert', 'manual', 'schedule', 'inspection']))),
  referenceCode: optStr,
  startAt: z.optional(dayTime),
  department: optStr,
  shift: z.optional(z.enum(allOf<ShiftId>()(['shift-1', 'shift-2', 'shift-3']))),
  collaborators: z.optional(z.array(str)),
  requiresPermit: z.optional(z.boolean()),
  checklist: z.optional(
    z.array(z.object({ id: str, text: str, done: z.boolean(), doneAt: optStr, na: z.optional(z.boolean()), active: z.optional(z.boolean()) })),
  ),
  attachments: z.optional(
    z.array(
      z.object({ id: str, name: str, size: count, kind: z.optional(z.enum(['image', 'document', 'manual'])), isTemp: z.optional(z.boolean()) }),
    ),
  ),
  // ---- Chỉ FE (FE_ONLY_FIELDS) ----
  cancelledFrom: z.optional(z.enum(API_STATUSES)),
  cancelReason: optStr,
  reportedProgress: z.optional(percent),
  hold: z.optional(z.object({ kind: z.enum(['paused', 'blocked']), reason: str, at: str })),
  dueHasTime: z.optional(z.boolean()),
  createdBy: optStr,
  objectives: z.optional(z.array(str)),
  notes: z.optional(z.array(z.object({ id: str, author: str, at: str, text: str }))),
  history: z.optional(z.array(z.object({ id: str, at: str, kind: HISTORY_KIND, text: str, actor: optStr }))),
  submission: z.optional(
    z.object({
      summary: str,
      cause: str,
      remedy: str,
      deviceCondition: z.enum(['normal', 'monitor', 'unresolved']),
      readings: z.object({ pressure: z.optional(reading), temperature: z.optional(reading), at: str }),
      sensorStatus: z.enum(['normal', 'monitor', 'fault']),
      valveStatus: z.enum(['stable', 'leak', 'stuck']),
      reviewer: str,
      proposedAt: optStr,
      submittedBy: str,
      submittedAt: str,
    }),
  ),
  review: z.optional(
    z.object({
      result: z.enum(['pass', 'needs-info', 'fail']),
      reviewer: str,
      comment: optStr,
      followUpHours: z.optional(z.number()),
      followUpUntil: optStr,
      at: str,
    }),
  ),
  reviewFailed: z.optional(z.boolean()),
});

const tabCounts = z.object({
  all: count,
  pending: count,
  assigned: count,
  'in-progress': count,
  review: count,
  done: count,
  overdue: count,
});

/** GET /maintenance?… – một trang + số đếm tab + facet. */
export const MaintenanceListResultSchema = z.object({
  rows: z.array(MaintenanceRecordSchema),
  total: count,
  page: z.number().check(z.int(), z.gte(1)),
  tabCounts,
  facets: z.object({ areas: z.array(str) }),
});

export const MaintenanceCountsSchema = z.object({
  createdThisMonth: count,
  createdLastMonth: count,
  pending: count,
  inProgress: count,
  review: count,
  doneThisMonth: count,
  overdue: count,
});

/** GET /maintenance/summary */
export const MaintenanceSummarySchema = z.object({
  counts: MaintenanceCountsSchema,
  priority: z.array(MaintenanceRecordSchema),
  schedule: z.array(MaintenanceRecordSchema),
});
/** GET /maintenance/:id – 404 ở lớp dữ liệu đổi thành null. */
export const MaintenanceOrNullSchema = z.nullable(MaintenanceRecordSchema);
/** GET /maintenance?device= */
export const MaintenanceArraySchema = z.array(MaintenanceRecordSchema);
/** GET /maintenance?sourceAlertId= – yêu cầu đang hiệu lực tạo từ cảnh báo (null = chưa có). */
export const LinkedMaintenanceSchema = z.nullable(z.object({ id: str, code: str, status: STATUS }));
/** GET /devices – danh bạ thiết bị → khu vực. */
export const DeviceDirectorySchema = z.array(z.object({ device: str, area: str }));
/** GET /staff/maintenance-loads – theo tên người xử lý chính. */
export const MaintenanceLoadsSchema = z.record(str, z.object({ active: count, overdue: count, busy: z.boolean() }));

// Kiểm lúc biên dịch: schema ↔ kiểu FE.
export type _MaintenanceRecord = Assert<Matches<typeof MaintenanceRecordSchema, MaintenanceRecord>>;
export type _MaintenanceList = Assert<Matches<typeof MaintenanceListResultSchema, MaintenanceListResult>>;
export type _MaintenanceCounts = Assert<Matches<typeof MaintenanceCountsSchema, MaintenanceCounts>>;
export type _MaintenanceSummary = Assert<Matches<typeof MaintenanceSummarySchema, MaintenanceSummary>>;
export type _MaintenanceLoads = Assert<Matches<typeof MaintenanceLoadsSchema, Record<string, StaffWorkload>>>;
