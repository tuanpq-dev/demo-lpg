/** Chân drawer chi tiết cảnh báo: nút chính theo trạng thái, nút phụ theo loại cảnh báo, các modal mở trên drawer. */
import { Suspense, lazy, useState, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Button, buttonClass } from '@/components';
import { actionErrorText, runAction } from '@/lib/actionError';
import { announce } from '@/lib/announce';
import { cn } from '@/lib/cn';
import { alertKind, fillPlaybookText } from '@/data/alertDetail';
import { FOLLOW_UP_DUE_LABEL, followUpDue, followUpLabel, isResolvedState } from '@/features/alerts/update';
import type { AlertRecord } from '@/data/alerts';
import { canAcknowledge, canAssignAlert, canResolve } from '@/features/alerts/workflow';
import { AlertAssignModal } from './AlertAssignModal';
import { alertAssignChange } from '@/features/alerts/assign';
import { fmtAt } from './drawerParts';
import { EmergencyProcedureModal } from './EmergencyProcedureModal';
import { SupportRequestModal } from './SupportRequestModal';
import type { AlertDetailDrawerProps } from './AlertDetailDrawer';
import { NOTE_FIELD_ID, type NoteDraft } from './alertNote';

// Modal lớn (cập nhật xử lý theo loại, xác nhận đóng) → chunk lazy riêng (không vào bundle chính / chunk trang Cảnh báo).
const AlertUpdateModal = lazy(() => import('./AlertUpdateModal'));
const AlertCloseModal = lazy(() => import('./AlertCloseModal'));

type FooterModal = 'assign' | 'support' | 'update' | 'close' | 'procedure';
type FooterProps = { alert: AlertRecord; linkRef: RefObject<HTMLAnchorElement>; note: NoteDraft } & Omit<AlertDetailDrawerProps, 'alert' | 'onClose'>;
type KindConfig = ReturnType<typeof alertKind>;

/** "Xem MT-…" nếu đã có yêu cầu bảo trì, không thì "Tạo yêu cầu bảo trì" (khi có quyền và cảnh báo chưa xong). */
function maintenanceAction(p: FooterProps, prefill?: { title: string }): ReactNode {
  const { alert: a, maintenance, linkRef, canCreateMaintenance, onCreateMaintenance } = p;
  if (maintenance) {
    return (
      <Link key="mt" ref={linkRef} to={`/maintenance/${maintenance.id}`} className={cn(buttonClass('subtle'), 'w-full')}>
        Xem {maintenance.code}
      </Link>
    );
  }
  if (!canCreateMaintenance || (!prefill && a.status === 'done')) return null;
  return (
    <Button key="create" variant="subtle" className="w-full" onClick={() => (prefill ? onCreateMaintenance(a, prefill) : onCreateMaintenance(a))}>
      Tạo yêu cầu bảo trì
    </Button>
  );
}

/** Nút phụ theo `actions` của loại cảnh báo (assign / procedure / support / maintenance). */
function secondaryActions(p: FooterProps, cfg: KindConfig, open: (m: FooterModal) => void): ReactNode[] {
  const { alert: a, canAct } = p;
  const items = cfg.actions.map((act) => {
    if (act === 'assign') {
      if (!canAct || !canAssignAlert(a)) return null;
      return (
        <Button key="assign" variant="subtle" className="w-full" onClick={() => open('assign')}>
          {a.assignee ? 'Đổi người xử lý' : 'Phân công xử lý'}
        </Button>
      );
    }
    if (act === 'procedure') {
      if (!cfg.emergency) return null;
      return (
        <Button key="procedure" variant="subtle" className="w-full" onClick={() => open('procedure')}>
          Xem quy trình khẩn cấp
        </Button>
      );
    }
    if (act === 'support') {
      if (!canAct || a.status === 'done') return null;
      return (
        <Button key="support" variant="subtle" className="w-full" onClick={() => open('support')}>
          Yêu cầu hỗ trợ
        </Button>
      );
    }
    return maintenanceAction(p);
  });
  // Báo cháy đóng là "Báo động giả" → kiểm tra đầu báo: "Tạo yêu cầu bảo trì" điền sẵn tên (không tạo trùng → "Xem MT-…").
  const falseAlarm = cfg.falseAlarmMaintenance && a.resolution?.kind === 'false-alarm';
  if (falseAlarm && cfg.falseAlarmMaintenance && !cfg.actions.includes('maintenance')) {
    items.unshift(maintenanceAction(p, { title: fillPlaybookText(cfg.falseAlarmMaintenance.title, a.device) }));
  }
  return items.filter(Boolean);
}

const atTime = (iso?: string) => (iso ? ` lúc ${fmtAt(iso).slice(0, 5)}` : '');

/** Nút chính / dòng trạng thái theo trạng thái cảnh báo. */
function FooterStatus({
  p,
  cfg,
  busy,
  onResolve,
  open,
}: {
  p: FooterProps;
  cfg: KindConfig;
  busy: boolean;
  onResolve: () => void;
  open: (m: FooterModal) => void;
}) {
  const { alert: a, canAct, now } = p;
  const falseAlarm = a.resolution?.kind === 'false-alarm';
  const follow = followUpLabel(a, now);
  if (canAct && canAcknowledge(a)) {
    return (
      <Button variant="danger" size="lg" className="w-full" onClick={() => void runAction(() => p.onAcknowledge(a.id))}>
        Xác nhận cảnh báo
      </Button>
    );
  }
  if (canAct && canResolve(a)) {
    return cfg.update.kind === 'alert-update' ? (
      // Nền `info` (#87CFFF) – token có sẵn trùng màu nút trong ảnh gas.
      <Button variant="info" size="lg" className="w-full" onClick={() => open('update')}>
        Cập nhật xử lý
      </Button>
    ) : (
      <Button variant="primary" size="lg" className="w-full" disabled={busy} onClick={onResolve}>
        Đánh dấu đã xử lý
      </Button>
    );
  }
  if (a.status === 'resolved') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-center text-base text-success">
          {falseAlarm ? 'Đã xử lý – báo động giả' : 'Đã xử lý'}
          {atTime(a.resolvedAt)}, chờ xác nhận đóng.
          {follow && <span className="block text-sm text-info">{follow}.</span>}
          {followUpDue(a, now) && <span className="block text-sm text-warning">{FOLLOW_UP_DUE_LABEL}.</span>}
        </p>
        {canAct && (
          <Button variant="primary" size="lg" className="w-full" onClick={() => open('close')}>
            Xác nhận đóng cảnh báo
          </Button>
        )}
      </div>
    );
  }
  if (a.status === 'done') {
    return (
      <p className="text-center text-base text-fg">
        {falseAlarm ? 'Đã đóng – báo động giả' : 'Cảnh báo đã hoàn thành'}
        {atTime(a.closedAt ?? a.resolvedAt)}
        {a.closedBy ? ` – ${a.closedBy}` : ''}.{follow && <span className="block text-sm text-info">{follow}.</span>}
      </p>
    );
  }
  return null;
}

/** Các modal mở trên drawer (phân công, hỗ trợ, quy trình khẩn cấp, cập nhật xử lý, xác nhận đóng). */
function FooterModals({ p, cfg, modal, close }: { p: FooterProps; cfg: KindConfig; modal: FooterModal | null; close: () => void }) {
  const { alert: a, allAlerts, actor = 'Admin' } = p;
  if (modal === 'assign') {
    return (
      <AlertAssignModal
        alerts={[a]}
        allAlerts={allAlerts}
        onClose={close}
        onConfirm={async (form) => {
          const change = alertAssignChange(a, form);
          await p.onAssign(a.id, form);
          close();
          announce(
            change === 'reassign'
              ? `Đã đổi người xử lý ${a.code} sang ${form.assignee}.`
              : change === 'update'
                ? `Đã cập nhật phân công ${a.code}.`
                : `Đã phân công ${a.code} cho ${form.assignee}.`,
          );
        }}
      />
    );
  }
  if (modal === 'support') {
    return (
      <SupportRequestModal
        alert={a}
        onClose={close}
        onConfirm={async (people, reason) => {
          await p.onRequestSupport(a.id, { people, reason });
          close();
          announce(`Đã thêm ${people.join(', ')} làm người phối hợp. Thông báo chưa gửi – chờ backend.`);
        }}
      />
    );
  }
  if (modal === 'procedure' && cfg.emergency) return <EmergencyProcedureModal procedure={cfg.emergency} onClose={close} />;
  if (modal === 'update' && cfg.update.kind === 'alert-update') {
    return (
      <Suspense fallback={null}>
        <AlertUpdateModal
          alert={a}
          actor={actor}
          onClose={close}
          onSubmit={async (input, check) => {
            const res = await p.onUpdate(a.id, input, check);
            if (res.ok) {
              close();
              announce(isResolvedState(input.state) ? `Đã đánh dấu ${a.code} đã xử lý – chờ xác nhận đóng.` : 'Đã lưu cập nhật xử lý.');
            }
            return res;
          }}
        />
      </Suspense>
    );
  }
  if (modal === 'close') {
    return (
      <Suspense fallback={null}>
        <AlertCloseModal
          alert={a}
          allAlerts={allAlerts}
          actor={actor}
          onClose={close}
          onConfirmClose={async (input, conditions) => {
            const res = await p.onCloseAlert(a.id, input, conditions);
            if (res.ok) {
              close();
              announce(`Đã đóng cảnh báo ${a.code} – Hoàn thành.`);
            }
            return res;
          }}
          onMonitor={async (input) => {
            const res = await p.onMonitor(a.id, input);
            if (res.ok) {
              close();
              announce(`Tiếp tục theo dõi ${a.code}.`);
            }
            return res;
          }}
        />
      </Suspense>
    );
  }
  return null;
}

/**
 * Chân drawer: nút chính theo trạng thái + `update` của loại (resolve-note / alert-update); Đã xử lý → "Xác nhận đóng cảnh
 * báo"; nút phụ theo `actions` (assign / support / maintenance) – các modal mở TRÊN drawer.
 */
export function DrawerFooter(props: FooterProps) {
  const { alert: a, note } = props;
  const cfg = alertKind(a);
  const [modal, setModal] = useState<FooterModal | null>(null);
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    setBusy(true);
    try {
      const res = await props.onResolve(a.id, note.text);
      if (res.ok) {
        note.clear();
        announce(`Đã đánh dấu ${a.code} đã xử lý.`);
      } else if (res.reason === 'note') {
        note.fail('Nhập ghi chú kết quả xử lý trước khi đánh dấu đã xử lý.');
        document.getElementById(NOTE_FIELD_ID(a.id))?.querySelector('textarea')?.focus();
      }
    } catch (e) {
      const text = actionErrorText(e);
      note.fail(text);
      announce(text);
    } finally {
      setBusy(false);
    }
  };

  const secondary = secondaryActions(props, cfg, setModal);
  return (
    <div className="flex flex-col gap-3">
      <FooterStatus p={props} cfg={cfg} busy={busy} onResolve={() => void resolve()} open={setModal} />
      {secondary.length > 0 && <div className={cn('grid gap-3', secondary.length > 1 && 'grid-cols-2')}>{secondary}</div>}
      <FooterModals p={props} cfg={cfg} modal={modal} close={() => setModal(null)} />
    </div>
  );
}
