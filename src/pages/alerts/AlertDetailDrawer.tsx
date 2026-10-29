import { Suspense, lazy, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangleIcon, Badge, Button, Checklist, Drawer, EventTimeline, Icon, Textarea, WorkflowStepper, buttonClass, type TimelineEvent } from '@/components';
import { assetPath } from '@/app/assetRoutes';
import { announce } from '@/lib/announce';
import { cn } from '@/lib/cn';
import { resolveAssetId } from '@/data/assetDetail';
import { alertDateTimeLabel, alertKind, alertPlaybook } from '@/data/alertDetail';
import { INSPECTION_STATUS_LABEL, inspectedCount, inspectionItems } from '@/features/alerts/inspection';
import { ALERT_HOLD_LABEL, FOLLOW_UP_DUE_LABEL, followUpDue, followUpLabel, isResolvedState, type AlertUpdateInput, type AlertUpdateResult, type UpdateCheck } from '@/features/alerts/update';
import type { CloseCondition, CloseInput, CloseResult, MonitorResult } from '@/features/alerts/close';
import { fillPlaybookText } from '@/mocks/alertKinds';
import { areaLabel } from '@/mocks/areas';
import { alertBadgeStatus, type AlertRecord } from '@/data/alerts';
import {
  alertSteps,
  canAcknowledge,
  canAddAlertNote,
  canAssignAlert,
  canResolve,
  guideLockHint,
  type ResolveResult,
} from '@/features/alerts/workflow';
import { AlertAssignModal } from './AlertAssignModal';
import { alertAssignChange, type AlertAssignForm } from '@/features/alerts/assign';
import { Collapsible, Section, fmtAt } from './drawerParts';
import { EmergencyProcedureModal } from './EmergencyProcedureModal';
import { FirePanel } from './panels/FirePanel';
import { GasPanel } from './panels/GasPanel';
import { ThresholdPanel } from './panels/ThresholdPanel';
import { SupportRequestModal } from './SupportRequestModal';

// Modal lớn (cập nhật xử lý theo loại, xác nhận đóng) → chunk lazy riêng (không vào bundle chính / chunk trang Cảnh báo).
const AlertUpdateModal = lazy(() => import('./AlertUpdateModal'));
const AlertCloseModal = lazy(() => import('./AlertCloseModal'));

export type AlertDrawerHandlers = {
  onAcknowledge: (id: string) => void;
  /** Phân công / đổi người / cập nhật phân công (modal "Phân công xử lý cảnh báo") – KHÔNG đổi trạng thái. */
  onAssign: (id: string, form: AlertAssignForm) => Promise<unknown> | void;
  onResolve: (id: string, note: string) => Promise<ResolveResult> | ResolveResult;
  onToggleGuide: (id: string, step: { id: string; text: string }) => void;
  onAddNote: (id: string, text: string) => void;
  /** Mở modal "Tạo yêu cầu bảo trì" (trang giữ modal, mở TRÊN drawer). `title` = tên điền sẵn (báo động giả → "Kiểm tra đầu báo …"). */
  onCreateMaintenance: (alert: AlertRecord, opts?: { title?: string }) => void;
  /** "Yêu cầu hỗ trợ" (nút phụ `support`): thêm người phối hợp + lịch sử. */
  onRequestSupport: (id: string, input: { people: readonly string[]; reason: string }) => void;
  /** "Cập nhật xử lý" (loại `update.kind = 'alert-update'` – áp suất / gas / cháy) – modal chung, lazy. */
  onUpdate: (id: string, input: AlertUpdateInput, check: UpdateCheck) => Promise<AlertUpdateResult> | AlertUpdateResult;
  /** "Xác nhận đóng cảnh báo" (Đã xử lý → Hoàn thành). */
  onCloseAlert: (id: string, input: CloseInput, conditions: readonly CloseCondition[]) => Promise<CloseResult> | CloseResult;
  /** "Tiếp tục theo dõi" (giữ Đã xử lý + theo dõi). */
  onMonitor: (id: string, input: { minutes: number; note: string }) => Promise<MonitorResult> | MonitorResult;
};

export type AlertDetailDrawerProps = AlertDrawerHandlers & {
  /** null = đóng. */
  alert: AlertRecord | null;
  onClose: () => void;
  now: Date;
  /** Toàn bộ cảnh báo – số việc đang xử lý của từng người trong hộp phân công. */
  allAlerts: readonly AlertRecord[];
  /** Yêu cầu bảo trì đã tạo từ cảnh báo (suy từ `sourceAlertId`) → "Xem MT-…" thay nút tạo. */
  maintenance?: { id: string; code: string } | null;
  /** Quyền `alert:acknowledge` – xác nhận, phân công, đánh dấu đã xử lý, tick hướng dẫn, ghi chú. */
  canAct: boolean;
  /** Quyền `maintenance:write`. */
  canCreateMaintenance: boolean;
  /** Người đang thao tác (tự điền "Người kiểm tra" ở modal cập nhật; người đóng ở modal xác nhận đóng). */
  actor?: string;
};

/**
 * Drawer chi tiết cảnh báo = KHUNG CHUNG + PANEL theo loại (`ALERT_KINDS[kind].panel`, mocks/alertKinds.ts):
 * - threshold (ảnh ALT-00128, `scratch/figma-ref/alert-drawer-*.png`): `panels/ThresholdPanel`.
 * - gas (ảnh ALT-00127, `scratch/figma-ref/alert-drawer-gas-*.png`): `panels/GasPanel`.
 * - fire (ảnh FIR-00018, `scratch/figma-ref/alert-drawer-fire-*.png`): `panels/FirePanel`.
 * Khung: header cố định (icon · mức độ viền · mã · tiêu đề · thiết bị/khu vực/thời gian/người phụ trách · trạng thái); thân:
 * panel · Hướng dẫn xử lý (theo loại, tick sau khi xác nhận) · Tiến trình + Nhật ký · Ghi chú (thu gọn theo `collapsed`);
 * chân theo trạng thái + kiểu cập nhật (`update`) + nút phụ (`actions`).
 */
/** Nháp ô "Ghi chú xử lý" – dùng chung giữa thân (ô nhập) và chân (nút "Đánh dấu đã xử lý" lấy luôn nội dung ô). */
type NoteDraft = { text: string; error?: string; set: (text: string) => void; fail: (error: string) => void; clear: () => void };

export function AlertDetailDrawer({ alert, onClose, ...rest }: AlertDetailDrawerProps) {
  const titleId = useId();
  // Nháp theo id cảnh báo: đổi cảnh báo (?alert= khác) → ô trống.
  const [noteState, setNoteState] = useState<{ id: string | null; text: string; error?: string }>({ id: null, text: '' });
  const ownId = alert?.id ?? null;
  const note: NoteDraft = {
    text: noteState.id === ownId ? noteState.text : '',
    error: noteState.id === ownId ? noteState.error : undefined,
    set: (text) => setNoteState({ id: ownId, text }),
    fail: (error) => setNoteState((s) => ({ id: ownId, text: s.id === ownId ? s.text : '', error })),
    clear: () => setNoteState({ id: ownId, text: '' }),
  };
  const linkRef = useRef<HTMLAnchorElement>(null);
  const maintenanceCode = rest.maintenance?.code;
  const prevCode = useRef(maintenanceCode);
  // Tạo yêu cầu xong: nút "Tạo yêu cầu bảo trì" (nơi modal trả focus) biến mất → focus link "Xem MT-…" vừa hiện.
  useEffect(() => {
    if (maintenanceCode && !prevCode.current) linkRef.current?.focus();
    prevCode.current = maintenanceCode;
  }, [maintenanceCode]);

  return (
    <Drawer
      open={alert !== null}
      onClose={onClose}
      labelledBy={titleId}
      accent
      contentKey={alert ? `${alert.id}|${alert.status}|${maintenanceCode ?? ''}` : null}
      header={alert && <DrawerHeader alert={alert} titleId={titleId} now={rest.now} />}
      footer={alert && <DrawerFooter alert={alert} linkRef={linkRef} note={note} {...rest} />}
    >
      {alert && <DrawerBody key={alert.id} alert={alert} note={note} {...rest} />}
    </Drawer>
  );
}

const SEVERITY_ICON_CLASS = { critical: '', high: '', medium: 'text-warning', low: 'text-info' } as const;

function DrawerHeader({ alert: a, titleId, now }: { alert: AlertRecord; titleId: string; now: Date }) {
  const assetId = resolveAssetId(a.device);
  const defaultOwner = alertKind(a).defaultOwner;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 pr-10">
        {a.severity === 'critical' || a.severity === 'high' ? (
          <Icon name="danger" box={24} />
        ) : (
          <AlertTriangleIcon size={24} className={SEVERITY_ICON_CLASS[a.severity]} aria-hidden="true" />
        )}
        <Badge variant="severity" value={a.severity} size="chip" />
        <span className="text-base text-fg-secondary">{a.code}</span>
      </div>
      <h2 id={titleId} className="text-xl font-semibold text-fg">
        {a.message}
      </h2>
      <div className="flex flex-col gap-1.5 text-md text-fg-secondary">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Thiết bị:{' '}
            {assetId ? (
              <Link to={assetPath(assetId)} className="rounded-sm text-info hover:underline">
                {a.device}
              </Link>
            ) : (
              <span className="text-info">{a.device}</span>
            )}
          </span>
          <span aria-hidden="true" className="text-line">
            |
          </span>
          <span>
            Khu vực: <span className="text-fg">{areaLabel(a.area)}</span>
          </span>
        </p>
        <p>
          Thời gian: <span className="text-fg">{alertDateTimeLabel(a, now)}</span>
        </p>
        <p>
          Người phụ trách:{' '}
          {a.assignee ? (
            <span className="text-fg">{a.assignee}</span>
          ) : defaultOwner ? (
            // Nhóm mặc định theo loại (không ghi vào `assignee`).
            <>
              <span className="text-fg">{defaultOwner}</span> <span className="text-sm text-fg-secondary">(chưa phân công cá nhân)</span>
            </>
          ) : (
            <span className="text-fg">-</span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="status" value={alertBadgeStatus(a.status)} size="md" />
        {a.status === 'in-progress' && a.hold && (
          <Badge variant="tag" tone="warning" size="md">
            {ALERT_HOLD_LABEL[a.hold.kind]}
          </Badge>
        )}
        {followUpDue(a, now) && (
          <Badge variant="tag" tone="warning" size="md">
            {FOLLOW_UP_DUE_LABEL}
          </Badge>
        )}
      </div>
    </div>
  );
}

function DrawerBody({ alert: a, note, canAct, onToggleGuide, onAddNote, now }: { alert: AlertRecord; note: NoteDraft } & Omit<AlertDetailDrawerProps, 'alert' | 'onClose'>) {
  const cfg = alertKind(a);
  const playbook = alertPlaybook(a);
  const steps = alertSteps(a);
  // Hạng mục kiểm tra = bước hướng dẫn (MỘT nguồn `guide`, đọc qua inspection.ts). Drawer gọn: tick = Đạt; "Có vấn đề" /
  // "Không áp dụng" hiện chip + khoá (đổi trong modal "Cập nhật xử lý").
  const items = inspectionItems(playbook.steps, a.guide);
  const guideDone = inspectedCount(items);
  const collapsed = new Set(cfg.collapsed ?? []);
  const progress = (
    <>
      <WorkflowStepper orientation="vertical" steps={steps.steps} completed={steps.completed} current={steps.current} label={`Tiến trình xử lý ${a.code}`} className="pl-2.5" />
      <AlertLog alert={a} />
    </>
  );
  return (
    <div className="flex flex-col gap-7 px-5 py-6">
      {cfg.panel === 'gas' ? <GasPanel alert={a} now={now} /> : cfg.panel === 'fire' ? <FirePanel alert={a} /> : <ThresholdPanel alert={a} />}
      <Section title="Hướng dẫn xử lý">
        <Checklist
          variant="plain"
          items={items.map((it) => {
            const flagged = it.status === 'issue' || it.status === 'na';
            return {
              id: it.id,
              text: it.text,
              done: it.status === 'pass',
              time: it.status === 'pass' && it.at ? fmtAt(it.at).slice(0, 5) : undefined,
              flag: flagged ? { label: INSPECTION_STATUS_LABEL[it.status], tone: it.status === 'issue' ? ('warning' as const) : ('muted' as const) } : undefined,
              lockedHint: flagged ? 'Đổi trạng thái trong "Cập nhật xử lý"' : undefined,
            };
          })}
          progress={{ done: guideDone, total: playbook.steps.length, percent: playbook.steps.length ? Math.round((guideDone / playbook.steps.length) * 100) : 0 }}
          onToggle={
            canAct
              ? (id) => {
                  const s = playbook.steps.find((x) => x.id === id);
                  if (s) onToggleGuide(a.id, s);
                }
              : undefined
          }
          lockHint={canAct ? guideLockHint(a) : null}
        />
      </Section>
      {collapsed.has('progress') ? <Collapsible title="Tiến trình">{progress}</Collapsible> : <Section title="Tiến trình">{progress}</Section>}
      <NotesSection alert={a} note={note} canAct={canAct} onAddNote={onAddNote} collapsed={collapsed.has('notes')} />
    </div>
  );
}

/** "Nhật ký (n)" thu gọn dưới Tiến trình: 2 mốc hệ thống + lịch sử thao tác (xác nhận, phân công, tick, ghi chú…). */
function AlertLog({ alert: a }: { alert: AlertRecord }) {
  const events: TimelineEvent[] = [
    { id: 'detect', title: 'Hệ thống phát hiện cảnh báo', time: a.time, tone: 'danger' },
    ...(a.notifiedTime ? [{ id: 'notify', title: 'Hệ thống gửi thông báo', time: a.notifiedTime, tone: 'neutral' as const }] : []),
    ...(a.history ?? []).map((h) => ({
      id: h.id,
      title: h.actor ? `${h.text} – ${h.actor}` : h.text,
      time: fmtAt(h.at),
      tone: h.kind === 'resolve' || h.kind === 'close' ? ('success' as const) : h.kind === 'acknowledge' || h.kind === 'assign' || h.kind === 'support' ? ('info' as const) : ('neutral' as const),
    })),
  ];
  return (
    <details className="group rounded-md border border-line/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-3 py-2 text-base text-fg-secondary hover:text-fg [&::-webkit-details-marker]:hidden">
        <span>Nhật ký ({events.length})</span>
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <EventTimeline variant="history" events={events} className="px-3 pb-3 pt-1" />
    </details>
  );
}

const NOTE_FIELD_ID = (alertId: string) => `alert-note-${alertId}`;

/**
 * "Ghi chú xử lý": ghi chú đã lưu (trên) + ô nhập + "Lưu ghi chú". Chưa có ghi chú → nhãn ô = tiêu đề mục (như ảnh);
 * có rồi → tiêu đề riêng + danh sách + ô "Thêm ghi chú". Đã hoàn thành / không có quyền → chỉ xem.
 */
function NotesSection({
  alert: a,
  note,
  canAct,
  onAddNote,
  collapsed,
}: {
  alert: AlertRecord;
  note: NoteDraft;
  canAct: boolean;
  onAddNote: AlertDrawerHandlers['onAddNote'];
  /** Thu gọn trong `<details>` "Ghi chú xử lý (n)" (loại gas – ảnh không có mục này). */
  collapsed?: boolean;
}) {
  const notes = a.notes ?? [];
  const editable = canAct && canAddAlertNote(a);
  const headingId = useId();
  if (collapsed) {
    return (
      <Collapsible title={`Ghi chú xử lý (${notes.length})`}>
        <NotesBody alert={a} note={note} notes={notes} editable={editable} onAddNote={onAddNote} labelAsHeading={false} />
      </Collapsible>
    );
  }
  const showHeading = notes.length > 0 || !editable;
  return (
    <section aria-labelledby={showHeading ? headingId : undefined} aria-label={showHeading ? undefined : 'Ghi chú xử lý'} className="flex flex-col gap-3">
      {showHeading && (
        <h3 id={headingId} className="text-lg font-semibold text-fg-secondary">
          Ghi chú xử lý
        </h3>
      )}
      <NotesBody alert={a} note={note} notes={notes} editable={editable} onAddNote={onAddNote} labelAsHeading />
    </section>
  );
}

function NotesBody({
  alert: a,
  note,
  notes,
  editable,
  onAddNote,
  labelAsHeading,
}: {
  alert: AlertRecord;
  note: NoteDraft;
  notes: NonNullable<AlertRecord['notes']>;
  editable: boolean;
  onAddNote: AlertDrawerHandlers['onAddNote'];
  /** true: chưa có ghi chú thì nhãn ô = tiêu đề mục (như ảnh áp suất). */
  labelAsHeading: boolean;
}) {
  return (
    <>
      {notes.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Ghi chú đã lưu">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md bg-surface-muted/60 px-3 py-2">
              <p className="text-sm text-fg-secondary">
                {n.author} · {fmtAt(n.at).slice(0, 5)}
              </p>
              <p className="whitespace-pre-wrap text-base text-fg">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <div id={NOTE_FIELD_ID(a.id)} className="flex flex-col gap-2">
          <Textarea
            label={notes.length > 0 || !labelAsHeading ? 'Thêm ghi chú' : 'Ghi chú xử lý'}
            labelVariant={notes.length > 0 || !labelAsHeading ? 'field' : 'section'}
            value={note.text}
            onChange={note.set}
            rows={4}
            maxLength={1000}
            placeholder="Nhập tình trạng kiểm tra..."
            error={note.error}
            hint={a.status === 'in-progress' && alertKind(a).update.kind === 'resolve-note' ? 'Bắt buộc khi đánh dấu đã xử lý – nội dung trong ô được lưu kèm.' : undefined}
          />
          <Button
            variant="subtle"
            size="sm"
            className="self-end"
            disabled={!note.text.trim()}
            onClick={() => {
              onAddNote(a.id, note.text);
              note.clear();
              announce('Đã lưu ghi chú.');
            }}
          >
            Lưu ghi chú
          </Button>
        </div>
      ) : (
        notes.length === 0 && <p className="text-base text-fg-secondary">Chưa có ghi chú.</p>
      )}
    </>
  );
}

/**
 * Chân drawer: nút chính theo trạng thái + `update` của loại (resolve-note / alert-update); Đã xử lý → "Xác nhận đóng cảnh
 * báo"; nút phụ theo `actions` (assign / support / maintenance) – các modal mở TRÊN drawer.
 */
function DrawerFooter({
  alert: a,
  linkRef,
  maintenance,
  canAct,
  canCreateMaintenance,
  allAlerts,
  onAcknowledge,
  onAssign,
  onResolve,
  onCreateMaintenance,
  onRequestSupport,
  onUpdate,
  onCloseAlert,
  onMonitor,
  actor = 'Admin',
  now,
  note,
}: { alert: AlertRecord; linkRef: RefObject<HTMLAnchorElement>; note: NoteDraft } & Omit<AlertDetailDrawerProps, 'alert' | 'onClose'>) {
  const cfg = alertKind(a);
  const [modal, setModal] = useState<'assign' | 'support' | 'update' | 'close' | 'procedure' | null>(null);
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    setBusy(true);
    try {
      const res = await onResolve(a.id, note.text);
      if (res.ok) {
        note.clear();
        announce(`Đã đánh dấu ${a.code} đã xử lý.`);
      } else if (res.reason === 'note') {
        note.fail('Nhập ghi chú kết quả xử lý trước khi đánh dấu đã xử lý.');
        document.getElementById(NOTE_FIELD_ID(a.id))?.querySelector('textarea')?.focus();
      }
    } finally {
      setBusy(false);
    }
  };

  const secondary = cfg.actions
    .map((act) => {
      if (act === 'assign')
        return (
          canAct &&
          canAssignAlert(a) && (
            <Button key="assign" variant="subtle" className="w-full" onClick={() => setModal('assign')}>
              {a.assignee ? 'Đổi người xử lý' : 'Phân công xử lý'}
            </Button>
          )
        );
      if (act === 'procedure')
        return (
          cfg.emergency && (
            <Button key="procedure" variant="subtle" className="w-full" onClick={() => setModal('procedure')}>
              Xem quy trình khẩn cấp
            </Button>
          )
        );
      if (act === 'support')
        return (
          canAct &&
          a.status !== 'done' && (
            <Button key="support" variant="subtle" className="w-full" onClick={() => setModal('support')}>
              Yêu cầu hỗ trợ
            </Button>
          )
        );
      return maintenance ? (
        <Link key="mt" ref={linkRef} to={`/maintenance/${maintenance.id}`} className={cn(buttonClass('subtle'), 'w-full')}>
          Xem {maintenance.code}
        </Link>
      ) : (
        canCreateMaintenance &&
          a.status !== 'done' && (
            <Button key="create" variant="subtle" className="w-full" onClick={() => onCreateMaintenance(a)}>
              Tạo yêu cầu bảo trì
            </Button>
          )
      );
    })
    .filter(Boolean);

  // Báo cháy đóng là "Báo động giả" → kiểm tra đầu báo: "Tạo yêu cầu bảo trì" điền sẵn tên (không tạo trùng → "Xem MT-…").
  const falseAlarmTitle = cfg.falseAlarmMaintenance && a.resolution?.kind === 'false-alarm' ? fillPlaybookText(cfg.falseAlarmMaintenance.title, a.device) : null;
  if (falseAlarmTitle && !cfg.actions.includes('maintenance')) {
    secondary.unshift(
      maintenance ? (
        <Link key="mt" ref={linkRef} to={`/maintenance/${maintenance.id}`} className={cn(buttonClass('subtle'), 'w-full')}>
          Xem {maintenance.code}
        </Link>
      ) : (
        canCreateMaintenance && (
          <Button key="create" variant="subtle" className="w-full" onClick={() => onCreateMaintenance(a, { title: falseAlarmTitle })}>
            Tạo yêu cầu bảo trì
          </Button>
        )
      ),
    );
  }

  const follow = followUpLabel(a, now);
  const due = followUpDue(a, now);
  const primary =
    canAct && canAcknowledge(a) ? (
      <Button variant="danger" size="lg" className="w-full" onClick={() => onAcknowledge(a.id)}>
        Xác nhận cảnh báo
      </Button>
    ) : canAct && canResolve(a) ? (
      cfg.update.kind === 'alert-update' ? (
        // Nền `info` (#87CFFF) – token có sẵn trùng màu nút trong ảnh gas.
        <Button variant="info" size="lg" className="w-full" onClick={() => setModal('update')}>
          Cập nhật xử lý
        </Button>
      ) : (
        <Button variant="primary" size="lg" className="w-full" disabled={busy} onClick={resolve}>
          Đánh dấu đã xử lý
        </Button>
      )
    ) : a.status === 'resolved' ? (
      <div className="flex flex-col gap-2">
        <p className="text-center text-base text-success">
          {a.resolution?.kind === 'false-alarm' ? 'Đã xử lý – báo động giả' : 'Đã xử lý'}
          {a.resolvedAt ? ` lúc ${fmtAt(a.resolvedAt).slice(0, 5)}` : ''}, chờ xác nhận đóng.
          {follow && <span className="block text-sm text-info">{follow}.</span>}
          {due && <span className="block text-sm text-warning">{FOLLOW_UP_DUE_LABEL}.</span>}
        </p>
        {canAct && (
          <Button variant="primary" size="lg" className="w-full" onClick={() => setModal('close')}>
            Xác nhận đóng cảnh báo
          </Button>
        )}
      </div>
    ) : a.status === 'done' ? (
      <p className="text-center text-base text-fg">
        {a.resolution?.kind === 'false-alarm' ? 'Đã đóng – báo động giả' : 'Cảnh báo đã hoàn thành'}
        {a.closedAt ? ` lúc ${fmtAt(a.closedAt).slice(0, 5)}` : a.resolvedAt ? ` lúc ${fmtAt(a.resolvedAt).slice(0, 5)}` : ''}
        {a.closedBy ? ` – ${a.closedBy}` : ''}.
        {follow && <span className="block text-sm text-info">{follow}.</span>}
      </p>
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      {primary}
      {secondary.length > 0 && <div className={cn('grid gap-3', secondary.length > 1 && 'grid-cols-2')}>{secondary}</div>}
      {modal === 'assign' && (
        <AlertAssignModal
          alerts={[a]}
          allAlerts={allAlerts}
          onClose={() => setModal(null)}
          onConfirm={async (form) => {
            const change = alertAssignChange(a, form);
            await onAssign(a.id, form);
            setModal(null);
            announce(
              change === 'reassign'
                ? `Đã đổi người xử lý ${a.code} sang ${form.assignee}.`
                : change === 'update'
                  ? `Đã cập nhật phân công ${a.code}.`
                  : `Đã phân công ${a.code} cho ${form.assignee}.`,
            );
          }}
        />
      )}
      {modal === 'support' && (
        <SupportRequestModal
          alert={a}
          onClose={() => setModal(null)}
          onConfirm={(people, reason) => {
            onRequestSupport(a.id, { people, reason });
            setModal(null);
            announce(`Đã thêm ${people.join(', ')} làm người phối hợp. Thông báo chưa gửi – chờ backend.`);
          }}
        />
      )}
      {modal === 'procedure' && cfg.emergency && <EmergencyProcedureModal procedure={cfg.emergency} onClose={() => setModal(null)} />}
      {modal === 'update' && cfg.update.kind === 'alert-update' && (
        <Suspense fallback={null}>
          <AlertUpdateModal
            alert={a}
            actor={actor}
            onClose={() => setModal(null)}
            onSubmit={async (input, check) => {
              const res = await onUpdate(a.id, input, check);
              if (res.ok) {
                setModal(null);
                announce(isResolvedState(input.state) ? `Đã đánh dấu ${a.code} đã xử lý – chờ xác nhận đóng.` : 'Đã lưu cập nhật xử lý.');
              }
              return res;
            }}
          />
        </Suspense>
      )}
      {modal === 'close' && (
        <Suspense fallback={null}>
          <AlertCloseModal
            alert={a}
            allAlerts={allAlerts}
            actor={actor}
            onClose={() => setModal(null)}
            onConfirmClose={async (input, conditions) => {
              const res = await onCloseAlert(a.id, input, conditions);
              if (res.ok) {
                setModal(null);
                announce(`Đã đóng cảnh báo ${a.code} – Hoàn thành.`);
              }
              return res;
            }}
            onMonitor={async (input) => {
              const res = await onMonitor(a.id, input);
              if (res.ok) {
                setModal(null);
                announce(`Tiếp tục theo dõi ${a.code}.`);
              }
              return res;
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
