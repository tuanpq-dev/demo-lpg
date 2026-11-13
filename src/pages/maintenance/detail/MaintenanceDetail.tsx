import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AUTH_MODE } from '@/api/auth';
import { useAuth, useCan } from '@/app/auth';
import { Page } from '@/app/Page';
import { useAlertById } from '@/data/alertApi';
import { isOverdue, useMaintenance, type MaintenanceRecord } from '@/data/maintenance';
import { resolveReviewer } from '@/features/maintenance/review';
import { NEXT_ACTION_LABEL } from '@/features/maintenance/workflow';
import { runAction } from '@/lib/actionError';
import { announce } from '@/lib/announce';
import { useNow } from '@/hooks/useNow';
import { preloadMaintenanceModals } from '../lazyModals';
import { DetailActionBar } from './DetailActionBar';
import { DetailAside } from './DetailAside';
import { DetailHeader, DetailStepper } from './DetailHeader';
import { DetailModals } from './DetailModals';
import { GeneralInfoCard } from './GeneralInfoCard';
import { LiveDeadline } from './LiveCards';
import { useChecklistFocus, useDetailDialog } from './useDetailDialog';
import { AttachmentsCard, ChecklistCard, HistoryCard, NotesCard, ResultCard, WorkContentCard } from './WorkCards';

/**
 * Chi tiết yêu cầu bảo trì – ảnh MT-00128 (public/figma-ref/mt-detail-design.png, chưa có node Figma).
 * Header + stepper full-width · lưới 2 cột 7fr/3fr (≥ wide: cột phải `--mt-aside-width`), dưới xl xếp chồng ·
 * thanh hành động dính đáy. Mọi số liệu suy từ bản ghi (`useMaintenance`), cảnh báo nguồn (`useAlertById`), live (`useLiveData`).
 * Thao tác ghi nhanh (Tiếp nhận, tick checklist; thêm ghi chú trong NotesThread) qua `runAction` – lỗi hiện toast.
 */
export function MaintenanceDetail({ record: r, listUrl }: { record: MaintenanceRecord; listUrl: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const now = useNow(60_000);
  const { user } = useAuth();
  // TODO(backend): quyền chi tiết theo vai trò – chỉ người được phân công tick checklist / cập nhật tiến độ (cần ánh xạ
  // user ↔ người phụ trách). Nghiệm thu: `maintenance:review` (kỹ sư / quản trị).
  const canWrite = useCan('maintenance:write');
  const canReview = useCan('maintenance:review');
  const actor = user?.name || 'Admin';
  const maintenance = useMaintenance();
  const { advance, toggleChecklist, addNote } = maintenance;
  // Cảnh báo nguồn: đọc theo id (GET /alerts/:id) – không tải toàn bộ cảnh báo.
  const alert = useAlertById(r.sourceAlertId).data ?? undefined;
  const dialogs = useDetailDialog(r, canWrite);
  // Modal tiến độ / nghiệm thu / phân công là chunk lười – nạp trước lúc rảnh để lần bấm đầu không chờ mạng.
  useEffect(preloadMaintenanceModals, []);
  const checklistRef = useChecklistFocus();
  const reviewer = resolveReviewer({ authOff: AUTH_MODE === 'off', userName: user?.name, submission: r.submission });
  const overdue = isOverdue(r, now);
  const closed = r.status === 'done' || r.status === 'cancelled';

  const onAdvance = async () => {
    const label = NEXT_ACTION_LABEL[r.status];
    await advance(r.id, actor);
    announce(`${r.code}: ${label} – đã ghi lịch sử.`);
  };
  const onToggle = (itemId: string) => {
    const item = r.checklist!.find((c) => c.id === itemId)!;
    void runAction(async () => {
      await toggleChecklist(r.id, itemId);
      announce(`${item.done ? 'Bỏ đánh dấu' : 'Đã hoàn thành'}: ${item.text}`);
    });
  };

  return (
    <Page pageHeader={<DetailHeader record={r} listUrl={listUrl} overdue={overdue} onBack={() => void navigate(listUrl)} />}>
      <DetailStepper record={r} />

      {/*
        Thứ tự DOM = thứ tự nhìn thấy ở màn hẹp (< xl): Hạn chót → cột trái → phần còn lại của cột phải (Tab khớp).
        ≥ xl: lưới 2 cột – Hạn chót ở cột phải hàng 1, cột trái trải 2 hàng, phần còn lại ở cột phải hàng 2. Ô hạn chót
        không có phần tử nhận focus nên thứ tự Tab ở màn rộng vẫn là trái → phải. Không dùng CSS `order`.
      */}
      <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:grid-rows-[auto_1fr] wide:grid-cols-[minmax(0,1fr)_var(--mt-aside-width)]">
        <div className="min-w-0 xl:col-start-2 xl:row-start-1">
          <LiveDeadline record={r} />
        </div>

        {/* ---- Cột trái ---- */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <GeneralInfoCard record={r} now={now} overdue={overdue} />
          <WorkContentCard record={r} />
          <ChecklistCard record={r} canWrite={canWrite} focusRef={checklistRef} onToggle={onToggle} />
          <NotesCard record={r} now={now} onAdd={canWrite && r.status !== 'cancelled' ? (text) => addNote(r.id, text, actor) : undefined} />
          <AttachmentsCard record={r} />
          <HistoryCard record={r} now={now} />
          <ResultCard record={r} />
        </div>

        {/* ---- Cột phải ---- */}
        <DetailAside record={r} alert={alert} canWrite={canWrite} onAssign={() => dialogs.open('assign')} />
      </div>

      {canWrite && !closed && <DetailActionBar record={r} canReview={canReview} onAdvance={() => void runAction(onAdvance)} onOpen={dialogs.open} />}

      <DetailModals
        record={r}
        dialogs={dialogs}
        ops={maintenance}
        actor={actor}
        reviewer={reviewer}
        onOpenChecklist={() => {
          dialogs.close();
          void navigate({ hash: 'checklist' }, { replace: true, state: location.state });
        }}
      />
    </Page>
  );
}
