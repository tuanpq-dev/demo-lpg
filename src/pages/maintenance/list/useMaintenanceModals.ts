import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AlertRecord } from '@/data/alerts';
import type { MaintenanceRecord } from '@/data/maintenance';
import { linkedMaintenance } from '@/features/alerts/workflow';
import { canAssign } from '@/features/maintenance/assign';
import { canUpdateProgress, type ProgressFile } from '@/features/maintenance/progress';

export type SubmitPrefill = { text: string; files: readonly ProgressFile[] };

export type UseMaintenanceModalsOptions = {
  all: readonly MaintenanceRecord[];
  alerts: readonly AlertRecord[] | undefined;
  search: URLSearchParams;
  /** Ghi / xoá query phụ của bảng (`useTableFilters().setExtra`). */
  setExtra: (patch: Record<string, string | null>) => void;
  canWrite: boolean;
  canReview: boolean;
};

/**
 * Modal của danh sách bảo trì điều khiển qua URL: tạo `?create=1&device=&from=` (để /alerts mở sẵn được; cảnh báo đã có yêu
 * cầu chưa hủy → chuyển sang yêu cầu đó), tiến độ `?progress=`, gửi nghiệm thu `?submit=` (nội dung điền sẵn từ modal tiến
 * độ), nghiệm thu `?review=`, phân công `?assign=`. Bản ghi chỉ mở khi có quyền + đúng bước; sai → không mở.
 */
export function useMaintenanceModals({ all, alerts, search, setExtra, canWrite, canReview }: UseMaintenanceModalsOptions) {
  const navigate = useNavigate();

  // ---- Tạo yêu cầu
  const fromAlert = search.get('from');
  const sourceAlert = fromAlert ? alerts?.find((a) => a.id === fromAlert) : undefined;
  // Cảnh báo đã có yêu cầu (chưa hủy) → không mở form tạo trùng, chuyển sang yêu cầu đó.
  const linkedFromAlert = fromAlert ? linkedMaintenance(fromAlert, all) : undefined;
  const createOpen = canWrite && search.get('create') === '1' && !linkedFromAlert;
  useEffect(() => {
    if (linkedFromAlert && search.get('create') === '1') navigate(`/maintenance/${linkedFromAlert.id}`, { replace: true });
  }, [linkedFromAlert, search, navigate]);

  // ---- Cập nhật tiến độ (badge của dòng Đã phân công / Đang thực hiện).
  // TODO(backend): chỉ người được phân công cập nhật tiến độ (hiện: mọi vai trò có maintenance:write).
  const progressId = search.get('progress');
  const progress = canWrite && progressId ? all.find((r) => r.id === progressId && canUpdateProgress(r.status)) : undefined;

  // ---- Gửi nghiệm thu (từ "Tiếp tục gửi nghiệm thu" của modal tiến độ) · Nghiệm thu (badge "Chờ nghiệm thu").
  const [submitPrefill, setSubmitPrefill] = useState<SubmitPrefill | undefined>();
  const submitId = search.get('submit');
  const submit = canWrite && submitId ? all.find((r) => r.id === submitId && r.status === 'in-progress') : undefined;
  const reviewId = search.get('review');
  const review = canReview && reviewId ? all.find((r) => r.id === reviewId && r.status === 'review') : undefined;

  // ---- Phân công (badge "Chờ tiếp nhận"): chỉ Chờ tiếp nhận (đổi người làm ở trang chi tiết).
  const assignId = search.get('assign');
  const assign = canWrite && assignId ? all.find((r) => r.id === assignId && canAssign(r.status)) : undefined;

  return {
    create: { open: createOpen, sourceAlert, device: search.get('device') ?? undefined },
    progress,
    submit,
    submitPrefill,
    review,
    assign,
    openCreate: () => setExtra({ create: '1' }),
    closeCreate: () => setExtra({ create: null, device: null, from: null }),
    closeProgress: () => setExtra({ progress: null }),
    closeSubmit: () => {
      setSubmitPrefill(undefined);
      setExtra({ submit: null });
    },
    closeReview: () => setExtra({ review: null }),
    closeAssign: () => setExtra({ assign: null }),
    /** Modal tiến độ → gửi nghiệm thu, mang nội dung + tệp sang. */
    continueToSubmit: (id: string, prefill: SubmitPrefill) => {
      setSubmitPrefill(prefill);
      setExtra({ progress: null, submit: id });
    },
  };
}

export type MaintenanceModalsState = ReturnType<typeof useMaintenanceModals>;
