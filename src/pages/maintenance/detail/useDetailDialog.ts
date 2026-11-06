import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { MaintenanceRecord } from '@/data/maintenance';
import { assignMode } from '@/features/maintenance/assign';
import type { ProgressFile } from '@/features/maintenance/progress';

export type DetailDialog = 'assign' | 'cancel' | 'progress' | 'submit' | 'review';
export type SubmitPrefill = { text: string; files: readonly ProgressFile[] };

const OPEN_KEYS = ['submit', 'review', 'assign'] as const;

/**
 * Hộp thoại đang mở của trang chi tiết. `?submit=1` / `?review=1` / `?assign=1` (link ngoài, test) → mở sẵn khi trạng thái
 * (và quyền) cho phép, rồi bỏ khỏi URL (giữ hash + state). Kèm nội dung + tệp chuyển từ modal Cập nhật tiến độ sang Gửi nghiệm thu.
 */
export function useDetailDialog(r: MaintenanceRecord, canWrite: boolean) {
  const location = useLocation();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<DetailDialog | null>(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('submit') === '1' && r.status === 'in-progress') return 'submit';
    if (q.get('review') === '1' && r.status === 'review') return 'review';
    if (q.get('assign') === '1' && assignMode(r.status) && canWrite) return 'assign';
    return null;
  });
  const [submitPrefill, setSubmitPrefill] = useState<SubmitPrefill | undefined>();

  // Bỏ query mở sẵn đúng một lần khi vào trang (URL lúc vào); không chạy lại khi điều hướng sau đó.
  const stripped = useRef(false);
  useEffect(() => {
    if (stripped.current) return;
    stripped.current = true;
    const q = new URLSearchParams(location.search);
    if (!OPEN_KEYS.some((k) => q.has(k))) return;
    for (const k of OPEN_KEYS) q.delete(k);
    const s = q.toString();
    navigate({ search: s ? `?${s}` : '', hash: location.hash }, { replace: true, state: location.state });
  }, [location, navigate]);

  return {
    dialog,
    open: (d: DetailDialog) => setDialog(d),
    close: () => setDialog(null),
    submitPrefill,
    /** Modal tiến độ → Gửi nghiệm thu, mang nội dung + tệp sang. */
    continueToSubmit: (prefill: SubmitPrefill) => {
      setSubmitPrefill(prefill);
      setDialog('submit');
    },
    closeSubmit: () => {
      setDialog(null);
      setSubmitPrefill(undefined);
    },
  };
}

/** `#checklist` (nút "Mở checklist" của modal cập nhật tiến độ, từ danh sách hoặc trang này) → cuộn + focus khối Checklist. */
export function useChecklistFocus() {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (location.hash !== '#checklist') return;
    const el = ref.current;
    el?.scrollIntoView?.({ block: 'start' });
    el?.focus({ preventScroll: true });
  }, [location.hash, location.key]);
  return ref;
}
