import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AssignNotices,
  Badge,
  Button,
  Combobox,
  DatePicker,
  DeviceArmIcon,
  FormField,
  MapIcon,
  Modal,
  SearchInput,
  Select,
  StaffList,
  Switch,
  Textarea,
  type StaffPickerItem,
} from '@/components';
import { ASSIGNABLE_STAFF, DEPARTMENTS, SHIFTS, STATUS_LABEL, staffByName, type MaintenanceRecord, type ShiftId } from '@/data/maintenance';
import { clearAssignDraft, loadAssignDraft, saveAssignDraft } from '@/data/maintenanceDetail';
import {
  WORKLOAD_HINT,
  assignMode,
  assignWarnings,
  computeWorkloads,
  initialAssignForm,
  shiftShortLabel,
  validateAssign,
  workloadOf,
  type AssignForm,
} from '@/features/maintenance/assign';
import { announce } from '@/lib/announce';
import { useNow } from '@/lib/useNow';

const SHIFT_SHORT = Object.fromEntries(SHIFTS.map((s) => [s.value, s.label.split(' (')[0]])) as Record<ShiftId, string>;
const DEPT_SHORT: Record<string, string> = {
  'Bảo trì Cơ khí': 'Cơ khí',
  'Bảo trì Điện': 'Điện',
  'Đo lường – Tự động hóa': 'Đo lường',
  'An toàn – HSE': 'HSE',
  'Vận hành': 'Vận hành',
};

export type AssignModalProps = {
  record: MaintenanceRecord;
  /** Toàn bộ yêu cầu – tính "đang làm / quá hạn / Bận" của từng người. */
  records: readonly MaintenanceRecord[];
  onClose: () => void;
  /** Ghi bản ghi – modal đã kiểm tra hợp lệ trước khi gọi. */
  onSubmit: (form: AssignForm) => Promise<void>;
};

/**
 * Modal "Phân công người xử lý" – ảnh thiết kế (chưa có node; lệch ghi docs/figma-diffs.md). Hai chế độ theo trạng thái:
 * phân công (Chờ tiếp nhận) · đổi người (Đã phân công / Đang thực hiện – lý do bắt buộc). Quy tắc: `features/maintenance/assign.ts`.
 * Trái: tìm + lọc phòng ban/ca + danh sách nhân sự (radiogroup, KHÔNG chọn sẵn). Phải: chi tiết phân công.
 * Chặn: nút xác nhận aria-disabled + danh sách lý do; cảnh báo không chặn đọc qua aria-live. Nháp: sessionStorage. Chỉ mount khi mở.
 */
export function AssignModal({ record: r, records, onClose, onSubmit }: AssignModalProps) {
  const now = useNow(60_000);
  const uid = useId();
  const mode = assignMode(r.status);
  const reassign = mode === 'reassign';
  const blockId = `${uid}-block`;
  const listLabelId = `${uid}-list`;
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  const [initial] = useState(() => {
    const base = initialAssignForm(r);
    const draft = loadAssignDraft(r.id);
    return { base, draft, form: draft ? { ...draft, notify: base.notify } : base };
  });
  const [f, setF] = useState<AssignForm>(initial.form);
  const [shiftTouched, setShiftTouched] = useState(!!initial.draft || !!r.shift);
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState<string | null>(null);
  const [shiftFilter, setShiftFilter] = useState<ShiftId | null>(null);
  const [hasDraft, setHasDraft] = useState(!!initial.draft);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (confirming) keepEditingRef.current?.focus();
  }, [confirming]);

  const set = <K extends keyof AssignForm>(k: K, v: AssignForm[K]) => {
    setF((cur) => ({ ...cur, [k]: v }));
    setError('');
  };

  /** Chọn người chính: bỏ khỏi người phối hợp; chưa sửa ca → điền ca mặc định của người đó. */
  const chooseAssignee = (name: string | null) => {
    setF((cur) => {
      const staff = staffByName(name);
      return {
        ...cur,
        assignee: name,
        collaborators: cur.collaborators.filter((c) => c !== name),
        shift: !shiftTouched && staff ? staff.defaultShift : cur.shift,
      };
    });
    setError('');
  };

  const workloads = useMemo(() => computeWorkloads(records, now), [records, now]);
  const issues = validateAssign(r, f);
  const warnings = assignWarnings(f, workloads, now);
  const blocked = issues.length > 0;
  const dirty = JSON.stringify({ ...f, notify: true }) !== JSON.stringify({ ...initial.base, notify: true });

  // Người đang được giao nhưng không còn trong danh sách chọn (vd trưởng ca) → vẫn hiện đúng tên trong ô chọn.
  const extra = [r.assignee, ...(r.collaborators ?? [])].filter((n): n is string => !!n && !ASSIGNABLE_STAFF.some((p) => p.name === n));
  const comboOptions = [
    ...ASSIGNABLE_STAFF.map((p) => ({ value: p.name, label: p.name, meta: `${p.title} · ${p.department}` })),
    ...extra.map((n) => ({ value: n, label: n, meta: `${staffByName(n)?.title ?? 'Không có trong danh mục'} · không còn chọn được để phân công` })),
  ];

  const q = query.trim().toLowerCase();
  const items: StaffPickerItem[] = ASSIGNABLE_STAFF.filter(
    (p) =>
      (!dept || p.department === dept) &&
      (!shiftFilter || p.defaultShift === shiftFilter) &&
      (!q || [p.name, p.specialty, p.department, p.title].some((t) => t.toLowerCase().includes(q))),
  ).map((p) => {
    const w = workloadOf(workloads, p.name);
    return {
      id: p.name,
      name: p.name,
      subtitle: `${DEPT_SHORT[p.department] ?? p.department} • ${p.specialty}`,
      shiftLabel: SHIFT_SHORT[p.defaultShift],
      shiftMatch: !!f.shift && p.defaultShift === f.shift,
      busy: w.busy,
      active: w.active,
      overdue: w.overdue,
      workloadHint: WORKLOAD_HINT,
    };
  });

  const submit = async () => {
    if (blocked || submitting) return; // nút aria-disabled đã chặn; chặn thêm cho chắc
    setSubmitting(true);
    try {
      await onSubmit(f);
      clearAssignDraft(r.id);
    } finally {
      setSubmitting(false);
    }
  };

  const onSaveDraft = () => {
    const draft = { assignee: f.assignee, collaborators: [...f.collaborators], startAt: f.startAt, dueAt: f.dueAt, shift: f.shift, note: f.note, reason: f.reason };
    if (!saveAssignDraft(r.id, { ...draft, savedAt: new Date().toISOString() })) {
      setError('Không lưu được nháp (bộ nhớ trình duyệt không khả dụng).');
      return;
    }
    setHasDraft(true);
    announce(`Đã lưu tạm phân công ${r.code} – trạng thái yêu cầu không đổi.`);
    onClose();
  };

  const requestClose = () => {
    if (confirming) return setConfirming(false);
    if (dirty || hasDraft) setConfirming(true);
    else onClose();
  };

  const discard = () => {
    clearAssignDraft(r.id);
    onClose();
  };

  const confirmLabel = reassign ? 'Xác nhận đổi người' : 'Xác nhận phân công';

  return (
    <Modal
      open
      size="xl"
      title={reassign ? 'Đổi người xử lý' : 'Phân công người xử lý'}
      description={reassign ? 'Chọn người xử lý mới – lý do đổi được ghi vào lịch sử xử lý' : 'Chọn nhân sự phù hợp để tiếp nhận và xử lý yêu cầu bảo trì'}
      onClose={requestClose}
      dismissOnBackdrop={false}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming) void submit();
      }}
      footerStart={
        confirming ? (
          <p role="alert" className="text-base text-fg">
            {hasDraft ? 'Bỏ các thay đổi và xóa bản lưu tạm?' : 'Bỏ các thay đổi chưa lưu?'}
          </p>
        ) : (
          <Button variant="plain" onClick={requestClose}>
            Hủy
          </Button>
        )
      }
      footer={
        confirming ? (
          <>
            <Button ref={keepEditingRef} variant="subtle" onClick={() => setConfirming(false)}>
              Tiếp tục sửa
            </Button>
            <Button variant="primary" onClick={discard}>
              {hasDraft ? 'Bỏ thay đổi và xóa bản lưu tạm' : 'Bỏ thay đổi'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onSaveDraft}>
              Lưu tạm
            </Button>
            <Button type="submit" variant="primary" aria-disabled={blocked || submitting || undefined} aria-describedby={blocked ? blockId : undefined}>
              {confirmLabel}
            </Button>
          </>
        )
      }
    >
      {/* Dải thông tin yêu cầu (trải hết bề ngang thân modal) */}
      <section aria-label={`Yêu cầu ${r.code}`} className="-mx-5 -mt-4 flex flex-wrap items-start justify-between gap-3 border-b border-line/30 bg-surface-raised/50 px-5 py-3">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="flex flex-wrap items-center gap-3">
            <Badge variant="tag" size="md">
              {r.code}
            </Badge>
            <span className="text-lg font-semibold text-fg">{r.title}</span>
          </p>
          <p className="flex flex-wrap items-center gap-4 text-sm text-fg-secondary">
            <span className="inline-flex items-center gap-1">
              <DeviceArmIcon size={14} />
              <span className="sr-only">Thiết bị: </span>
              {r.device}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapIcon size={14} />
              <span className="sr-only">Khu vực: </span>
              {r.area}
            </span>
            <Badge variant="severity" value={r.priority} withIcon={r.priority === 'critical'} size="md" />
          </p>
        </div>
        <p className="text-sm text-fg-secondary">
          Trạng thái: <span className="font-semibold text-warning">{STATUS_LABEL[r.status]}</span>
        </p>
      </section>

      {initial.draft && (
        <p className="flex items-center gap-2 text-sm text-fg-secondary">
          <Badge variant="tag">Bản lưu tạm</Badge>
          Đang mở bản lưu tạm.
        </p>
      )}

      <div className="-mx-5 -mb-4 grid min-h-0 flex-1 md:grid-cols-[2fr_3fr]">
        {/* Trái: tìm + lọc + danh sách nhân sự */}
        <div className="flex min-w-0 flex-col gap-3 border-line/30 px-5 py-4 md:border-r">
          <h3 id={listLabelId} className="sr-only">
            Danh sách nhân sự
          </h3>
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm kiếm nhân sự..." label="Tìm kiếm nhân sự" />
          <div className="grid grid-cols-[3fr_2fr] gap-3">
            <span id={`${uid}-dept`} className="sr-only">
              Lọc phòng ban
            </span>
            <span id={`${uid}-shift`} className="sr-only">
              Lọc ca
            </span>
            <Select variant="field" labelledBy={`${uid}-dept`} label="Lọc phòng ban" placeholder="Tất cả phòng ban" allLabel="Tất cả phòng ban" options={DEPARTMENTS.filter((d) => ASSIGNABLE_STAFF.some((p) => p.department === d)).map((d) => ({ value: d, label: d }))} value={dept} onChange={setDept} />
            <Select variant="field" labelledBy={`${uid}-shift`} label="Lọc ca" placeholder="Tất cả ca" allLabel="Tất cả ca" options={SHIFTS.map((s) => ({ value: s.value, label: SHIFT_SHORT[s.value] }))} value={shiftFilter} onChange={setShiftFilter} />
          </div>
          <StaffList
            label="Danh sách nhân sự"
            labelledBy={listLabelId}
            items={items}
            value={f.assignee}
            onChange={chooseAssignee}
            emptyState={
              <span className="flex flex-col items-center gap-2">
                Không có nhân sự phù hợp với bộ lọc.
                <Button
                  variant="link"
                  onClick={() => {
                    setQuery('');
                    setDept(null);
                    setShiftFilter(null);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </span>
            }
          />
        </div>

        {/* Phải: chi tiết phân công */}
        <div className="flex min-w-0 flex-col gap-4 px-5 py-4">
          <h3 className="border-b border-line/30 pb-3 text-lg font-semibold text-fg">Chi tiết phân công</h3>
          {reassign && (
            <Textarea
              label="Lý do đổi người xử lý"
              required
              value={f.reason}
              onChange={(v) => set('reason', v)}
              rows={2}
              maxLength={500}
              placeholder="Vì sao cần đổi người xử lý…"
              hint={`Người hiện tại: ${r.assignee ?? '—'}. Tiến độ, cờ tạm dừng/sự cố và trạng thái giữ nguyên.`}
            />
          )}
          <FormField label="Người xử lý chính" required>
            {({ id, labelId, describedBy }) => (
              <Combobox
                id={id}
                labelledBy={labelId}
                describedBy={describedBy}
                showAvatar
                options={comboOptions}
                value={f.assignee}
                onChange={chooseAssignee}
                placeholder="Chọn ở danh sách bên trái hoặc gõ tên…"
              />
            )}
          </FormField>
          <FormField label="Người phối hợp">
            {({ id, labelId, describedBy }) => (
              <Combobox
                multiple
                id={id}
                labelledBy={labelId}
                describedBy={describedBy}
                showAvatar
                options={comboOptions.filter((o) => o.value !== f.assignee)}
                value={f.collaborators}
                onChange={(v) => set('collaborators', v)}
                placeholder="Chọn người phối hợp..."
              />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <DatePicker type="datetime-local" label="Bắt đầu dự kiến" value={f.startAt} onChange={(v) => set('startAt', v)} />
            <DatePicker type="datetime-local" label="Hạn chót (Deadline)" required value={f.dueAt} onChange={(v) => set('dueAt', v)} />
          </div>
          <FormField label="Ca làm việc">
            {({ id, labelId, describedBy }) => (
              <Select
                variant="field"
                id={id}
                labelledBy={labelId}
                describedBy={describedBy}
                label="Ca làm việc"
                placeholder="Chọn ca"
                options={SHIFTS}
                value={f.shift}
                onChange={(v) => {
                  setShiftTouched(true);
                  set('shift', v);
                }}
              />
            )}
          </FormField>
          <Textarea label="Ghi chú phân công" value={f.note} onChange={(v) => set('note', v)} rows={2} maxLength={500} placeholder="Lưu ý cho người xử lý…" hint='Ghi vào ghi chú kỹ thuật với nhãn "Phân công".' />
          <div className="border-t border-line/30 pt-4">
            <Switch
              label="Gửi thông báo đẩy và SMS cho người được phân công"
              description="Chưa gửi được – chờ backend (bản demo không gửi thông báo)."
              checked={f.notify}
              onChange={(v) => set('notify', v)}
            />
          </div>

          {/* Cảnh báo không chặn + lý do chặn (khối dùng chung với modal phân công cảnh báo). */}
          <AssignNotices
            warnings={warnings.map((w) => ({
              id: w.id,
              label: w.label,
              action: w.suggestShift && (
                <Button
                  variant="link"
                  onClick={() => {
                    setShiftTouched(true);
                    set('shift', w.suggestShift!);
                    announce(`Đã đổi ca làm việc sang ${shiftShortLabel(w.suggestShift!)}.`);
                  }}
                >
                  Đổi sang {shiftShortLabel(w.suggestShift)}
                </Button>
              ),
            }))}
            issues={issues}
            blockId={blockId}
            blockTitle={`Chưa thể ${reassign ? 'đổi người' : 'phân công'} – còn thiếu:`}
          />
          {error && (
            <p role="alert" className="text-sm text-danger-text">
              {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
