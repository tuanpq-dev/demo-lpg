/*
 * Schema response các endpoint báo cáo (hợp đồng FE – docs/decisions.md "Báo cáo – hợp đồng API cần bổ sung"): bản ghi
 * `ReportRecord`, trang danh sách, số liệu màn báo cáo, báo cáo ngày theo mã. Nạp LƯỜI cùng ./schemas.
 */
import './zodJitless';
import { z } from 'zod/mini';
import type { ReportListResult, ReportRecord, ReportSummary, SignatureStep } from '@/features/reports';
import { allOf, type Assert, type Matches } from './schemaCheck';

const str = z.string();
const optStr = z.optional(z.string());
const count = z.number().check(z.int(), z.gte(0));
/** "yyyy-mm-ddTHH:mm" giờ nhà máy. */
const dayTime = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/));

const PERIOD = z.enum(allOf<ReportRecord['period']>()(['daily', 'monthly', 'quarterly', 'yearly']));
const STEP = z.enum(allOf<SignatureStep>()(['inspector', 'approver', 'tap']));

export const ReportRecordSchema = z.object({
  id: str,
  code: str,
  period: PERIOD,
  /** "2026-06-24" · "2026-06" · "2026-Q2" · "2026". */
  periodKey: str,
  shift: optStr,
  checkpoints: z.array(z.object({ key: str, label: str, dueAt: dayTime, done: z.boolean(), needsVerify: z.optional(z.boolean()) })),
  inspector: str,
  approver: optStr,
  signature: z.union([
    z.object({ status: z.literal('not-sent') }),
    z.object({ status: z.literal('pending'), step: STEP }),
    z.object({ status: z.literal('signed') }),
    z.object({ status: z.literal('rejected'), reason: optStr }),
  ]),
  updatedAt: dayTime,
  shiftRemark: optStr,
  signLog: z.optional(z.array(z.object({ step: STEP, by: str, at: dayTime, note: optStr }))),
  checkpointLog: z.optional(
    z.record(str, z.object({ by: str, at: dayTime, remark: str, manual: z.optional(z.record(str, z.number())), files: z.optional(z.array(str)) })),
  ),
});

/** GET /reports?… – một trang + số đếm tab + facet. */
export const ReportListResultSchema = z.object({
  rows: z.array(ReportRecordSchema),
  total: count,
  page: z.number().check(z.int(), z.gte(1)),
  tabCounts: z.object({ all: count, daily: count, monthly: count, quarterly: count, yearly: count, signed: count }),
  facets: z.object({ shifts: z.array(str), inspectors: z.array(str), approvers: z.array(str) }),
});

/** GET /reports/summary */
export const ReportSummarySchema = z.object({
  kpis: z.object({ total: count, 'in-progress': count, 'missing-data': count, awaiting: count, signed: count }),
  awaitingByStep: z.object({ inspector: count, approver: count, tap: count }),
  monthProgress: z.object({ month: str, total: count, done: count, inProgress: count, missing: count, awaiting: count }),
  actions: z.array(z.object({ id: str, reportId: str, reportCode: str, tone: z.enum(['danger', 'warning']), subject: str, message: str })),
});

/** GET /reports/daily/:code – 404 ở lớp dữ liệu đổi thành null. */
export const DailyReportOrNullSchema = z.nullable(ReportRecordSchema);

// Kiểm lúc biên dịch: schema ↔ kiểu FE.
export type _ReportRecord = Assert<Matches<typeof ReportRecordSchema, ReportRecord>>;
export type _ReportList = Assert<Matches<typeof ReportListResultSchema, ReportListResult>>;
export type _ReportSummary = Assert<Matches<typeof ReportSummarySchema, ReportSummary>>;
