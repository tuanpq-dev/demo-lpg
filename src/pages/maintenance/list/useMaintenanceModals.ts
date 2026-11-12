import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlertById } from '@/data/alertApi';
import { useLinkedMaintenance, useMaintenanceById } from '@/data/maintenanceApi';
import { canAssign } from '@/features/maintenance/assign';
import { canUpdateProgress, type ProgressFile } from '@/features/maintenance/progress';

export type SubmitPrefill = { text: string; files: readonly ProgressFile[] };

export type UseMaintenanceModalsOptions = {
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
 * Bản ghi của modal đọc theo mã (GET /maintenance/:id), cảnh báo nguồn + yêu cầu đã có của nó cũng hỏi máy chủ – không cần
 * danh sách đầy đủ.
 */
export function useMaintenanceModals({ search, setExtra, canWrite, canReview }: UseMaintenanceModalsOptions) {
  const navigate = useNavigate();

  // ---- Tạo yêu cầu
  const fromAlert = search.get('from');
  const sourceAlert = useAlertById(fromAlert).data ?? undefined;
  // Cảnh báo đã có yêu cầu (chưa hủy) → không mở form tạo trùng, chuyển sang yêu cầu đó. Đang hỏi máy chủ (`undefined`)
  // → chưa mở form (không nháy form rồi mới chuyển trang).
  const linkedFromAlert = useLinkedMaintenance(fromAlert);
  const createOpen = canWrite && search.get('create') === '1' && (!fromAlert || linkedFromAlert === null);
  useEffect(() => {
    if (linkedFromAlert && search.get('create') === '1') void navigate(`/maintenance/${linkedFromAlert.id}`, { replace: true });
  }, [linkedFromAlert, search, navigate]);

  // ---- Cập nhật tiến độ (badge của dòng Đã phân công / Đang thực hiện).
  // TODO(backend): chỉ người được phân công cập nhật tiến độ (hiện: mọi vai trò có maintenance:write).
  const progressId = search.get('progress');
  const submitId = search.get('submit');
  const reviewId = search.get('review');
  const assignId = search.get('assign');
  // Một modal mở một lúc → đọc MỘT bản ghi theo mã đang có trên URL.
  const target = useMaintenanceById(progressId ?? submitId ?? reviewId ?? assignId).data ?? undefined;
  const pick = (id: string | null, ok: boolean, step: (s: NonNullable<typeof target>['status']) => boolean) =>
    ok && id && target?.id === id && step(target.status) ? target : undefined;
  const progress = pick(progressId, canWrite, canUpdateProgress);

  // ---- Gửi nghiệm thu (từ "Tiếp tục gửi nghiệm thu" của modal tiến độ) · Nghiệm thu (badge "Chờ nghiệm thu").
  const [submitPrefill, setSubmitPrefill] = useState<SubmitPrefill | undefined>();
  const submit = pick(submitId, canWrite, (s) => s === 'in-progress');
  const review = pick(reviewId, canReview, (s) => s === 'review');

  // ---- Phân công (badge "Chờ tiếp nhận"): chỉ Chờ tiếp nhận (đổi người làm ở trang chi tiết).
  const assign = pick(assignId, canWrite, canAssign);

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
