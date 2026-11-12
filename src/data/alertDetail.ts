/*
 * Phần CHỈ drawer chi tiết cảnh báo cần (ngưỡng theo cấu hình tag, playbook, số trực tiếp, nhân sự) – tách khỏi
 * `data/alerts.ts` vì file đó nằm trong bundle chính (`LiveAnnouncer` dùng `useAlerts`): kéo mock tài sản/nhân sự vào
 * đây thì chỉ chunk trang Cảnh báo phải tải.
 */

/** Thay `{device}`, `{safetyValve}`… trong chữ cấu hình loại cảnh báo (bảng van / bộ điều áp là dữ liệu cấu hình). */
export { fillPlaybookText } from '@/mocks/alertKinds';
import type { AlertAssignForm } from '@/features/alerts/assign';
import { createSessionDraft } from '@/lib/sessionDraft';

/** Nháp = form phân công trừ ô thông báo (mặc định lại theo mức độ khi mở). */
export type AlertAssignDraft = Omit<AlertAssignForm, 'notify'> & { /** ISO */ savedAt: string };

const alertAssignDraft = createSessionDraft<AlertAssignDraft>('demo-lpg:alert-assign-draft:', (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<AlertAssignDraft>;
  const str = (v: unknown): v is string => typeof v === 'string';
  if (!str(d.note) || !str(d.reason) || !Array.isArray(d.collaborators)) return null;
  if (d.assignee !== null && !str(d.assignee)) return null;
  return {
    assignee: d.assignee ?? null,
    collaborators: d.collaborators.filter(str),
    note: d.note,
    reason: d.reason,
    savedAt: str(d.savedAt) ? d.savedAt : '',
  };
});

export const saveAlertAssignDraft = alertAssignDraft.save;
export const loadAlertAssignDraft = alertAssignDraft.load;
export const clearAlertAssignDraft = alertAssignDraft.clear;

// Điểm import chung của dữ liệu chi tiết cảnh báo.
export * from './alertBase';
export * from './alertLive';
export * from './alertUpdateData';
export * from './alertClose';
