import { Suspense, lazy, useEffect, useState } from 'react';
import { followUpConfig } from '@/data/alertDetail';
import { useAlertById } from '@/data/alertApi';
import { useAlerts, type AlertRecord } from '@/data/alerts';
import {
  DuplicateFromAlertError,
  createMaintenanceRequest,
  useDeviceDirectory,
  useLinkedMaintenance,
  type NewMaintenanceInput,
} from '@/data/maintenanceApi';
import { announce } from '@/lib/announce';
import { preloadWhenIdle } from '@/lib/whenIdle';
import type { AlertDrawerHandlers } from './AlertDetailDrawer';

// Drawer chi tiết (+ panel theo loại, modal phân công/hỗ trợ/quy trình khẩn) và modal tạo bảo trì chỉ cần khi mở → chunk
// lười, nạp trước lúc trình duyệt rảnh sau khi bảng đã hiện (chunk trang chỉ còn danh sách + KPI).
const loadDrawer = () => import('./AlertDetailDrawer');
const loadCreateMaintenance = () => import('../shared/maintenance/CreateMaintenanceModal');
const AlertDetailDrawer = lazy(() => loadDrawer().then((m) => ({ default: m.AlertDetailDrawer })));
const CreateMaintenanceModal = lazy(() => loadCreateMaintenance().then((m) => ({ default: m.CreateMaintenanceModal })));

/** Nạp trước chunk drawer + modal (trang gọi sau khi dữ liệu đã hiện). */
export const preloadAlertOverlays = () => preloadWhenIdle(loadDrawer, loadCreateMaintenance, () => import('./AlertAssignModal'));

type Actions = ReturnType<typeof useAlerts>;

/** Thao tác của drawer chi tiết → data layer (người thao tác = `actor`; theo dõi sau xử lý theo cấu hình loại). */
function drawerHandlers(alerts: Actions, actor: string, open: AlertRecord | null): Omit<AlertDrawerHandlers, 'onCreateMaintenance'> {
  // Thao tác của drawer luôn trên cảnh báo đang mở.
  const followOf = (id: string) => followUpConfig(open?.id === id ? open : {});
  return {
    onAcknowledge: async (id) => {
      await alerts.acknowledge([id], actor);
      announce('Đã xác nhận cảnh báo – chuyển sang Đang xử lý.');
    },
    onAssign: (id, form) => alerts.assignOne(id, form, actor),
    onResolve: (id, note) => alerts.resolve(id, note, actor),
    onToggleGuide: (id, step) => alerts.toggleGuide(id, step, actor),
    onAddNote: (id, text) => alerts.addNote(id, text, actor),
    onUpdate: (id, input, check) => alerts.update(id, input, check, actor),
    onCloseAlert: (id, input, conditions) => alerts.close(id, input, conditions, followOf(id), actor),
    onMonitor: (id, input) => alerts.monitor(id, input, followOf(id), actor),
    onRequestSupport: (id, input) => alerts.requestSupport(id, input, actor),
  };
}

export type AlertDrawerHostProps = {
  /** `?alert=` – cảnh báo đang mở (null = đóng). */
  openId: string | null;
  onClose: () => void;
  now: Date;
  actor: string;
  canAct: boolean;
  canCreateMaintenance: boolean;
};

/**
 * Drawer chi tiết cảnh báo đang mở (đọc theo id – GET /alerts/:id, không tra trong danh sách) + modal "Tạo yêu cầu bảo trì"
 * mở TRÊN drawer. Drawer mount từ lần mở đầu rồi giữ nguyên (đóng vẫn chạy hiệu ứng / trả focus như cũ).
 */
export function AlertDrawerHost({ openId, onClose, now, actor, canAct, canCreateMaintenance }: AlertDrawerHostProps) {
  const alerts = useAlerts();
  const { data } = useAlertById(openId);
  const openAlert = openId ? (data ?? null) : null;
  const linked = useLinkedMaintenance(openAlert?.id);
  const [mounted, setMounted] = useState(false);
  if (openAlert && !mounted) setMounted(true);

  // Modal "Tạo yêu cầu bảo trì" mở TRÊN drawer (drawer vẫn mở); đóng → focus về nút đã mở.
  const [createFor, setCreateFor] = useState<{ alert: AlertRecord; title?: string } | null>(null);
  const devices = useDeviceDirectory(createFor !== null);

  // Tạo yêu cầu bảo trì từ cảnh báo → ghi chú "đã tạo MT-…" vào cảnh báo; trùng (đã có yêu cầu) → chỉ thông báo.
  const createFromAlert = async (source: AlertRecord, input: NewMaintenanceInput) => {
    try {
      const rec = await createMaintenanceRequest({ ...input, createdBy: actor });
      await alerts.noteMaintenance(source.id, rec.code, actor);
      announce(`Đã tạo yêu cầu ${rec.code} từ ${source.code}.`);
    } catch (e) {
      if (!(e instanceof DuplicateFromAlertError)) throw e;
      announce(e.message);
    }
    setCreateFor(null);
  };

  return (
    <>
      {/* Mỗi phần lười một Suspense riêng: modal đang tải không làm ẩn tạm drawer đang mở. */}
      <Suspense fallback={null}>
        {mounted && (
          <AlertDetailDrawer
            alert={openAlert}
            onClose={onClose}
            now={now}
            maintenance={linked ? { id: linked.id, code: linked.code } : null}
            canAct={canAct}
            canCreateMaintenance={canCreateMaintenance}
            {...drawerHandlers(alerts, actor, openAlert)}
            onCreateMaintenance={(alert, opts) => setCreateFor({ alert, title: opts?.title })}
            actor={actor}
          />
        )}
      </Suspense>
      <Suspense fallback={null}>
        {createFor && (
          <CreateMaintenanceModal
            open
            onClose={() => setCreateFor(null)}
            devices={devices}
            defaultDevice={createFor.alert.device}
            alert={createFor.alert}
            defaultTitle={createFor.title}
            onDraftSaved={() => {
              setCreateFor(null);
              announce('Đã lưu nháp yêu cầu bảo trì.');
            }}
            onSubmit={(input) => createFromAlert(createFor.alert, input)}
          />
        )}
      </Suspense>
    </>
  );
}

/** Nạp trước drawer + modal khi trang đã có dữ liệu (một lần). */
export function usePreloadAlertOverlays(ready: boolean) {
  useEffect(() => (ready ? preloadAlertOverlays() : undefined), [ready]);
}
