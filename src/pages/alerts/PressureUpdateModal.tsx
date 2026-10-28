import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AssignNotices,
  AttachmentCard,
  Badge,
  BeforeAfterReadings,
  Button,
  Checkbox,
  DatePicker,
  InfoGrid,
  InspectionTable,
  Modal,
  NumberField,
  Select,
  StaffList,
  StatusOptionGroup,
  TextField,
  Textarea,
  UploadTile,
  formatFileSize,
  type ReadingRowView,
  type StatusOption,
} from '@/components';
import {
  alertDateTimeLabel,
  alertMetric,
  alertPlaybook,
  metricText,
  pressureDraft,
  pressureReadingRows,
  pressureUpdateConfig,
  useTagReadings,
  verificationItems,
} from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import {
  INSPECTION_STATUSES,
  INSPECTION_STATUS_LABEL,
  inspectionItems,
  setInspectionStatus,
  type InspectionEntry,
  type InspectionStatus,
} from '@/features/alerts/inspection';
import {
  PRESSURE_STATE_LABEL,
  PRESSURE_STATES,
  SOURCE_LABEL,
  canClosePressure,
  followUpChoiceLabel,
  followUpWindow,
  hasErrors,
  hasGauge,
  normalItemId,
  pressureStateOf,
  pressureWarnings,
  readingTone,
  suggestsSupport,
  validatePressureUpdate,
  type FollowUpChoice,
  type PressureCheck,
  type PressureErrors,
  type PressureFile,
  type PressureState,
  type PressureUpdateInput,
  type PressureUpdateResult,
  type VerificationSource,
} from '@/features/alerts/pressure';
import { UPLOAD_ACCEPT, UPLOAD_HINT, checkUploads, uploadKind } from '@/features/maintenance/progress';
import { announce } from '@/lib/announce';
import { appNow } from '@/lib/demoNow';
import { parsePlantDateTime, plantDateTimeKey, plantTimeOfDay } from '@/lib/plantTime';
import { useNow } from '@/lib/useNow';
import { areaLabel } from '@/mocks/areas';
import { assetMocks } from '@/mocks/assets';
import { STAFF } from '@/mocks/maintenance';
import { downloadSampleAttachment } from '../maintenance/attachments';
import { supportStaffItems } from './SupportRequestModal';

export type PressureUpdateModalProps = {
  alert: AlertRecord;
  /** Người đang thao tác – tự điền "Người kiểm tra" khi đổi trạng thái hạng mục. */
  actor: string;
  onClose: () => void;
  /** Ghi bản ghi (data layer gọi `pressureUpdate` – kiểm lại toàn bộ). Nơi gọi đóng modal khi ok. */
  onSubmit: (input: PressureUpdateInput, check: PressureCheck) => Promise<PressureUpdateResult> | PressureUpdateResult;
  /** Giờ cố định (playground). */
  fixedNow?: Date;
};

type FormValues = Omit<PressureUpdateInput, 'files' | 'readings'> & {
  source: VerificationSource;
  /** Giờ nhà máy "yyyy-mm-ddTHH:mm". */
  recordedAt: string;
  /** Giá trị "Sau" sửa tay theo dòng (chỉ dùng khi nguồn có đồng hồ cơ). Thiếu khoá = theo số live. */
  manualAfter: Record<string, number | null>;
  /** Giờ nhà máy "yyyy-mm-ddTHH:mm" – theo dõi Tùy chỉnh. */
  customAtLocal: string;
};

type TempFile = PressureFile & { id: string };

const STATE_TONE: Record<PressureState, StatusOption['tone']> = {
  inspecting: 'primary',
  resolving: 'primary',
  paused: 'warning',
  'needs-support': 'warning',
  resolved: 'primary',
};
const STATUS_OPTIONS = INSPECTION_STATUSES.map((s) => ({ value: s, label: INSPECTION_STATUS_LABEL[s] }));
const SOURCE_OPTIONS = (Object.keys(SOURCE_LABEL) as VerificationSource[]).map((s) => ({ value: s, label: SOURCE_LABEL[s] }));
const OWNER_OPTIONS = STAFF.map((p) => ({ value: p.name, label: p.name }));

/**
 * Modal "Cập nhật xử lý cảnh báo áp suất" (ảnh `scratch/figma-ref/alert-pressure-update-modal-design.png`, 28/10/2026; chưa
 * có node – lệch ảnh ghi docs/figma-diffs.md; docs/guide/alerts.md (4o)). Chỉ loại có `update.kind = 'pressure-update'` (tank-overpressure).
 * Thẻ đầu · Trạng thái xử lý (5 ô) · Kết quả kiểm tra thiết bị (= hướng dẫn của drawer, một nguồn) · Thông số trước/sau ·
 * Kết quả xác minh · Nguyên nhân / Nội dung · Ảnh và tài liệu · Vấn đề phát sinh · Theo dõi sau xử lý.
 * Quy tắc: `features/alerts/pressure.ts`. Nháp sessionStorage theo mã. Chỉ mount khi mở (chunk lazy riêng).
 */
export default function PressureUpdateModal({ alert: a, actor, onClose, onSubmit, fixedNow }: PressureUpdateModalProps) {
  const liveNow = useNow(30_000);
  const now = fixedNow ?? liveNow;
  const cfg = pressureUpdateConfig(a)!;
  const steps = useMemo(() => alertPlaybook(a).steps, [a]);
  const rowsCfg = useMemo(() => pressureReadingRows(a, cfg), [a, cfg]);
  const verItems = useMemo(() => verificationItems(a, cfg), [a, cfg]);
  const normalId = normalItemId(cfg);
  const metric = alertMetric(a);
  const readings = useTagReadings(rowsCfg.map((r) => r.tag));

  const uid = useId();
  const ids = {
    stateReason: `${uid}-state-reason`,
    normalHint: `${uid}-normal-hint`,
    followHint: `${uid}-follow-hint`,
    block: `${uid}-block`,
    supportHint: `${uid}-support-hint`,
  };
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  const [initial] = useState(() => {
    const base: FormValues = {
      state: pressureStateOf(a),
      holdReason: a.hold?.reason ?? '',
      supportPeople: [],
      inspection: Object.fromEntries(inspectionItems(steps, a.guide).map(({ id, text: _t, ...e }) => [id, e])),
      verification: [...(a.verification ?? [])],
      cause: a.cause ?? '',
      actionTaken: a.actionTaken ?? '',
      issue: { kind: a.issue?.kind ?? 'none', note: a.issue?.note ?? '' },
      followUp: { choice: cfg.followUp.defaultMinutes, target: cfg.followUp.target, owner: a.assignee ?? '' },
      source: 'both',
      recordedAt: plantDateTimeKey(fixedNow ?? appNow()),
      manualAfter: {},
      customAtLocal: '',
    };
    const draft = pressureDraft.load(a.id);
    if (!draft) return { base, values: base, draft: false };
    const manualAfter: Record<string, number | null> = {};
    for (const r of draft.readings.rows) if (r.manual) manualAfter[r.id] = r.after ?? null;
    const values: FormValues = {
      ...base,
      ...draft,
      source: draft.readings.source,
      recordedAt: plantDateTimeKey(new Date(draft.readings.at)),
      manualAfter,
      customAtLocal: draft.followUp.customAt ? plantDateTimeKey(new Date(draft.followUp.customAt)) : '',
    };
    return { base, values, draft: true };
  });
  const [v, setV] = useState<FormValues>(initial.values);
  const [files, setFiles] = useState<TempFile[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [errors, setErrors] = useState<PressureErrors>({});
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasDraft, setHasDraft] = useState(initial.draft);
  // "Đã sửa" = khác bản đã lưu gần nhất (nháp khôi phục / vừa lưu nháp) – đóng sau khi lưu nháp không hỏi lại.
  const [savedSnap, setSavedSnap] = useState(() => JSON.stringify(initial.values));
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (confirming) keepEditingRef.current?.focus();
  }, [confirming]);
  // Lỗi trả về lúc lưu chỉ đúng với giá trị lúc đó → sửa form là bỏ (lỗi theo giá trị hiện tại vẫn tính lại mỗi lần render).
  useEffect(() => setErrors({}), [v]);

  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((cur) => ({ ...cur, [k]: val }));
  const editable = hasGauge(v.source);

  // ---- Thông số trước/sau ----
  const rowValues = rowsCfg.map((r) => {
    const rd = r.tag ? readings[r.tag] : undefined;
    const live = rd?.state === 'ok' ? rd.value : undefined;
    const manual = editable && r.id in v.manualAfter;
    const after = manual ? (v.manualAfter[r.id] ?? undefined) : live;
    return { cfg: r, reading: rd ?? { state: 'none' as const }, live, after, manual };
  });
  const primary = rowValues.find((x) => x.cfg.primary)!;
  const warn = primary.cfg.warn ?? Number(a.threshold);
  const close = canClosePressure({
    liveState: primary.reading.state,
    live: primary.live,
    after: primary.after,
    source: v.source,
    warn,
    unit: a.unit,
  });
  const readingRows: ReadingRowView[] = rowValues.map(({ cfg: r, after, reading }) => ({
    id: r.id,
    label: r.label,
    limit: r.primary && r.warn !== undefined ? `Giới hạn: ${metricText(r.warn, r.unit)}` : undefined,
    unit: r.unit,
    before: r.before,
    after,
    beforeTone: readingTone(r.before, r.warn, r.danger),
    afterTone: readingTone(after, r.warn, r.danger),
    editable,
    afterPlaceholder: reading.state === 'lost' ? 'Mất tín hiệu' : reading.state === 'pending' ? '…' : reading.state === 'none' ? 'Chưa có tag' : undefined,
  }));

  // ---- Input + kiểm tra ----
  const verText = (id: string) => verItems.find((x) => x.id === id)?.text ?? id;
  const check: PressureCheck = { close, config: cfg, steps, verificationText: verText, unit: a.unit };
  const recordedIso = (parsePlantDateTime(v.recordedAt) ?? now).toISOString();
  const customIso = v.customAtLocal ? parsePlantDateTime(v.customAtLocal)?.toISOString() : undefined;
  const input: PressureUpdateInput = {
    state: v.state,
    holdReason: v.holdReason,
    supportPeople: v.supportPeople,
    inspection: v.inspection,
    readings: {
      source: v.source,
      at: recordedIso,
      rows: rowValues.map((x) => ({ id: x.cfg.id, before: x.cfg.before, after: x.after, manual: x.manual || undefined })),
    },
    verification: v.verification,
    cause: v.cause,
    actionTaken: v.actionTaken,
    issue: v.issue,
    files: files.map(({ id: _id, ...f }) => f),
    followUp: { ...v.followUp, customAt: v.followUp.choice === 'custom' ? customIso : undefined },
  };
  // Lỗi hiện sau lần bấm "Lưu cập nhật" đầu tiên (rồi cập nhật theo giá trị) – trước đó chỉ hiện lỗi mâu thuẫn xác minh.
  const liveErrors = validatePressureUpdate(input, check, now);
  const shown: PressureErrors = triedSubmit ? liveErrors : { verification: liveErrors.verification };
  const warnings = pressureWarnings(input, check);
  const resolved = v.state === 'resolved';
  const followActive = resolved && v.followUp.choice !== 0;
  const preview_ = followUpWindow(v.followUp.choice, customIso, now);

  const dirty = JSON.stringify(v) !== savedSnap || files.length > 0;

  // ---- Thao tác ----
  const requestClose = () => {
    if (confirming) return setConfirming(false);
    if (dirty) setConfirming(true);
    else onClose();
  };
  // Bỏ thay đổi chưa lưu – nháp đã lưu (nếu có) GIỮ lại; nháp chỉ xoá khi "Lưu cập nhật" thành công.
  const discard = () => onClose();
  const saveDraft = () => {
    const { files: _f, ...rest } = input;
    const ok = pressureDraft.save(a.id, { ...rest, savedAt: appNow().toISOString() });
    if (ok) {
      setHasDraft(true);
      setSavedSnap(JSON.stringify(v));
      announce(`Đã lưu nháp cập nhật xử lý ${a.code}${files.length ? ' (tệp tạm không lưu vào nháp)' : ''}.`);
    } else announce('Không lưu được nháp – trình duyệt chặn bộ nhớ phiên.');
  };
  const addFiles = (list: File[]) => {
    const { accepted, rejected } = checkUploads(list, files.length);
    setUploadError(rejected.length ? rejected.map((x) => `${x.name}: ${x.reason}`).join('; ') : '');
    if (!accepted.length) return;
    // Chỉ giữ tên / kích thước / loại – KHÔNG tạo object URL (chưa có backend để xem/tải tệp thật).
    setFiles((cur) => [...cur, ...accepted.map((f, i) => ({ id: `tmp-${cur.length + i}-${f.name}`, name: f.name, size: f.size, kind: uploadKind(f.name) }))]);
    announce(`Đã thêm ${accepted.length} tệp (chưa tải lên máy chủ).`);
  };
  const setInspection = (id: string, e: InspectionEntry) => setV((cur) => ({ ...cur, inspection: { ...cur.inspection, [id]: e } }));
  const toggleVerification = (id: string, on: boolean) =>
    setV((cur) => ({ ...cur, verification: on ? [...cur.verification, id] : cur.verification.filter((x) => x !== id) }));

  const submit = async () => {
    setTriedSubmit(true);
    setErrors({});
    const e = validatePressureUpdate(input, check, appNow());
    if (hasErrors(e)) {
      announce('Chưa lưu được – xem các mục cần bổ sung.');
      return;
    }
    setBusy(true);
    try {
      const res = await onSubmit(input, check);
      if (res.ok) pressureDraft.clear(a.id);
      else setErrors(res.errors);
    } finally {
      setBusy(false);
    }
  };

  // Lý do chặn nút "Lưu cập nhật" (sau lần bấm đầu) – tính lại theo giá trị hiện tại (+ lỗi trả về lúc lưu, xoá khi bấm lại).
  const err: PressureErrors = triedSubmit ? { ...errors, ...liveErrors } : shown;
  const issues = [
    err.state && { id: 'state', label: err.state },
    err.close && { id: 'close', label: err.close },
    err.holdReason && { id: 'hold', label: err.holdReason },
    err.supportPeople && { id: 'people', label: err.supportPeople },
    err.inspection && Object.keys(err.inspection).length > 0 && { id: 'inspection', label: 'Hạng mục "Có vấn đề" cần ghi chú.' },
    err.verification && { id: 'verification', label: err.verification },
    err.cause && { id: 'cause', label: err.cause },
    err.actionTaken && { id: 'action', label: err.actionTaken },
    err.issueNote && { id: 'issue', label: err.issueNote },
    err.followUp && { id: 'follow', label: err.followUp },
  ].filter(Boolean) as { id: string; label: string }[];
  const blocked = triedSubmit && issues.length > 0;

  const stateOptions: StatusOption<PressureState>[] = PRESSURE_STATES.map((s) => ({
    id: s,
    label: PRESSURE_STATE_LABEL[s],
    tone: STATE_TONE[s],
    ...(s === 'resolved' && !close.ok ? { disabled: true, describedBy: ids.stateReason } : {}),
  }));
  const followOptions: StatusOption<string>[] = [...cfg.followUp.options, 'custom' as const].map((c) => ({
    id: String(c),
    label: followUpChoiceLabel(c),
    disabled: !resolved,
    describedBy: !resolved ? ids.followHint : undefined,
  }));
  const asset = assetMocks[a.device];
  const assigneeShown = a.assignee ?? '–';
  const sample = (a.attachments ?? []).find((f) => f.name === preview);

  const footer = confirming ? (
    <>
      <Button ref={keepEditingRef} variant="subtle" onClick={() => setConfirming(false)}>
        Tiếp tục sửa
      </Button>
      <Button variant="primary" onClick={discard}>
        {hasDraft ? 'Bỏ thay đổi (giữ bản nháp đã lưu)' : 'Bỏ thay đổi'}
      </Button>
    </>
  ) : (
    <>
      <Button variant="subtle" onClick={saveDraft}>
        Lưu nháp
      </Button>
      <Button type="submit" variant="primary" disabled={busy} aria-disabled={blocked || undefined} aria-describedby={blocked ? ids.block : undefined}>
        Lưu cập nhật
      </Button>
    </>
  );

  return (
    <Modal
      open
      onClose={requestClose}
      size="xl"
      title="Cập nhật xử lý cảnh báo áp suất"
      description={`Ghi nhận kết quả kiểm tra và tình trạng xử lý cảnh báo ${a.code}`}
      dismissOnBackdrop={!dirty}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming) void submit();
      }}
      footerStart={
        confirming ? (
          <p className="text-sm text-fg-secondary" role="status">
            Bỏ các thay đổi chưa lưu?
          </p>
        ) : (
          <Button variant="plain" onClick={requestClose}>
            Hủy
          </Button>
        )
      }
      footer={footer}
    >
      {hasDraft && initial.draft && <p className="text-sm text-fg-secondary">Bản nháp đã được khôi phục.</p>}

      {/* Thẻ đầu */}
      <div className="rounded-lg border border-line/30 bg-surface-sunken/30 p-4">
        <InfoGrid
          items={[
            { id: 'code', label: 'Mã cảnh báo', value: a.code },
            { id: 'message', label: 'Nội dung', value: a.message, tone: 'danger' },
            { id: 'device', label: 'Thiết bị', value: asset ? asset.name : a.device, newRow: true },
            { id: 'area', label: 'Khu vực', value: areaLabel(a.area) },
            { id: 'severity', label: 'Mức độ', value: <Badge variant="severity" value={a.severity} size="chip" /> },
            { id: 'assignee', label: 'Người xử lý', value: assigneeShown },
            { id: 'status', label: 'Trạng thái', value: <Badge variant="status" value={a.status} />, newRow: true },
            { id: 'time', label: 'Thời gian bắt đầu', value: alertDateTimeLabel(a, now) },
            { id: 'value', label: 'Giá trị lúc cảnh báo', value: metricText(metric.value, metric.unit), tone: 'danger' },
            { id: 'threshold', label: 'Ngưỡng cho phép', value: metricText(metric.threshold, metric.unit) },
          ]}
        />
      </div>

      {/* Trạng thái xử lý */}
      <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h-state`}>
        <h3 id={`${uid}-h-state`} className="text-lg font-semibold text-fg-secondary">
          Trạng thái xử lý
        </h3>
        <StatusOptionGroup
          labelledBy={`${uid}-h-state`}
          label="Trạng thái xử lý"
          options={stateOptions}
          value={v.state}
          onChange={(s) => set('state', s)}
          layout="inline"
          size="sm"
          columns={5}
        />
        {!close.ok && (
          <p id={ids.stateReason} className="text-sm text-warning">
            Chưa chọn được "Đã xử lý": {close.message}
          </p>
        )}
        {(v.state === 'paused' || v.state === 'needs-support') && (
          <div className="grid gap-4 lg:grid-cols-2">
            {v.state === 'needs-support' && (
              <div className="flex flex-col gap-1.5">
                <StaffList
                  compact
                  label="Người / bộ phận hỗ trợ"
                  items={supportStaffItems(a.collaborators)}
                  value={v.supportPeople[0] ?? null}
                  onChange={(id) => set('supportPeople', id ? [id] : [])}
                />
                {err.supportPeople && <p className="text-sm text-danger-text">{err.supportPeople}</p>}
                <p id={ids.supportHint} className="text-sm text-fg-secondary">
                  Người được chọn thêm vào danh sách phối hợp. Thông báo đẩy/SMS chưa gửi được – chờ backend.
                </p>
              </div>
            )}
            <Textarea
              label={v.state === 'paused' ? 'Lý do tạm dừng' : 'Lý do cần hỗ trợ'}
              required
              value={v.holdReason}
              onChange={(t) => set('holdReason', t)}
              rows={3}
              maxLength={500}
              error={err.holdReason}
              placeholder={v.state === 'paused' ? 'Vd: chờ vật tư thay thế, chờ dừng tuyến' : 'Vd: cần thêm người thao tác xả áp thủ công'}
            />
          </div>
        )}
      </section>

      {/* Kết quả kiểm tra thiết bị */}
      <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h-ins`}>
        <h3 id={`${uid}-h-ins`} className="text-lg font-semibold text-fg-secondary">
          Kết quả kiểm tra thiết bị
        </h3>
        <InspectionTable<InspectionStatus>
          caption={`Kết quả kiểm tra thiết bị ${a.code}`}
          statusOptions={STATUS_OPTIONS}
          rows={steps.map((s) => {
            const e = v.inspection[s.id] ?? { status: 'pending' as const, note: '' };
            return {
              id: s.id,
              text: s.text,
              status: e.status,
              by: e.by,
              time: e.at ? plantTimeOfDay(new Date(e.at)).slice(0, 5) : undefined,
              note: e.note,
              error: err.inspection?.[s.id],
            };
          })}
          onStatusChange={(id, status) => setInspection(id, setInspectionStatus(v.inspection[id] ?? { status: 'pending', note: '' }, status, { by: actor, at: appNow() }))}
          onNoteChange={(id, note) => setInspection(id, { ...(v.inspection[id] ?? { status: 'pending' }), note })}
        />
      </section>

      {/* Thông số + xác minh */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h-read`}>
          <h3 id={`${uid}-h-read`} className="text-lg font-semibold text-fg-secondary">
            Thông số trước và sau xử lý
          </h3>
          <BeforeAfterReadings
            label="Thông số trước và sau xử lý"
            rows={readingRows}
            onAfterChange={(id, val) => set('manualAfter', { ...v.manualAfter, [id]: val ?? null })}
            footer={
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span id={`${uid}-src`} className="text-sm text-fg-secondary">
                    Nguồn xác minh
                  </span>
                  <Select variant="field" label="Nguồn xác minh" labelledBy={`${uid}-src`} options={SOURCE_OPTIONS} value={v.source} onChange={(s) => s && set('source', s)} />
                </div>
                <DatePicker type="datetime-local" label="Thời gian ghi nhận" value={v.recordedAt} onChange={(t) => set('recordedAt', t)} />
              </div>
            }
          />
          <p className="text-sm text-fg-secondary">
            "Trước" = số lúc cảnh báo. "Sau" = số trực tiếp{editable ? '; sửa tay theo đồng hồ cơ' : ' (chọn nguồn có "Đồng hồ cơ" để nhập tay)'}.
            {primary.reading.state === 'lost' && ' Áp suất đang mất tín hiệu – nhập số đo bằng đồng hồ cơ.'}
          </p>
        </section>

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-3 text-lg font-semibold text-fg-secondary">Kết quả xác minh (Chọn nhiều)</legend>
          {verItems.map((it) => {
            const on = v.verification.includes(it.id);
            const locked = it.id === normalId && !close.ok && !on;
            return (
              <Checkbox
                key={it.id}
                variant="card"
                label={it.text}
                checked={on}
                onChange={(c) => toggleVerification(it.id, c)}
                aria-disabled={locked || undefined}
                aria-describedby={it.id === normalId ? ids.normalHint : undefined}
              />
            );
          })}
          <p id={ids.normalHint} className="text-sm text-fg-secondary">
            "{verText(normalId ?? '')}" chỉ chọn được khi áp suất hiện tại và sau xử lý đều dưới {metricText(warn, a.unit)}.
          </p>
          {shown.verification && (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-fg">
              {shown.verification}
            </p>
          )}
        </fieldset>
      </div>

      {/* Nguyên nhân + nội dung */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Textarea
          label="Nguyên nhân xử lý"
          labelVariant="section"
          required={resolved}
          value={v.cause}
          onChange={(t) => set('cause', t)}
          rows={3}
          maxLength={1000}
          error={err.cause}
          hint={resolved ? undefined : 'Bắt buộc khi chọn "Đã xử lý".'}
          placeholder="Nhập nguyên nhân gây ra cảnh báo..."
        />
        <Textarea
          label="Nội dung đã xử lý"
          labelVariant="section"
          required={resolved}
          value={v.actionTaken}
          onChange={(t) => set('actionTaken', t)}
          rows={3}
          maxLength={1000}
          error={err.actionTaken}
          hint={resolved ? undefined : 'Bắt buộc khi chọn "Đã xử lý".'}
          placeholder="Mô tả các bước đã thực hiện..."
        />
      </div>

      {/* Ảnh và tài liệu */}
      <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h-files`}>
        <h3 id={`${uid}-h-files`} className="text-lg font-semibold text-fg-secondary">
          Ảnh và tài liệu
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
          {(a.attachments ?? []).map((f) => (
            <AttachmentCard
              key={f.name}
              fluid
              id={f.name}
              name={f.name}
              kind={f.kind}
              notice={f.isTemp ? 'Chưa tải lên máy chủ' : undefined}
              onView={() => setPreview(f.name)}
              onDownload={f.isTemp ? undefined : () => downloadSampleAttachment(f, a.code)}
            />
          ))}
          {files.map((f) => (
            <div key={f.id} className="relative flex min-w-0">
              <AttachmentCard fluid id={f.id} name={f.name} kind={f.kind} meta={formatFileSize(f.size)} notice="Chưa tải lên máy chủ" />
              <button
                type="button"
                aria-label={`Bỏ tệp ${f.name}`}
                onClick={() => {
                  setFiles((cur) => cur.filter((x) => x.id !== f.id));
                  announce(`Đã bỏ tệp ${f.name}.`);
                }}
                className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-sm text-fg-secondary hover:bg-surface-muted hover:text-fg"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
          <UploadTile accept={UPLOAD_ACCEPT} hint={UPLOAD_HINT} onFiles={addFiles} />
        </div>
        {uploadError && (
          <p role="alert" className="text-sm text-danger-text">
            {uploadError}
          </p>
        )}
      </section>

      {/* Vấn đề phát sinh */}
      <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h-issue`}>
        <h3 id={`${uid}-h-issue`} className="text-lg font-semibold text-fg-secondary">
          Vấn đề phát sinh
        </h3>
        <StatusOptionGroup
          labelledBy={`${uid}-h-issue`}
          label="Vấn đề phát sinh"
          options={cfg.issues.map((i) => ({ id: i.id, label: i.label }))}
          value={v.issue.kind}
          onChange={(k) => set('issue', { ...v.issue, kind: k })}
          layout="inline"
          size="sm"
          columns={2}
        />
        {cfg.issues.find((i) => i.id === v.issue.kind)?.needsNote && (
          <TextField label="Mô tả vấn đề" required value={v.issue.note} onChange={(t) => set('issue', { ...v.issue, note: t })} maxLength={300} error={err.issueNote} />
        )}
        {suggestsSupport(v, cfg) && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-info/40 bg-info/10 px-3 py-2 text-sm text-fg">
            <span className="min-w-0 flex-1">Cần thêm nhân sự – nên chuyển trạng thái xử lý sang "Cần hỗ trợ" để chọn người hỗ trợ.</span>
            <Button size="sm" variant="subtle" onClick={() => set('state', 'needs-support')}>
              Chuyển sang Cần hỗ trợ
            </Button>
          </div>
        )}
      </section>

      {/* Theo dõi sau xử lý */}
      <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h-follow`}>
        <h3 id={`${uid}-h-follow`} className="text-lg font-semibold text-fg-secondary">
          Theo dõi sau xử lý
        </h3>
        <StatusOptionGroup
          labelledBy={`${uid}-h-follow`}
          label="Theo dõi sau xử lý"
          options={followOptions}
          value={String(v.followUp.choice)}
          onChange={(c) => set('followUp', { ...v.followUp, choice: (c === 'custom' ? 'custom' : Number(c)) as FollowUpChoice })}
          layout="inline"
          size="sm"
          columns="auto"
          describedBy={!resolved ? ids.followHint : undefined}
        />
        {!resolved && (
          <p id={ids.followHint} className="text-sm text-fg-secondary">
            Áp dụng khi chọn "Đã xử lý" – sau khi đóng, cảnh báo hiện "Đang theo dõi đến …".
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField
            label="Giá trị mục tiêu"
            prefix="<"
            unit={a.unit}
            value={v.followUp.target}
            onChange={(n) => set('followUp', { ...v.followUp, target: n })}
            onClear={() => set('followUp', { ...v.followUp, target: undefined })}
            min={0}
            step={0.1}
            precision={2}
            disabled={!followActive}
          />
          {v.followUp.choice === 'custom' ? (
            <DatePicker type="datetime-local" label="Thời điểm kiểm tra lại" value={v.customAtLocal} onChange={(t) => set('customAtLocal', t)} disabled={!followActive} />
          ) : (
            <TextField
              label="Thời điểm kiểm tra lại"
              value={followActive && preview_ ? plantTimeOfDay(preview_.until).slice(0, 5) : '–'}
              onChange={() => {}}
              readOnly
              hint={followActive ? 'Tự tính = lúc lưu + thời gian theo dõi.' : undefined}
            />
          )}
          <div className="flex flex-col gap-1.5">
            <span id={`${uid}-owner`} className="text-sm text-fg-secondary">
              Người chịu trách nhiệm
            </span>
            <Select
              variant="field"
              label="Người chịu trách nhiệm"
              labelledBy={`${uid}-owner`}
              options={OWNER_OPTIONS}
              value={v.followUp.owner || null}
              onChange={(o) => set('followUp', { ...v.followUp, owner: o ?? '' })}
              placeholder="Chọn người"
              disabled={!followActive}
              side="top"
            />
          </div>
        </div>
        <p className="text-sm text-fg-secondary">Tự tạo lại cảnh báo khi vượt mục tiêu trong thời gian theo dõi: chờ backend.</p>
      </section>

      <AssignNotices
        warnings={warnings.map((w, i) => ({ id: `w${i}`, label: w }))}
        warningSuffix="vẫn lưu được"
        issues={blocked ? issues : []}
        blockId={ids.block}
        blockTitle="Chưa lưu được – còn thiếu:"
      />

      {sample && (
        <Modal open onClose={() => setPreview(null)} size="md" title={sample.name} description="Dữ liệu mẫu – chưa có tệp thật (chờ backend lưu trữ).">
          <p className="text-base text-fg-secondary">Tệp mẫu đi kèm cảnh báo {a.code}. Xem/tải tệp thật khi có API lưu trữ.</p>
        </Modal>
      )}
    </Modal>
  );
}
