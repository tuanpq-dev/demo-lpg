import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AssignNotices, Badge, Button, Checkbox, Combobox, FormField, Modal, SearchInput, StaffFilters, StaffList, Textarea, type StaffPickerItem } from '@/components';
import { ALERT_STAFF, alertKind, clearAlertAssignDraft, loadAlertAssignDraft, saveAlertAssignDraft } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import {
  alertAssignChange,
  initialAlertAssignForm,
  planBulkAlertAssign,
  validateAlertAssign,
  validateBulkAlertAssign,
  type AlertAssignForm,
} from '@/features/alerts/assign';
import { ALERT_LOAD_HINT, MATCH_LABEL, alertAssignWarnings, alertLoadLabel, computeAlertLoads, rankAlertStaff } from '@/features/alerts/assignStaff';
import { shiftShortLabel } from '@/features/staff/availability';
import { announce } from '@/lib/announce';
import { useNow } from '@/lib/useNow';
import { DEPARTMENTS, SHIFTS, staffByName, type ShiftId } from '@/mocks/maintenance';
import type { StaffSkill } from '@/mocks/skills';
import { AlertAssignSummary } from './AlertAssignSummary';

export type AlertAssignModalProps = {
  /** Một cảnh báo (drawer) hoặc nhiều (hàng loạt ở bảng). */
  alerts: readonly AlertRecord[];
  /** Toàn bộ cảnh báo – tính "x cảnh báo đang xử lý" / Bận / cảnh báo nghiêm trọng khác. */
  allAlerts: readonly AlertRecord[];
  onClose: () => void;
  /** Ghi – modal đã kiểm tra hợp lệ trước khi gọi. */
  onConfirm: (form: AlertAssignForm) => Promise<void> | void;
  /** Giờ hiện tại (test/playground); thiếu → đồng hồ app (`useNow`). */
  now?: Date;
};

/**
 * Modal "Phân công xử lý cảnh báo" – ảnh `scratch/figma-ref/alert-assign-modal-design.png` (chưa có node; lệch: CLAUDE.md
 * mục 8). Dùng chung lõi với modal phân công bảo trì: `StaffList`/`StaffPickerCard`, nhãn Sẵn sàng/Bận/Ngoài ca
 * (`features/staff/availability`), `AssignNotices`, nháp `lib/sessionDraft`. Quy tắc: `features/alerts/assign.ts` + `assignStaff.ts`.
 * - Một cảnh báo: chưa có người → phân công; có người → "Đổi người xử lý" (chọn sẵn người hiện tại; đổi sang người khác cần lý
 *   do; giữ người, sửa phối hợp/ghi chú → "Cập nhật phân công"). Có Nháp (sessionStorage theo mã).
 * - Hàng loạt: bỏ qua dòng Hoàn thành / đã đúng người; dòng của người khác = đổi người, MỘT lý do chung, liệt kê mã trước khi
 *   xác nhận. Không có Nháp.
 * KHÔNG tự xác nhận cảnh báo. Ô "Gửi thông báo khẩn cấp ngay": chỉ giao diện (TODO backend). Chỉ mount khi mở.
 */
export function AlertAssignModal({ alerts, allAlerts, onClose, onConfirm, now: nowProp }: AlertAssignModalProps) {
  const clock = useNow(60_000);
  const now = nowProp ?? clock;
  const uid = useId();
  const blockId = `${uid}-block`;
  const listLabelId = `${uid}-list`;
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const bulk = alerts.length !== 1;
  const single = bulk ? null : alerts[0]!;

  const [initial] = useState(() => {
    const base = initialAlertAssignForm(alerts);
    const draft = single ? loadAlertAssignDraft(single.id) : null;
    return { base, draft, form: draft ? { ...draft, notify: base.notify } : base };
  });
  const [f, setF] = useState<AlertAssignForm>(initial.form);
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState<string | null>(null);
  const [shiftFilter, setShiftFilter] = useState<ShiftId | null>(null);
  const [onShiftOnly, setOnShiftOnly] = useState(false);
  const [hasDraft, setHasDraft] = useState(!!initial.draft);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (confirming) keepEditingRef.current?.focus();
  }, [confirming]);

  const set = <K extends keyof AlertAssignForm>(k: K, v: AlertAssignForm[K]) => {
    setF((cur) => ({ ...cur, [k]: v }));
    setError('');
  };
  const chooseAssignee = (name: string | null) => {
    setF((cur) => ({ ...cur, assignee: name, collaborators: cur.collaborators.filter((c) => c !== name) }));
    setError('');
  };

  const loads = useMemo(() => computeAlertLoads(allAlerts), [allAlerts]);
  const context = useMemo(
    () => ({
      areas: [...new Set(alerts.map((a) => a.area))],
      skills: [...new Set(alerts.flatMap((a) => alertKind(a).skills ?? []))] as StaffSkill[],
    }),
    [alerts],
  );
  const ranked = useMemo(() => rankAlertStaff(ALERT_STAFF, context, loads, now), [context, loads, now]);

  const ids = alerts.map((a) => a.id);
  const plan = bulk ? planBulkAlertAssign(alerts, ids, f.assignee) : null;
  const issues = plan ? validateBulkAlertAssign(plan, f) : validateAlertAssign(single!, f);
  const blocked = issues.length > 0;
  const change = single ? alertAssignChange(single, f) : null;
  const needReason = plan ? plan.reassign.length > 0 && !!f.assignee : change === 'reassign';
  // Cảnh báo chỉ khi CHỌN người mới (giữ nguyên người hiện tại → không nhắc lại tải việc của chính họ).
  const warnings =
    f.assignee && (bulk || f.assignee !== single!.assignee)
      ? alertAssignWarnings(f, { staff: staffByName(f.assignee), loads, now, alertIds: ids })
      : [];
  const dirty = JSON.stringify(f) !== JSON.stringify(initial.base);
  const reassignMode = !!single?.assignee;

  const q = query.trim().toLowerCase();
  const items: StaffPickerItem[] = ranked
    .filter(
      ({ staff: p, onShift }) =>
        (!dept || p.department === dept) &&
        (!shiftFilter || p.defaultShift === shiftFilter) &&
        (!onShiftOnly || onShift) &&
        (!q || [p.name, p.title, p.specialty, p.department].some((t) => t.toLowerCase().includes(q))),
    )
    .map(({ staff: p, load, onShift, availability, match }) => ({
      id: p.name,
      name: p.name,
      subtitle: `${p.title} • ${p.specialty}`,
      shiftLabel: shiftShortLabel(p.defaultShift),
      shiftMatch: onShift,
      busy: load.busy,
      active: load.active,
      overdue: load.critical,
      loadLabel: alertLoadLabel(load),
      workloadHint: ALERT_LOAD_HINT,
      availability,
      suggestion: match.length ? match.map((m) => MATCH_LABEL[m]).join(' · ') : undefined,
    }));
  const collabOptions = ALERT_STAFF.filter((p) => p.name !== f.assignee).map((p) => ({ value: p.name, label: p.name, meta: `${p.title} · ${p.department}` }));

  const submit = async () => {
    if (blocked || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(f);
      if (single) clearAlertAssignDraft(single.id);
    } finally {
      setSubmitting(false);
    }
  };

  const onSaveDraft = () => {
    if (!single) return;
    const { notify: _notify, ...rest } = f;
    if (!saveAlertAssignDraft(single.id, { ...rest, collaborators: [...rest.collaborators], savedAt: new Date().toISOString() })) {
      setError('Không lưu được nháp (bộ nhớ trình duyệt không khả dụng).');
      return;
    }
    setHasDraft(true);
    announce(`Đã lưu nháp phân công ${single.code} – cảnh báo chưa thay đổi.`);
    onClose();
  };

  const requestClose = () => {
    if (confirming) return setConfirming(false);
    if (dirty || hasDraft) setConfirming(true);
    else onClose();
  };
  const discard = () => {
    if (single) clearAlertAssignDraft(single.id);
    onClose();
  };

  const confirmLabel = change === 'reassign' ? 'Xác nhận đổi người' : change === 'update' ? 'Cập nhật phân công' : 'Xác nhận phân công';
  const reasonHint = plan
    ? 'Một lý do chung cho mọi cảnh báo đổi người – ghi vào lịch sử từng cảnh báo.'
    : `Người hiện tại: ${single?.assignee ?? '—'}. Trạng thái cảnh báo giữ nguyên.`;

  return (
    <Modal
      open
      size="xl"
      title={reassignMode ? 'Đổi người xử lý' : 'Phân công xử lý cảnh báo'}
      description={reassignMode ? 'Chọn người xử lý mới – lý do đổi được ghi vào lịch sử cảnh báo' : 'Chọn người chịu trách nhiệm xác minh và theo dõi cảnh báo'}
      onClose={requestClose}
      dismissOnBackdrop={false}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming) void submit();
      }}
      footerStart={
        confirming ? (
          <p role="alert" className="text-base text-fg">
            {hasDraft ? 'Bỏ các thay đổi và xóa nháp?' : 'Bỏ các thay đổi chưa lưu?'}
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
              {hasDraft ? 'Bỏ thay đổi và xóa nháp' : 'Bỏ thay đổi'}
            </Button>
          </>
        ) : (
          <>
            {single && (
              <Button variant="subtle" onClick={onSaveDraft}>
                Nháp
              </Button>
            )}
            <Button type="submit" variant="primary" aria-disabled={blocked || submitting || undefined} aria-describedby={blocked ? blockId : undefined}>
              {confirmLabel}
            </Button>
          </>
        )
      }
    >
      <AlertAssignSummary alerts={alerts} now={now} />

      {initial.draft && (
        <p className="flex items-center gap-2 text-sm text-fg-secondary">
          <Badge variant="tag">Nháp</Badge>
          Đang mở bản nháp đã lưu.
        </p>
      )}

      <div className="grid min-h-0 gap-6 md:grid-cols-[3fr_2fr]">
        {/* Trái: tìm + lọc + danh sách nhân sự (radiogroup) */}
        <section aria-labelledby={listLabelId} className="flex min-w-0 flex-col gap-3">
          <h3 id={listLabelId} className="text-lg font-semibold text-fg">
            Chọn nhân sự
          </h3>
          <StaffFilters
            search={<SearchInput value={query} onChange={setQuery} placeholder="Tìm kiếm theo tên..." label="Tìm kiếm nhân sự theo tên" />}
            departments={DEPARTMENTS.filter((d) => ALERT_STAFF.some((p) => p.department === d)).map((d) => ({ value: d, label: d }))}
            department={dept}
            onDepartmentChange={setDept}
            shifts={SHIFTS.map((s) => ({ value: s.value, label: shiftShortLabel(s.value) }))}
            shift={shiftFilter}
            onShiftChange={setShiftFilter}
            onShiftOnly={onShiftOnly}
            onShiftOnlyChange={setOnShiftOnly}
          />
          <p className="text-sm text-fg-secondary">Người cùng khu hoặc đúng chuyên môn xếp trước, rồi Sẵn sàng → Bận → Ngoài ca. Người ngoài ca vẫn chọn được.</p>
          <StaffList
            label="Chọn nhân sự"
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
                    setOnShiftOnly(false);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </span>
            }
          />
        </section>

        {/* Phải: chi tiết phân công */}
        <section aria-labelledby={`${uid}-detail`} className="flex min-w-0 flex-col gap-4 self-start rounded-lg border border-line/30 bg-surface-raised/40 p-5">
          <h3 id={`${uid}-detail`} className="text-lg font-semibold text-fg">
            Chi tiết phân công
          </h3>
          {plan && f.assignee && (plan.reassign.length > 0 || plan.skippedDone.length + plan.skippedSame.length > 0) && (
            <div className="flex flex-col gap-2 text-sm">
              {plan.reassign.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-fg">
                  <p className="font-semibold">Sẽ đổi người ({plan.reassign.length}):</p>
                  <ul aria-label="Cảnh báo sẽ đổi người" className="mt-1 flex flex-col gap-0.5">
                    {plan.reassign.map((a) => (
                      <li key={a.id}>
                        {a.code}: {a.assignee} → {f.assignee}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.skippedDone.length + plan.skippedSame.length > 0 && (
                <p className="text-fg-secondary">
                  Bỏ qua {plan.skippedDone.length + plan.skippedSame.length}:{' '}
                  {[
                    plan.skippedDone.length && `${plan.skippedDone.map((a) => a.code).join(', ')} (đã hoàn thành)`,
                    plan.skippedSame.length && `${plan.skippedSame.map((a) => a.code).join(', ')} (đã giao ${f.assignee})`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
          )}
          {needReason && (
            <Textarea
              label={plan ? 'Lý do đổi người (chung)' : 'Lý do đổi người xử lý'}
              required
              value={f.reason}
              onChange={(v) => set('reason', v)}
              rows={2}
              maxLength={500}
              placeholder="Vì sao cần đổi người xử lý…"
              hint={reasonHint}
            />
          )}
          <FormField label="Người phối hợp (Tùy chọn)">
            {({ id, labelId, describedBy }) => (
              <Combobox
                multiple
                id={id}
                labelledBy={labelId}
                describedBy={describedBy}
                showAvatar
                options={collabOptions}
                value={f.collaborators.filter((c) => c !== f.assignee)}
                onChange={(v) => set('collaborators', v)}
                placeholder="Thêm người phối hợp..."
              />
            )}
          </FormField>
          <Textarea
            label="Ghi chú chỉ đạo"
            value={f.note}
            onChange={(v) => set('note', v)}
            rows={3}
            maxLength={500}
            placeholder="Nhập ghi chú cho người xử lý..."
            hint={bulk ? 'Ghi vào ghi chú xử lý của từng cảnh báo với nhãn "Chỉ đạo".' : 'Ghi vào ghi chú xử lý với nhãn "Chỉ đạo".'}
          />
          <div className="flex flex-col gap-1">
            <Checkbox showLabel label="Gửi thông báo khẩn cấp ngay" checked={f.notify} onChange={(v) => set('notify', v)} />
            <p className="pl-6 text-sm text-fg-secondary">Chưa gửi được – chờ backend (bản demo không gửi thông báo).</p>
          </div>

          <AssignNotices
            warnings={warnings}
            issues={issues}
            blockId={blockId}
            blockTitle={`Chưa thể ${change === 'reassign' ? 'đổi người' : 'phân công'} – còn thiếu:`}
          />
          {error && (
            <p role="alert" className="text-sm text-danger-text">
              {error}
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}
