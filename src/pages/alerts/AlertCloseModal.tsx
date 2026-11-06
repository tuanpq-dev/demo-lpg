import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Checkbox, Icon, Modal, Select, Textarea } from '@/components';
import { closeSummary, followUpConfig, metricText, useCloseConditions } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import {
  CLOSE_MANUAL_ITEMS,
  SYSTEM_CONDITION_LABEL,
  allConditionsOk,
  closerCheck,
  resolverOf,
  type CloseCondition,
  type CloseInput,
  type CloseResult,
  type MonitorResult,
} from '@/features/alerts/close';
import { followUpDurationLabel } from '@/features/alerts/update';
import { actionErrorText } from '@/lib/actionError';
import { announce } from '@/lib/announce';
import { plantTimeOfDay } from '@/lib/plantTime';
import { areaLabel } from '@/features/plant/areas';

export type AlertCloseModalProps = {
  alert: AlertRecord;
  /** Toàn bộ cảnh báo – điều kiện "Không còn cảnh báo liên quan đang hoạt động". */
  allAlerts: readonly AlertRecord[];
  /** Người đang thao tác = người đóng (chưa đăng nhập: 'Admin'). */
  actor: string;
  onClose: () => void;
  /** Ghi "Xác nhận đóng" (data layer gọi `closeAlert` – kiểm lại). Nơi gọi đóng modal khi ok. */
  onConfirmClose: (input: CloseInput, conditions: readonly CloseCondition[]) => Promise<CloseResult> | CloseResult;
  /** Ghi "Tiếp tục theo dõi" (`continueMonitoring`). */
  onMonitor: (input: { minutes: number; note: string }) => Promise<MonitorResult> | MonitorResult;
};

const hhmm = (iso?: string) => (iso ? plantTimeOfDay(new Date(iso)).slice(0, 5) : '–');
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * "Xác nhận đóng cảnh báo" – CHUNG mọi loại (ảnh `scratch/figma-ref/alert-close-modal-{header,body,footer}.png`, 28/10/2026;
 * lệch ảnh ghi docs/figma-diffs.md; docs/guide/alerts.md (4p)). Mở từ drawer khi cảnh báo Đã xử lý (chờ đóng).
 * Thẻ đầu · Kết quả kỹ thuật (chỉ đọc – từ modal cập nhật) · Xác nhận điều kiện (3 mục HỆ THỐNG tự kiểm + 2 mục tick tay) ·
 * Ghi chú kết luận (bắt buộc khi đóng) · Thời gian theo dõi (điền sẵn từ modal cập nhật – một giá trị `followUp`).
 * Quy tắc: `features/alerts/close.ts`. Chỉ mount khi mở (chunk lazy riêng).
 */
export default function AlertCloseModal({ alert: a, allAlerts, actor, onClose, onConfirmClose, onMonitor }: AlertCloseModalProps) {
  const uid = useId();
  const ids = { closeBlock: `${uid}-close-block`, monitorBlock: `${uid}-monitor-block`, closer: `${uid}-closer` };
  const follow = followUpConfig(a);
  const conditions = useCloseConditions([a], allAlerts)[a.id] ?? [];
  const summary = closeSummary(a);
  const closer = closerCheck(a, actor);

  const [note, setNote] = useState('');
  const [minutes, setMinutes] = useState(() => a.followUp?.minutes ?? follow.defaultMinutes);
  const [manual, setManual] = useState<string[]>(() => [...(a.closeChecks ?? [])]);
  const [noteError, setNoteError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const optionMinutes = [...new Set([...follow.options, ...(a.followUp ? [a.followUp.minutes] : [])])].sort((x, y) => x - y);
  const followOptions = optionMinutes.map((m) => ({ value: String(m), label: `${followUpDurationLabel(m)}${m === follow.defaultMinutes ? ' (Mặc định)' : ''}` }));

  const condOk = allConditionsOk(conditions);
  const closeIssues = [!closer.ok && closer.reason, !condOk && 'Chưa đủ 3 điều kiện hệ thống.', !note.trim() && 'Nhập ghi chú kết luận.'].filter(Boolean) as string[];
  const closeLocked = closeIssues.length > 0;
  const monitorLocked = minutes <= 0;

  const run = async (fn: () => Promise<CloseResult | MonitorResult> | CloseResult | MonitorResult) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) {
        setMessage(res.message);
        if (res.reason === 'note') setNoteError(res.message);
        announce(res.message);
      }
    } catch (e) {
      const text = actionErrorText(e);
      setMessage(text);
      announce(text);
    } finally {
      setBusy(false);
    }
  };
  const confirmClose = () => {
    if (closeLocked) {
      if (!note.trim()) setNoteError('Nhập ghi chú kết luận trước khi đóng.');
      announce(`Chưa đóng được: ${closeIssues.join(' ')}`);
      return;
    }
    void run(() => onConfirmClose({ note, followUpMinutes: minutes, manualChecks: manual }, conditions));
  };
  const monitor = () => {
    if (monitorLocked) return announce('Chọn thời gian theo dõi để tiếp tục theo dõi.');
    void run(() => onMonitor({ minutes, note }));
  };

  const timeRange = (
    <span className="inline-flex items-center gap-2">
      {a.time.slice(0, 5)}
      <span aria-hidden="true" className="text-fg-secondary">
        →
      </span>
      <span className="sr-only">đến</span>
      {hhmm(a.resolvedAt)}
    </span>
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Xác nhận đóng cảnh báo"
      description={`Kiểm tra kết quả xử lý và xác nhận kết thúc cảnh báo ${a.code}`}
      dismissOnBackdrop={!note}
      onSubmit={(e) => {
        e.preventDefault();
        confirmClose();
      }}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="subtle" disabled={busy} onClick={monitor} aria-disabled={monitorLocked || undefined} aria-describedby={monitorLocked ? ids.monitorBlock : undefined}>
            Tiếp tục theo dõi
          </Button>
          <Button type="submit" variant="primary" disabled={busy} aria-disabled={closeLocked || undefined} aria-describedby={closeLocked ? ids.closeBlock : undefined}>
            <CheckCircle />
            Xác nhận đóng cảnh báo
          </Button>
        </>
      }
    >
      {/* Thẻ đầu */}
      <div className="flex flex-col gap-4 rounded-lg border border-line-card bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="flex min-w-0 items-center gap-3 text-lg font-semibold text-fg sm:text-xl">
            <Icon name="danger" box={24} />
            <span className="min-w-0">
              {a.code}: {a.message}
            </span>
          </p>
          <Badge variant="status" value="resolved" size="md" />
        </div>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Info label="Thiết bị" value={a.device} />
          <Info label="Khu vực" value={areaLabel(a.area)} />
          <Info label="Người xử lý" value={resolverOf(a) ?? '–'} />
          <Info label="Thời gian" value={timeRange} />
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Kết quả kỹ thuật */}
        <section aria-labelledby={`${uid}-h-result`} className="flex flex-col gap-4 rounded-lg border border-line-card bg-surface p-4 sm:p-6">
          <h3 id={`${uid}-h-result`} className="text-xl font-semibold text-fg">
            Kết quả kỹ thuật
          </h3>
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-3">
            <dt className="text-sm font-semibold text-fg-secondary">Nguyên nhân:</dt>
            <dd className="text-md text-fg">{summary.cause ?? '–'}</dd>
            <dt className="text-sm font-semibold text-fg-secondary">Hành động:</dt>
            <dd className="whitespace-pre-wrap text-md text-fg">{summary.action ?? '–'}</dd>
          </dl>
          <div className="flex flex-col gap-3 rounded-md border border-line/30 bg-surface-sunken p-4">
            {summary.falseAlarm ? (
              <p className="flex justify-between gap-3 text-md">
                <span className="text-fg-secondary">Kết luận</span>
                <span className="font-semibold text-fg">Báo động giả</span>
              </p>
            ) : (
              <>
                <Reading label={`${cap(summary.quantity)} trước`} value={summary.before} unit={summary.unit} tone="danger" />
                <Reading label={`${cap(summary.quantity)} sau`} value={summary.after} unit={summary.unit} tone="success" />
                <p className="flex justify-between gap-3 border-t border-line/30 pt-3 text-md">
                  <span className="text-fg-secondary">Ngưỡng cho phép</span>
                  <span className="text-fg">
                    {summary.direction === 'above' ? '<' : '>'} {metricText(summary.limit, summary.unit)}
                  </span>
                </p>
              </>
            )}
          </div>
        </section>

        {/* Xác nhận điều kiện */}
        <fieldset className="flex min-w-0 flex-col gap-4 rounded-lg border border-line-card bg-surface p-4 sm:p-6">
          <legend className="sr-only">Xác nhận điều kiện</legend>
          <p aria-hidden="true" className="text-xl font-semibold text-fg">
            Xác nhận điều kiện
          </p>
          <ul className="flex flex-col gap-4">
            {conditions.map((c) => (
              <SystemCondition key={c.id} uid={uid} condition={c} />
            ))}
            {CLOSE_MANUAL_ITEMS.map((m) => (
              <li key={m.id} className="flex items-start gap-3">
                <span className="pt-1">
                  <Checkbox
                    id={`${uid}-${m.id}`}
                    label={m.text}
                    checked={manual.includes(m.id)}
                    onChange={(on) => setManual((cur) => (on ? [...cur, m.id] : cur.filter((x) => x !== m.id)))}
                  />
                </span>
                <label htmlFor={`${uid}-${m.id}`} className="cursor-pointer text-md text-fg">
                  {m.text}
                </label>
              </li>
            ))}
          </ul>
          <p className="text-sm text-fg-secondary">
            Mục có <span className="text-danger-text">*</span> do hệ thống kiểm tra (số trực tiếp, cảnh báo đang mở) – tự đánh dấu khi đạt.
          </p>
        </fieldset>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Textarea
          label="Ghi chú kết luận"
          labelVariant="section"
          value={note}
          onChange={(t) => {
            setNote(t);
            setNoteError(undefined);
            setMessage('');
          }}
          rows={4}
          maxLength={1000}
          error={noteError}
          placeholder="Nhập ghi chú hoặc kết luận cuối cùng..."
          hint="Bắt buộc khi đóng cảnh báo; không bắt buộc khi tiếp tục theo dõi."
        />
        <div className="flex flex-col gap-2">
          <span id={`${uid}-follow`} className="text-lg font-semibold text-fg-secondary">
            Thời gian theo dõi sau xử lý
          </span>
          <Select variant="field" label="Thời gian theo dõi sau xử lý" labelledBy={`${uid}-follow`} options={followOptions} value={String(minutes)} onChange={(m) => m && setMinutes(Number(m))} side="top" />
          <p className="text-sm text-fg-secondary">Điền sẵn từ lần cập nhật xử lý. Tiếp tục theo dõi: tính lại từ lúc lưu nếu đổi thời gian.</p>
        </div>
      </div>

      {!closer.ok && (
        <p id={ids.closer} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-fg">
          {closer.reason} Người đóng hiện tại: {actor}. TODO: kiểm tra vai trò người đóng ở backend.
        </p>
      )}
      {closeLocked && (
        <div id={ids.closeBlock} className="text-sm text-fg-secondary">
          Chưa đóng được – còn thiếu: {closeIssues.join(' ')}
        </div>
      )}
      {monitorLocked && (
        <p id={ids.monitorBlock} className="text-sm text-fg-secondary">
          Chọn thời gian theo dõi (khác "Không theo dõi") để tiếp tục theo dõi.
        </p>
      )}
      <p role="status" className={message ? 'text-sm text-warning' : 'sr-only'}>
        {message}
      </p>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="text-md text-fg-secondary">{label}</dt>
      <dd className="text-md font-semibold text-fg">{value}</dd>
    </div>
  );
}

function Reading({ label, value, unit, tone }: { label: string; value?: number; unit: string; tone: 'danger' | 'success' }) {
  return (
    <p className="flex justify-between gap-3 text-md">
      <span className="text-fg-secondary">{label}</span>
      {value !== undefined ? (
        <span className={tone === 'danger' ? 'text-danger-text' : 'text-success'}>{metricText(value, unit)}</span>
      ) : (
        <span className="text-fg-secondary">–</span>
      )}
    </p>
  );
}

/** Mục điều kiện do HỆ THỐNG kiểm tra: đạt → tự tick (chỉ đọc); chưa đạt → không tick được + lý do + link cảnh báo liên quan. */
function SystemCondition({ uid, condition: c }: { uid: string; condition: CloseCondition }) {
  const id = `${uid}-${c.id}`;
  const reasonId = `${id}-reason`;
  const label = SYSTEM_CONDITION_LABEL[c.id];
  return (
    <li className="flex items-start gap-3">
      <span className="pt-1">
        <Checkbox
          id={id}
          label={`${label} (bắt buộc, hệ thống kiểm tra)`}
          checked={c.ok}
          onChange={() => {}}
          aria-readonly={c.ok || undefined}
          aria-disabled={!c.ok || undefined}
          aria-describedby={c.reason ? reasonId : undefined}
        />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className="text-md text-fg">
          {label} <span aria-hidden="true" className="text-danger-text">*</span>
        </label>
        {c.reason && (
          <p id={reasonId} className={c.ok ? 'text-sm text-fg-secondary' : 'text-sm text-warning'}>
            {c.reason}
          </p>
        )}
        {c.related && c.related.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm" aria-label="Cảnh báo liên quan đang mở">
            {c.related.map((r) => (
              <li key={r.id}>
                <Link to={`/alerts?alert=${r.id}`} className="rounded-sm text-info hover:underline" title={r.message}>
                  {r.code}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function CheckCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 10.2l2.4 2.4 4.6-4.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
