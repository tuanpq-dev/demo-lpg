import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { assetPath } from '@/app/assetRoutes';
import { useAuth, useCan } from '@/app/auth';
import { AUTH_MODE } from '@/api/auth';
import { Page } from '@/app/Page';
import { PageError, Placeholder } from '@/app/Placeholder';
import {
  AlertCard,
  AlertTriangleIcon,
  AssigneeCard,
  AttachmentCard,
  Badge,
  Button,
  Card,
  Checklist,
  checklistSummary,
  ClipboardCheckIcon,
  ClipboardClockIcon,
  DeadlineCountdownCard,
  DeviceArmIcon,
  EventTimeline,
  ExternalLinkIcon,
  FileIcon,
  FolderIcon,
  HistoryIcon,
  InfoGrid,
  InfoIcon,
  KpiCard,
  ListChecksIcon,
  NotesIcon,
  NotesThread,
  PageHeader,
  SendIcon,
  StatusDot,
  StickyActionBar,
  WorkflowStepper,
  type InfoGridItem,
  type KpiTone,
} from '@/components';
import { resolveAssetId, type Reading } from '@/data/assetDetail';
import { useAlerts } from '@/data/alerts';
import {
  FORM_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  SHIFTS,
  SOURCE_OPTIONS,
  STATUS_BADGE,
  STATUS_LABEL,
  dueHasTime,
  formatDate,
  isOverdue,
  useMaintenance,
  type MaintenanceAttachment,
  type MaintenanceRecord,
} from '@/data/maintenance';
import {
  clearProgressDraft,
  clearSubmitDraft,
  formatFileSize,
  formatPlantDateTime,
  historyEvents,
  maintenanceListUrl,
  relativeDayTime,
  resolveMaintenanceId,
  useRelatedDevice,
} from '@/data/maintenanceDetail';
import { CHECKLIST_LOCK_HINT, checklistLock, checklistProgress } from '@/features/maintenance/checklist';
import { deadlineCountdown, deadlineDayLabel } from '@/features/maintenance/deadline';
import { HOLD_LABEL, canUpdateProgress, reportedProgressOf, type ProgressFile } from '@/features/maintenance/progress';
import { REVIEW_FAILED_LABEL, resolveReviewer } from '@/features/maintenance/review';
import { assignMode } from '@/features/maintenance/assign';
import { NEXT_ACTION_LABEL, WORKFLOW_STEPS, canCancel, workflowPosition } from '@/features/maintenance/workflow';
import { runAction } from '@/lib/actionError';
import { announce } from '@/lib/announce';
import { daysFromToday } from '@/lib/plantTime';
import { useNow } from '@/lib/useNow';
import NotFoundPage from '../NotFoundPage';
import { downloadSampleAttachment } from './attachments';
import { AssignModal } from './AssignModal';
import { CancelMaintenanceModal, ViewAttachmentModal } from './MaintenanceDetailDialogs';
import { MaintenanceResult } from './MaintenanceResult';
import { ProgressUpdateModal } from './ProgressUpdateModal';
import { ReviewModal } from './ReviewModal';
import { SubmitReviewModal } from './SubmitReviewModal';

const STEPS = WORKFLOW_STEPS.map((s) => ({ id: s.status, label: s.label }));
/** Bước "Đang thực hiện" kèm nhãn phụ khi tạm dừng / gặp sự cố (vẫn bước 3). */
function stepsFor(r: MaintenanceRecord) {
  const hold = r.hold;
  // Nhãn phụ dưới "Đang thực hiện": tạm dừng / gặp sự cố; không thì "Không đạt nghiệm thu" (bị trả về).
  if (!hold && !r.reviewFailed) return STEPS;
  const note = hold ? HOLD_LABEL[hold.kind] : REVIEW_FAILED_LABEL;
  const noteTone = !hold || hold.kind === 'blocked' ? ('danger' as const) : ('warning' as const);
  return STEPS.map((s) => (s.id === 'in-progress' ? { ...s, note, noteTone } : s));
}
const PRIORITY_LABEL = Object.fromEntries(PRIORITY_OPTIONS.map((o) => [o.value, o.label]));
const FORM_TYPE_LABEL = Object.fromEntries(FORM_TYPE_OPTIONS.map((o) => [o.value, o.label]));
/** "Ca 1 (06:00 - 14:00)" → "Ca 1" (ảnh chỉ ghi tên ca). */
const shiftShort = (id?: string) => SHIFTS.find((s) => s.value === id)?.label.split(' (')[0];

/**
 * Route `/maintenance/:id`: chờ danh sách tải xong rồi chuẩn hoá mã.
 * - khác kiểu chữ (`/maintenance/mt-00128`) → mã chuẩn (giữ query + state);
 * - không có → "Không tìm thấy yêu cầu" (URL giữ nguyên, không để trang trắng).
 */
export default function MaintenanceDetailRoute() {
  const { id: raw = '' } = useParams();
  const { search, state } = useLocation();
  const navigate = useNavigate();
  const { status, data, error, refetch } = useMaintenance();
  const listUrl = maintenanceListUrl((state as { from?: unknown } | null)?.from);

  if (status !== 'success') {
    const header = <PageHeader breadcrumb={[{ label: 'Bảo trì', to: '/maintenance' }, { label: 'Quản lý bảo trì', to: listUrl }, { label: raw }]} title={raw} />;
    return (
      <Page pageHeader={header}>
        {status === 'error' ? (
          <PageError title="Không tải được yêu cầu bảo trì" error={error} onRetry={refetch} />
        ) : (
          <>
            <Placeholder label="Đang tải…" height={94} />
            <Placeholder label="Đang tải…" height={600} />
          </>
        )}
      </Page>
    );
  }

  const id = resolveMaintenanceId(raw, data);
  if (!id) {
    return (
      <NotFoundPage
        title="Không tìm thấy yêu cầu"
        breadcrumb={[{ label: 'Bảo trì', to: '/maintenance' }, { label: 'Quản lý bảo trì', to: listUrl }, { label: raw || '—' }]}
        message={
          <>
            Không có yêu cầu bảo trì <code className="font-mono text-fg">{raw}</code>. Có thể mã đã sai hoặc yêu cầu đã bị xoá.
          </>
        }
        actions={<Button onClick={() => navigate(listUrl)}>Về danh sách bảo trì</Button>}
      />
    );
  }
  if (id !== raw) return <Navigate to={`/maintenance/${id}${search}`} replace state={state} />;
  return <MaintenanceDetail record={data.find((r) => r.id === id)!} listUrl={listUrl} />;
}

/** Ô "Hạn chót xử lý" – đồng hồ chạy mỗi giây riêng ở đây (không vẽ lại cả trang). */
function LiveDeadline({ record }: { record: MaintenanceRecord }) {
  const now = useNow(1000);
  const open = record.status !== 'done' && record.status !== 'cancelled';
  const hasTime = dueHasTime(record);
  return (
    <DeadlineCountdownCard
      countdown={open ? deadlineCountdown(record.dueAt, now, hasTime) : null}
      dueText={deadlineDayLabel(record.dueAt, now, hasTime)}
      closedText={record.status === 'done' ? 'Đã hoàn thành' : 'Đã hủy'}
    />
  );
}

const readingTone = (r: Reading): KpiTone => (r.status === 'danger' ? 'danger' : r.status === 'warning' ? 'warning' : 'neutral');
const DOT = { danger: 'danger', warning: 'warning', offline: 'offline', normal: 'success' } as const;
const DOT_LABEL = { danger: 'Nguy hiểm', warning: 'Cảnh báo', offline: 'Mất tín hiệu', normal: 'Bình thường' } as const;

/** "Thiết bị liên quan" – số liệu trực tiếp (PT/TT/mức % thể tích) qua useLiveData; "Mất tín hiệu" khi stale. */
function RelatedDeviceCard({ device }: { device: string }) {
  const view = useRelatedDevice(device);
  const assetId = resolveAssetId(device);
  return (
    <Card title="Thiết bị liên quan" icon={<DeviceArmIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg">
      {view.kind === 'loading' ? (
        <Placeholder label="Đang tải số liệu…" height={120} />
      ) : view.kind === 'none' ? (
        <p className="text-base text-fg-secondary">{device} – chưa có số liệu trực tiếp cho thiết bị này.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="flex items-center justify-between gap-2 text-base text-fg">
            <span>
              {view.id} ({view.name})
            </span>
            <StatusDot status={DOT[view.status]} label={`Trạng thái: ${DOT_LABEL[view.status]}`} />
          </p>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard size="sm" label="Áp suất" value={view.pressure.value?.toFixed(1) ?? '—'} unit="bar" tone={readingTone(view.pressure)} signalLost={view.pressure.state === 'lost'} />
            <KpiCard size="sm" label="Nhiệt độ" value={view.temperature.value?.toFixed(1) ?? '—'} unit="°C" tone={readingTone(view.temperature)} signalLost={view.temperature.state === 'lost'} />
            <KpiCard
              size="sm"
              className="col-span-2"
              label="Mức lỏng"
              hint="% thể tích toàn bộ chất lỏng (cùng cách tính KPI Mức bồn)"
              value={view.levelPct?.toFixed(1) ?? '—'}
              unit="%"
              tone={readingTone(view.level)}
              signalLost={view.level.state === 'lost'}
            />
          </div>
        </div>
      )}
      {assetId && (
        <Link to={assetPath(assetId)} className="mt-3 self-start rounded-sm text-xs text-accent hover:underline">
          Xem chi tiết thiết bị →
        </Link>
      )}
    </Card>
  );
}

/**
 * Chi tiết yêu cầu bảo trì – ảnh MT-00128 (public/figma-ref/mt-detail-design.png, chưa có node Figma).
 * Header + stepper full-width · lưới 2 cột 7fr/3fr (≥ wide: cột phải `--mt-aside-width`), dưới xl xếp chồng ·
 * thanh hành động dính đáy. Mọi số liệu suy từ bản ghi (`useMaintenance`), cảnh báo (`useAlerts`), live (`useLiveData`).
 */
function MaintenanceDetail({ record: r, listUrl }: { record: MaintenanceRecord; listUrl: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const now = useNow(60_000);
  const { user } = useAuth();
  // TODO(backend): quyền chi tiết theo vai trò – chỉ người được phân công tick checklist / cập nhật tiến độ (cần ánh xạ
  // user ↔ người phụ trách). Nghiệm thu: `maintenance:review` (kỹ sư / quản trị).
  const canWrite = useCan('maintenance:write');
  const canReview = useCan('maintenance:review');
  const actor = user?.name || 'Admin';
  const { data: allRecords, advance, cancel, assign, toggleChecklist, addNote, updateProgress, submitForReview, review } = useMaintenance();
  const alerts = useAlerts();
  const alert = r.sourceAlertId ? alerts.data?.find((a) => a.id === r.sourceAlertId) : undefined;

  // `?submit=1` / `?review=1` (link ngoài, test) → mở sẵn modal Gửi nghiệm thu / Nghiệm thu khi trạng thái cho phép.
  const [dialog, setDialog] = useState<'assign' | 'cancel' | 'progress' | 'submit' | 'review' | null>(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('submit') === '1' && r.status === 'in-progress') return 'submit';
    if (q.get('review') === '1' && r.status === 'review') return 'review';
    if (q.get('assign') === '1' && assignMode(r.status) && canWrite) return 'assign';
    return null;
  });
  /** Nội dung + tệp chuyển từ modal Cập nhật tiến độ ("Tiếp tục gửi nghiệm thu"). */
  const [submitPrefill, setSubmitPrefill] = useState<{ text: string; files: readonly ProgressFile[] } | undefined>();
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (!q.has('submit') && !q.has('review') && !q.has('assign')) return;
    q.delete('submit');
    q.delete('review');
    q.delete('assign');
    const s = q.toString();
    navigate({ search: s ? `?${s}` : '', hash: location.hash }, { replace: true, state: location.state });
    // chỉ lần đầu vào trang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const reviewer = resolveReviewer({ authOff: AUTH_MODE === 'off', userName: user?.name, submission: r.submission });
  const checklistRef = useRef<HTMLDivElement>(null);

  // `#checklist` (nút "Mở checklist" của modal cập nhật tiến độ, từ danh sách hoặc trang này) → cuộn + focus khối Checklist.
  useEffect(() => {
    if (location.hash !== '#checklist') return;
    const el = checklistRef.current;
    el?.scrollIntoView?.({ block: 'start' });
    el?.focus({ preventScroll: true });
  }, [location.hash, location.key]);
  const [viewing, setViewing] = useState<MaintenanceAttachment | null>(null);

  const pos = workflowPosition(r);
  const progress = checklistProgress(r.checklist);
  const lock = canWrite ? checklistLock(r.status) : 'readonly';
  const overdue = isOverdue(r, now);
  const created = r.history?.find((h) => h.kind === 'create')?.at;
  const nextLabel = NEXT_ACTION_LABEL[r.status];
  const reported = reportedProgressOf(r);
  const closed = r.status === 'done' || r.status === 'cancelled';
  const assetId = resolveAssetId(r.device);

  const info: InfoGridItem[] = [
    { id: 'code', label: 'Mã yêu cầu', value: r.code },
    { id: 'created', label: 'Ngày/giờ tạo', value: created ? formatPlantDateTime(created) : formatDate(r.createdAt) },
    { id: 'by', label: 'Người tạo', value: r.createdBy ?? '—' },
    {
      id: 'source',
      label: 'Nguồn tạo',
      value: r.sourceAlertId ? `Cảnh báo ${r.sourceAlertId}` : (SOURCE_OPTIONS.find((o) => o.value === r.source)?.label ?? '—'),
    },
    { id: 'type', label: 'Loại công việc', value: `${FORM_TYPE_LABEL[r.type]}${r.priority === 'critical' ? ' (Khẩn cấp)' : ''}` },
    { id: 'priority', label: 'Mức ưu tiên', value: PRIORITY_LABEL[r.priority], tone: r.priority === 'critical' ? 'danger' : r.priority === 'high' ? 'warning' : 'default' },
    {
      id: 'device',
      label: 'Thiết bị',
      tone: 'link',
      value: assetId ? (
        <Link to={assetPath(assetId)} className="inline-flex items-center gap-1 rounded-sm hover:underline">
          {r.device}
          <ExternalLinkIcon size={12} />
          <span className="sr-only">– mở trang chi tiết thiết bị</span>
        </Link>
      ) : (
        r.device
      ),
    },
    { id: 'area', label: 'Khu vực', value: r.area },
    { id: 'dept', label: 'Phòng ban', value: r.department ?? '—' },
    { id: 'assignee', label: 'Người phụ trách', value: r.assignee ?? 'Chưa phân công' },
    { id: 'start', label: 'Thời gian bắt đầu dự kiến', value: r.startAt ? formatPlantDateTime(r.startAt) : '-' },
    {
      id: 'due',
      label: 'Hạn hoàn thành',
      value: (
        <>
          {deadlineDayLabel(r.dueAt, now, dueHasTime(r))}
          {overdue && <span className="font-normal"> · Quá hạn</span>}
        </>
      ),
      // Đỏ khi quá hạn hoặc đến hạn trong hôm nay (ảnh: "16:00 Hôm nay" đỏ).
      tone: !closed && (overdue || daysFromToday(r.dueAt, now) <= 0) ? 'danger' : 'default',
    },
    {
      id: 'status',
      label: 'Trạng thái',
      value: r.hold ? `${STATUS_LABEL[r.status]} · ${HOLD_LABEL[r.hold.kind]}` : STATUS_LABEL[r.status],
      tone: r.hold?.kind === 'blocked' ? 'danger' : r.status === 'pending' || r.hold ? 'warning' : 'default',
      newRow: true,
    },
    { id: 'reported', label: 'Tiến độ báo cáo', value: `${reported}%` },
    { id: 'checklist', label: 'Checklist', value: r.checklist?.length ? `${progress.done}/${progress.total}` : 'Không có' },
    ...(r.hold
      ? [{ id: 'hold', label: r.hold.kind === 'blocked' ? 'Sự cố đang gặp' : 'Lý do tạm dừng', value: `${r.hold.reason} (${relativeDayTime(r.hold.at, now)})` }]
      : []),
  ];

  const onAdvance = async () => {
    const label = nextLabel;
    await advance(r.id, actor);
    announce(`${r.code}: ${label} – đã ghi lịch sử.`);
  };

  const download = (a: MaintenanceAttachment) => downloadSampleAttachment(a, r.code);

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Bảo trì', to: '/maintenance' }, { label: 'Quản lý bảo trì', to: listUrl }, { label: r.code }]}
      title={r.title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="severity" value={r.priority} size="chip" withIcon={r.priority === 'critical'} />
          <Badge variant="status" value={STATUS_BADGE[r.status]} size="md" withIcon>
            {STATUS_LABEL[r.status]}
          </Badge>
          {r.priority === 'critical' && (
            <Badge variant="tag" size="md">
              Bảo trì khẩn cấp
            </Badge>
          )}
          {r.hold && (
            <Badge variant="tag" size="md" tone={r.hold.kind === 'blocked' ? 'danger' : 'warning'}>
              {HOLD_LABEL[r.hold.kind]}
            </Badge>
          )}
          {r.reviewFailed && r.status === 'in-progress' && (
            <Badge variant="tag" size="md" tone="danger">
              {REVIEW_FAILED_LABEL}
            </Badge>
          )}
          {overdue && (
            <Badge variant="status" value="unacknowledged" size="md">
              Quá hạn
            </Badge>
          )}
        </span>
      }
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate(listUrl)}>
          ← Quay lại danh sách
        </Button>
      }
    />
  );

  return (
    <Page pageHeader={header}>
      <WorkflowStepper steps={stepsFor(r)} completed={pos.completed} current={pos.current} label={`Tiến trình xử lý ${r.code}`} className="min-h-[var(--mt-stepper-height)]" />

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
          <Card title="Thông tin chung" icon={<InfoIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg">
            <InfoGrid items={info} />
          </Card>

          <Card title="Nội dung công việc" icon={<FileIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg">
            <h4 className="mb-2 text-base text-fg-secondary">Mô tả sự cố</h4>
            <p className="rounded-md border border-line/30 bg-surface-sunken/40 px-3 py-2.5 text-base leading-6 text-fg">{r.description ?? 'Chưa có mô tả.'}</p>
            <h4 className="mb-2 mt-5 text-base text-fg-secondary">Mục tiêu xử lý</h4>
            {r.objectives?.length ? (
              <ul className="flex flex-col gap-1.5 pl-3 text-base text-fg">
                {r.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-fg-secondary">Chưa có mục tiêu.</p>
            )}
          </Card>

          <div ref={checklistRef} id="checklist" tabIndex={-1} className="scroll-mt-24 rounded-lg">
          <Card
            title="Checklist công việc"
            icon={<ListChecksIcon size={18} className="text-fg-secondary" />}
            headerVariant="divided"
            radius="lg"
            headerEnd={r.checklist?.length ? <span className="text-sm text-fg-secondary">{checklistSummary(progress)}</span> : undefined}
          >
            {r.checklist?.length ? (
              <Checklist
                items={r.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done, na: c.na, active: c.active, time: c.doneAt?.slice(11, 16) }))}
                progress={progress}
                lockHint={lock ? (canWrite ? CHECKLIST_LOCK_HINT[lock] : 'Bạn chỉ có quyền xem checklist.') : null}
                onToggle={
                  lock
                    ? undefined
                    : (itemId) => {
                        const item = r.checklist!.find((c) => c.id === itemId)!;
                        void runAction(async () => {
                          await toggleChecklist(r.id, itemId);
                          announce(`${item.done ? 'Bỏ đánh dấu' : 'Đã hoàn thành'}: ${item.text}`);
                        });
                      }
                }
              />
            ) : (
              <p className="text-base text-fg-secondary">Yêu cầu chưa có checklist.</p>
            )}
          </Card>
          </div>

          <Card title="Ghi chú kỹ thuật" icon={<NotesIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg">
            <NotesThread
              notes={(r.notes ?? []).map((n) => ({ id: n.id, author: n.author, time: relativeDayTime(n.at, now), text: n.text }))}
              onAdd={canWrite && r.status !== 'cancelled' ? (text) => void runAction(() => addNote(r.id, text, actor)) : undefined}
            />
          </Card>

          <Card title="Ảnh và tài liệu" icon={<FolderIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg">
            {/* TODO(backend): tải tệp lên khi có API lưu trữ – hiện chỉ xem/tải bản mẫu; tệp thêm ở modal cập nhật tiến độ chỉ giữ tên/kích thước (isTemp). */}
            {r.attachments?.length ? (
              <div className="flex flex-wrap gap-3">
                {r.attachments.map((a) => (
                  <AttachmentCard
                    key={a.id}
                    id={a.id}
                    name={a.name}
                    kind={a.kind}
                    notice={a.isTemp ? 'Chưa tải lên máy chủ' : undefined}
                    onView={() => setViewing(a)}
                    onDownload={a.isTemp ? undefined : () => download(a)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-base text-fg-secondary">Chưa có ảnh hoặc tài liệu.</p>
            )}
          </Card>

          <Card title="Lịch sử xử lý" icon={<HistoryIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg">
            {r.history?.length ? <EventTimeline variant="history" events={historyEvents(r, now)} /> : <p className="text-base text-fg-secondary">Chưa có lịch sử.</p>}
          </Card>

          <Card title="Kết quả bảo trì" icon={<ClipboardCheckIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg">
            {r.status === 'done' && r.review?.result === 'pass' ? (
              <MaintenanceResult record={r} />
            ) : r.status === 'done' ? (
              <p className="text-base text-fg">
                Hoàn thành ngày {r.completedAt ? formatDate(r.completedAt) : '—'} · tiến độ {r.progress}%.
              </p>
            ) : r.status === 'cancelled' ? (
              <p className="text-base text-fg-secondary">Yêu cầu đã hủy{r.cancelReason ? ` – lý do: ${r.cancelReason}` : ''}.</p>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <ClipboardClockIcon size={40} className="text-fg-secondary" />
                <p className="text-base text-fg-secondary">Kết quả bảo trì sẽ được cập nhật sau khi công việc hoàn thành.</p>
              </div>
            )}
          </Card>
        </div>

        {/* ---- Cột phải ---- */}
        <aside aria-label="Phân công và liên quan" className="flex min-w-0 flex-col gap-4 xl:col-start-2 xl:row-start-2">
          <AssigneeCard
            assignee={r.assignee}
            department={r.department}
            shift={shiftShort(r.shift)}
            // Phân công (Chờ tiếp nhận) / Đổi người (Đã phân công, Đang thực hiện); Chờ nghiệm thu / xong / hủy: không có nút.
            onAssign={canWrite && assignMode(r.status) ? () => setDialog('assign') : undefined}
            assignLabel={assignMode(r.status) === 'assign' ? 'Phân công người xử lý' : 'Đổi người xử lý'}
          />
          <Card title="Cảnh báo liên quan" icon={<AlertTriangleIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg">
            {alert ? (
              <AlertCard
                variant="compact"
                id={alert.id}
                severity={alert.severity}
                code={alert.code}
                device={alert.device}
                message={alert.message}
                value={`${alert.value} ${alert.unit}`}
                threshold={`${alert.threshold} ${alert.unit}`}
                handling="action-required"
                valueLabel="Lúc cảnh báo"
                footer={
                  <Link to={`/alerts?alert=${alert.id}&range=30d`} className="self-start rounded-sm text-xs text-accent hover:underline">
                    Xem chi tiết cảnh báo →
                  </Link>
                }
              />
            ) : (
              <p className="text-base text-fg-secondary">{r.sourceAlertId ? `Không tìm thấy cảnh báo ${r.sourceAlertId}.` : 'Không có cảnh báo liên quan.'}</p>
            )}
          </Card>
          <RelatedDeviceCard device={r.device} />
        </aside>
      </div>

      {canWrite && !closed && (
        <StickyActionBar label={`Thao tác yêu cầu ${r.code}`}>
          {canCancel(r.status) && (
            <Button variant="subtle" onClick={() => setDialog('cancel')}>
              Hủy yêu cầu
            </Button>
          )}
          {r.status === 'pending' && nextLabel && (
            <Button variant="outline" onClick={() => void runAction(onAdvance)}>
              {nextLabel}
              <SendIcon size={16} />
            </Button>
          )}
          {r.status === 'in-progress' && (
            <Button variant="subtle" onClick={() => setDialog('submit')}>
              Gửi nghiệm thu
            </Button>
          )}
          {canUpdateProgress(r.status) && (
            <Button variant="outline" onClick={() => setDialog('progress')}>
              Cập nhật tiến độ
            </Button>
          )}
          {r.status === 'review' && canReview && (
            <Button variant="outline" onClick={() => setDialog('review')}>
              Nghiệm thu
            </Button>
          )}
        </StickyActionBar>
      )}

      {dialog === 'progress' && (
        <ProgressUpdateModal
          record={r}
          onClose={() => setDialog(null)}
          onOpenChecklist={() => {
            setDialog(null);
            navigate({ hash: 'checklist' }, { replace: true, state: location.state });
          }}
          onSubmit={async (input) => {
            await updateProgress(r.id, input, actor);
            setDialog(null);
            announce(`Đã cập nhật tiến độ ${r.code} – đã ghi lịch sử.`);
          }}
          onContinueToSubmit={(prefill) => {
            setSubmitPrefill(prefill);
            setDialog('submit');
          }}
        />
      )}
      {dialog === 'submit' && (
        <SubmitReviewModal
          record={r}
          prefill={submitPrefill}
          onClose={() => {
            setDialog(null);
            setSubmitPrefill(undefined);
          }}
          onSubmit={async (input) => {
            await submitForReview(r.id, input, actor);
            setDialog(null);
            setSubmitPrefill(undefined);
            announce(`Đã gửi nghiệm thu ${r.code} – chờ ${input.reviewer} nghiệm thu.`);
          }}
        />
      )}
      {dialog === 'review' && (
        <ReviewModal
          record={r}
          reviewer={reviewer}
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            await review(r.id, input);
            setDialog(null);
            announce(
              input.result === 'pass'
                ? `${r.code}: nghiệm thu đạt – đã hoàn thành.`
                : `${r.code}: nghiệm thu ${input.result === 'fail' ? 'không đạt' : 'cần bổ sung'} – quay về Đang thực hiện.`,
            );
          }}
        />
      )}

      {/* Hộp thoại: chỉ mount khi mở (form khởi tạo đúng ngay lần vẽ đầu). */}
      {dialog === 'assign' && (
        <AssignModal
          record={r}
          records={allRecords ?? []}
          onClose={() => setDialog(null)}
          onSubmit={async (form) => {
            const before = r.assignee;
            await assign(r.id, form, actor);
            // Đổi sang người khác: nháp tiến độ / gửi nghiệm thu của người cũ (trên trình duyệt này) không chuyển cho người mới.
            if (before && before !== form.assignee) {
              clearProgressDraft(r.id);
              clearSubmitDraft(r.id);
            }
            setDialog(null);
            // TODO(backend): gửi thông báo đẩy/SMS cho người được phân công (công tắc trong modal chỉ là giao diện).
            announce(before && before !== form.assignee ? `${r.code}: đã đổi người xử lý sang ${form.assignee}.` : `Đã phân công ${r.code} cho ${form.assignee}.`);
          }}
        />
      )}
      {dialog === 'cancel' && (
        <CancelMaintenanceModal
          record={r}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            await cancel(r.id, reason, actor);
            clearProgressDraft(r.id);
            clearSubmitDraft(r.id);
            setDialog(null);
            announce(`Đã hủy yêu cầu ${r.code}.`);
          }}
        />
      )}
      {viewing && (
        <ViewAttachmentModal
          attachment={viewing}
          meta={formatFileSize(viewing.size)}
          onClose={() => setViewing(null)}
          onDownload={() => download(viewing)}
        />
      )}
    </Page>
  );
}

