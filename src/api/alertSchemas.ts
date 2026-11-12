/*
 * Schema response các endpoint cảnh báo (hợp đồng FE – docs/decisions.md "Truy vấn phía máy chủ"): bản ghi `AlertRecord`
 * (hợp đồng `Alert` + trường chỉ FE), trang danh sách, tóm tắt KPI, số đếm, cảnh báo liên quan, tải việc.
 * Nạp LƯỜI cùng ./schemas – chỉ `import type` từ code tải đầu.
 */
import './zodJitless';
import { z } from 'zod/mini';
import type { AlertLoad } from '@/features/alerts/assignStaff';
import type { RelatedAlert } from '@/features/alerts/close';
import type { AlertKind } from '@/features/alerts/kinds';
import type { AlertCounts, AlertListResult, AlertSummary } from '@/features/alerts/query';
import type { AlertHistoryKind, AlertRecord, AlertStatus } from '@/features/alerts/types';
import { allOf, type Assert, type Matches } from './schemaCheck';

const str = z.string();
const optStr = z.optional(z.string());
const count = z.number().check(z.int(), z.gte(0));

const SEVERITY = z.enum(allOf<AlertRecord['severity']>()(['critical', 'high', 'medium', 'low']));
const STATUS = z.enum(allOf<AlertStatus>()(['unacknowledged', 'in-progress', 'resolved', 'done']));
const KIND = z.enum(
  allOf<AlertKind>()([
    'tank-overpressure',
    'gas-leak',
    'fire',
    'temperature-low',
    'temperature-high',
    'filter-dp-high',
    'flow-low',
    'level-low',
    'level-drop',
    'sensor-signal-lost',
    'vibration-high',
    'safety-valve-open',
    'pressure-high',
    'battery-low',
    'pump-standby',
    'generic',
  ]),
);
const HISTORY_KIND = z.enum(
  allOf<AlertHistoryKind>()(['acknowledge', 'assign', 'guide', 'note', 'resolve', 'maintenance', 'support', 'update', 'hold', 'close', 'monitor']),
);
const SOURCE = z.enum(['sensor', 'gauge', 'both']);

export const AlertRecordSchema = z.object({
  // ---- Hợp đồng `Alert` (packages/shared) – thời điểm TƯƠNG ĐỐI daysAgo + time thay cho occurredAt ----
  id: str,
  code: str,
  severity: SEVERITY,
  message: str,
  device: str,
  area: str,
  value: str,
  threshold: str,
  unit: str,
  status: STATUS,
  assignee: z.nullable(str),
  daysAgo: count,
  time: str,
  // ---- Chỉ FE (ALERT_FE_ONLY_FIELDS) ----
  kind: z.optional(KIND),
  direction: z.optional(z.enum(['above', 'below'])),
  tag: optStr,
  notifiedTime: optStr,
  acknowledgedAt: optStr,
  resolvedAt: optStr,
  guide: z.optional(z.record(str, z.object({ at: str, by: str, status: z.optional(z.enum(['pending', 'pass', 'issue', 'na'])), note: optStr }))),
  notes: z.optional(z.array(z.object({ id: str, author: str, at: str, text: str }))),
  history: z.optional(z.array(z.object({ id: str, at: str, kind: HISTORY_KIND, text: str, actor: optStr }))),
  previousValue: optStr,
  collaborators: z.optional(z.array(str)),
  closingReading: z.optional(z.object({ value: z.number(), source: z.enum(['live', 'measured']) })),
  resolution: z.optional(z.object({ kind: z.enum(['handled', 'false-alarm']), closedBy: z.enum(['live', 'field']) })),
  phase: z.optional(z.enum(['inspecting', 'resolving'])),
  hold: z.optional(z.object({ kind: z.enum(['paused', 'needs-support']), reason: str, at: str })),
  readingsAtAlert: z.optional(z.record(str, z.number())),
  readings: z.optional(
    z.object({
      source: SOURCE,
      at: str,
      rows: z.array(z.object({ id: str, before: z.optional(z.number()), after: z.optional(z.number()), manual: z.optional(z.boolean()) })),
    }),
  ),
  verification: z.optional(z.array(str)),
  issue: z.optional(z.object({ kind: str, note: optStr })),
  cause: optStr,
  actionTaken: optStr,
  attachments: z.optional(
    z.array(z.object({ name: str, size: count, kind: z.enum(['image', 'document', 'manual']), isTemp: z.optional(z.boolean()) })),
  ),
  followUp: z.optional(z.object({ minutes: count, until: str, target: z.optional(z.number()), unit: str, owner: str })),
  resolvedBy: optStr,
  closedAt: optStr,
  closedBy: optStr,
  closingNote: optStr,
  closeChecks: z.optional(z.array(str)),
});

const tabCounts = z.object({ all: count, unacknowledged: count, 'in-progress': count, resolved: count, done: count });

/** GET /alerts?… – một trang + số đếm tab + facet. */
export const AlertListResultSchema = z.object({
  rows: z.array(AlertRecordSchema),
  total: count,
  page: z.number().check(z.int(), z.gte(1)),
  tabCounts,
  facets: z.object({ areas: z.array(str), devices: z.array(str) }),
});

export const AlertCountsSchema = z.object({ total: count, critical: count, unacknowledged: count, inProgress: count, done: count });

/** GET /alerts/summary?range */
export const AlertSummarySchema = z.object({ counts: AlertCountsSchema, priority: z.array(AlertRecordSchema) });
/** GET /alerts/:id – 404 ở lớp dữ liệu đổi thành null. */
export const AlertOrNullSchema = z.nullable(AlertRecordSchema);
/** GET /alerts?ids= · ?devices= · ?from&to */
export const AlertArraySchema = z.array(AlertRecordSchema);
/** GET /alerts/related-open?ids= – theo id cảnh báo. */
export const RelatedOpenSchema = z.record(str, z.array(z.object({ id: str, code: str, message: str })));
/** GET /staff/alert-loads – theo tên người phụ trách. */
export const AlertLoadsSchema = z.record(
  str,
  z.object({ active: count, critical: count, busy: z.boolean(), criticalAlerts: z.array(z.object({ id: str, code: str })) }),
);
/** GET /alerts/counts */
export const AlertUnackCountSchema = z.object({ unacknowledged: count });

// Kiểm lúc biên dịch: schema ↔ kiểu FE.
export type _AlertRecord = Assert<Matches<typeof AlertRecordSchema, AlertRecord>>;
export type _AlertList = Assert<Matches<typeof AlertListResultSchema, AlertListResult>>;
export type _AlertCounts = Assert<Matches<typeof AlertCountsSchema, AlertCounts>>;
export type _AlertSummary = Assert<Matches<typeof AlertSummarySchema, AlertSummary>>;
export type _RelatedOpen = Assert<Matches<typeof RelatedOpenSchema, Record<string, RelatedAlert[]>>>;
export type _AlertLoads = Assert<Matches<typeof AlertLoadsSchema, Record<string, AlertLoad>>>;
