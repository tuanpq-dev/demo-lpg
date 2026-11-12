import { useId, useState } from 'react';
import { AssignNotices, Badge, Button, Checkbox, Combobox, FormField, Modal, Textarea } from '@/components';
import { ALERT_STAFF, clearAlertAssignDraft, loadAlertAssignDraft, saveAlertAssignDraft } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import {
  alertAssignChange,
  initialAlertAssignForm,
  planBulkAlertAssign,
  validateAlertAssign,
  validateBulkAlertAssign,
  type AlertAssignForm,
} from '@/features/alerts/assign';
import { alertAssignWarnings } from '@/features/alerts/assignStaff';
import { announce } from '@/lib/announce';
import { useNow } from '@/lib/useNow';
import { useFormModal } from '@/lib/useFormModal';
import { staffByName } from '@/data/staff';
import { AlertAssignSummary } from './AlertAssignSummary';
import { AssignFooter, BulkAssignPlan, StaffSection } from './assign/AssignParts';
import { useAlertStaffPicker } from './assign/useAlertStaffPicker';

export type AlertAssignModalProps = {
  /** Một cảnh báo (drawer) hoặc nhiều (hàng loạt ở bảng). */
  alerts: readonly AlertRecord[];
  onClose: () => void;
  /** Ghi – modal đã kiểm tra hợp lệ trước khi gọi. */
  onConfirm: (form: AlertAssignForm) => Promise<void> | void;
};

const CONFIRM_LABEL = { reassign: 'Xác nhận đổi người', update: 'Cập nhật phân công', assign: 'Xác nhận phân công' } as const;

/**
 * Trạng thái suy từ form: kế hoạch hàng loạt (dòng bỏ qua / đổi người), lý do chặn, cần lý do đổi người, cảnh báo tải việc,
 * nhãn nút xác nhận. Cảnh báo tải việc chỉ khi CHỌN người mới (giữ người hiện tại → không nhắc lại tải việc của chính họ).
 */
function assignView(alerts: readonly AlertRecord[], f: AlertAssignForm, loads: Parameters<typeof alertAssignWarnings>[1]['loads'], now: Date) {
  const single = alerts.length === 1 ? alerts[0]! : null;
  const ids = alerts.map((a) => a.id);
  const plan = single ? null : planBulkAlertAssign(alerts, ids, f.assignee);
  const issues = plan ? validateBulkAlertAssign(plan, f) : validateAlertAssign(single!, f);
  const change = single ? alertAssignChange(single, f) : null;
  const pickedNew = !!f.assignee && (!single || f.assignee !== single.assignee);
  return {
    plan,
    issues,
    blocked: issues.length > 0,
    needReason: plan ? plan.reassign.length > 0 && !!f.assignee : change === 'reassign',
    warnings: pickedNew ? alertAssignWarnings(f, { staff: staffByName(f.assignee), loads, now, alertIds: ids }) : [],
    reassignMode: !!single?.assignee,
    confirmLabel: CONFIRM_LABEL[change === 'reassign' || change === 'update' ? change : 'assign'],
    blockVerb: change === 'reassign' ? 'đổi người' : 'phân công',
    reasonHint: plan
      ? 'Một lý do chung cho mọi cảnh báo đổi người – ghi vào lịch sử từng cảnh báo.'
      : `Người hiện tại: ${single?.assignee ?? '—'}. Trạng thái cảnh báo giữ nguyên.`,
  };
}

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
export function AlertAssignModal({ alerts, onClose, onConfirm }: AlertAssignModalProps) {
  const now = useNow(60_000);
  const uid = useId();
  const blockId = `${uid}-block`;
  const listLabelId = `${uid}-list`;
  const bulk = alerts.length !== 1;
  const single = bulk ? null : alerts[0]!;

  const [initial] = useState(() => {
    const base = initialAlertAssignForm(alerts);
    const draft = single ? loadAlertAssignDraft(single.id) : null;
    return { base, draft, form: draft ? { ...draft, notify: base.notify } : base };
  });
  const [f, setF] = useState<AlertAssignForm>(initial.form);
  const [error, setError] = useState('');
  const modal = useFormModal({
    initial: initial.base,
    values: f,
    // Nháp chỉ khi phân công MỘT cảnh báo (hàng loạt không có nháp). Công tắc thông báo không lưu vào nháp.
    draft: single
      ? {
          exists: !!initial.draft,
          save: ({ notify: _notify, ...rest }) =>
            saveAlertAssignDraft(single.id, { ...rest, collaborators: [...rest.collaborators], savedAt: new Date().toISOString() }),
          clear: () => clearAlertAssignDraft(single.id),
        }
      : undefined,
    onSubmit: onConfirm,
    onClose,
    onSubmitError: setError,
  });
  const { confirming, submitting, hasDraft, requestClose, discard } = modal;

  const set = <K extends keyof AlertAssignForm>(k: K, v: AlertAssignForm[K]) => {
    setF((cur) => ({ ...cur, [k]: v }));
    setError('');
  };
  const chooseAssignee = (name: string | null) => {
    setF((cur) => ({ ...cur, assignee: name, collaborators: cur.collaborators.filter((c) => c !== name) }));
    setError('');
  };

  const picker = useAlertStaffPicker(alerts, now);
  const { loads } = picker;

  const { plan, issues, blocked, needReason, warnings, reassignMode, confirmLabel, reasonHint, blockVerb } = assignView(alerts, f, loads, now);

  const collabOptions = ALERT_STAFF.filter((p) => p.name !== f.assignee).map((p) => ({
    value: p.name,
    label: p.name,
    meta: `${p.title} · ${p.department}`,
  }));

  const submit = async () => {
    if (blocked || submitting) return;
    await modal.submit(f);
  };

  const onSaveDraft = () => {
    if (!single) return;
    if (!modal.saveDraft()) {
      setError('Không lưu được nháp (bộ nhớ trình duyệt không khả dụng).');
      return;
    }
    announce(`Đã lưu nháp phân công ${single.code} – cảnh báo chưa thay đổi.`);
  };

  return (
    <Modal
      open
      size="xl"
      title={reassignMode ? 'Đổi người xử lý' : 'Phân công xử lý cảnh báo'}
      description={
        reassignMode ? 'Chọn người xử lý mới – lý do đổi được ghi vào lịch sử cảnh báo' : 'Chọn người chịu trách nhiệm xác minh và theo dõi cảnh báo'
      }
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
        <AssignFooter
          confirming={confirming}
          hasDraft={hasDraft}
          keepEditingRef={modal.keepEditingRef}
          onKeepEditing={modal.keepEditing}
          onDiscard={discard}
          onSaveDraft={single ? onSaveDraft : undefined}
          confirmLabel={confirmLabel}
          blocked={blocked}
          submitting={submitting}
          blockId={blockId}
        />
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
        <StaffSection labelId={listLabelId} picker={picker} value={f.assignee} onChange={chooseAssignee} />

        {/* Phải: chi tiết phân công */}
        <section
          aria-labelledby={`${uid}-detail`}
          className="flex min-w-0 flex-col gap-4 self-start rounded-lg border border-line/30 bg-surface-raised/40 p-5"
        >
          <h3 id={`${uid}-detail`} className="text-lg font-semibold text-fg">
            Chi tiết phân công
          </h3>
          {plan && f.assignee && <BulkAssignPlan plan={plan} assignee={f.assignee} />}
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

          <AssignNotices warnings={warnings} issues={issues} blockId={blockId} blockTitle={`Chưa thể ${blockVerb} – còn thiếu:`} />
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
