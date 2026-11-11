/*
 * Lớp dữ liệu modal "Hoàn thành nhận xét & ký xác nhận" (bước Người kiểm tra của báo cáo ngày).
 * Điều kiện ký cần: bản ghi báo cáo (store `useReports`), số đo theo mốc (`fetchDailyReadings`) và cảnh báo lỗi cảm biến
 * trong ngày báo cáo (store cảnh báo). Lúc ký, kiểm lại toàn bộ điều kiện từ dữ liệu HIỆN TẠI – không tin trạng thái modal.
 */
import { useMemo } from 'react';
import {
  applyInspectorSign,
  canInspectorSign,
  dayFromNumber,
  openSensorFaults,
  signConditions,
  signReady,
  type ReportRecord,
  type SensorAlertLike,
} from '@/features/reports';
import { appNow } from '@/lib/demoNow';
import { dayNumber, plantDayKey } from '@/lib/plantTime';
import type { AlertRecord } from '@/features/alerts/types';
import { alertsReady, currentAlerts, useAlertList } from './alertStore';
import { fetchDailyReadings, useDailyReadings } from './dailyReport';
import { currentReports, replaceReport } from './reports';

/** Cảnh báo mock ghi ngày tương đối (`daysAgo`) → ngày tuyệt đối theo `now` (giờ nhà máy). */
function sensorAlertsOf(alerts: readonly AlertRecord[], now: Date): SensorAlertLike[] {
  const today = dayNumber(plantDayKey(now));
  return alerts.map((a) => ({ code: a.code, kind: a.kind, status: a.status, day: dayFromNumber(today - a.daysAgo) }));
}

/**
 * Số đo + lỗi cảm biến của báo cáo đang mở modal (cập nhật khi cảnh báo đổi trạng thái). `readings` = trạng thái tải số đo
 * (`{ status, data, error, refetch }`) – modal chỉ dựng form khi `success` (điều kiện ký không tính trên số chưa tải).
 */
export function useReportSignData(report: ReportRecord) {
  const alerts = useAlertList();
  const readings = useDailyReadings(report);
  const list = alerts.data ?? currentAlerts();
  const sensorFaults = useMemo(() => openSensorFaults(sensorAlertsOf(list, appNow()), report.periodKey), [list, report.periodKey]);
  return { readings, sensorFaults };
}

export type InspectorSignInput = { note?: string; draftReviewed: boolean; responsibility: boolean };
export type SignResult = { ok: true; record: ReportRecord } | { ok: false; error: string };

/**
 * Người kiểm tra ký báo cáo ngày `id`. TODO(backend): `POST /reports/:code/sign` (kèm mã xác nhận nếu hệ thống bật) –
 * máy chủ kiểm quyền (đúng người kiểm tra) + điều kiện; FE chỉ kiểm để báo lỗi sớm.
 */
export async function signDailyReport(id: string, input: InspectorSignInput): Promise<SignResult> {
  await alertsReady();
  const now = appNow();
  const r = currentReports().find((x) => x.id === id);
  if (!r || !canInspectorSign(r, now)) return { ok: false, error: 'Báo cáo không còn ở bước chờ Người kiểm tra ký.' };
  const conditions = signConditions({
    report: r,
    rows: await fetchDailyReadings(r),
    sensorFaults: openSensorFaults(sensorAlertsOf(currentAlerts(), now), r.periodKey),
    draftReviewed: input.draftReviewed,
    responsibility: input.responsibility,
  });
  if (!signReady(conditions)) {
    const unmet = conditions.filter((c) => !c.met).map((c) => c.label);
    return { ok: false, error: `Chưa đủ điều kiện ký: ${unmet.join('; ')}.` };
  }
  const record = applyInspectorSign(r, { note: input.note, at: now });
  replaceReport(record);
  return { ok: true, record };
}
