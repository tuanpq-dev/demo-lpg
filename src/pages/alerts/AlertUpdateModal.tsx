import { useId } from 'react';
import { AssignNotices, Button, Modal, DiscardConfirmButtons } from '@/components';
import type { AlertRecord } from '@/data/alerts';
import { stateLabel, suggestsSupport, type AlertUpdateInput, type AlertUpdateResult, type UpdateCheck } from '@/features/alerts/update';
import { useNow } from '@/lib/useNow';
import { UpdateCauseFields } from './update/UpdateCauseFields';
import { UpdateFilesSection } from './update/UpdateFilesSection';
import { UpdateFollowUpSection } from './update/UpdateFollowUpSection';
import { UpdateInspectionSection } from './update/UpdateInspectionSection';
import { UpdateIssueSection } from './update/UpdateIssueSection';
import { UpdateReadingsSection } from './update/UpdateReadingsSection';
import { UpdateStateSection } from './update/UpdateStateSection';
import { UpdateSummary } from './update/UpdateSummary';
import { UpdateVerificationFieldset } from './update/UpdateVerificationFieldset';
import { useAlertUpdateForm } from './update/useAlertUpdateForm';

export type AlertUpdateModalProps = {
  alert: AlertRecord;
  /** Người đang thao tác – tự điền "Người kiểm tra" khi đổi trạng thái hạng mục. */
  actor: string;
  onClose: () => void;
  /** Ghi bản ghi (data layer gọi `alertUpdate` – kiểm lại toàn bộ). Nơi gọi đóng modal khi ok. */
  onSubmit: (input: AlertUpdateInput, check: UpdateCheck) => Promise<AlertUpdateResult> | AlertUpdateResult;
};

/**
 * Modal "Cập nhật xử lý" – KHUNG CHUNG mọi loại `update.kind = 'alert-update'` (ảnh áp suất
 * `scratch/figma-ref/alert-pressure-update-modal-design.png`; gas + cháy dựng theo khung đó, chưa có thiết kế
 * riêng – lệch ảnh ghi docs/figma-diffs.md; docs/guide/alerts.md (4o)). Phần theo loại lấy từ `ALERT_KINDS[kind].update`:
 * tiêu đề, ô trạng thái (cháy tách "Đã xử lý sự cố" / "Báo động giả"), dòng thông số, nguồn xác minh, mục xác minh, theo dõi.
 * Các khối (thư mục `update/`): Thẻ đầu · Trạng thái xử lý · Kết quả kiểm tra thiết bị (= hướng dẫn của drawer, một nguồn) ·
 * Thông số trước/sau · Kết quả xác minh · Nguyên nhân / Nội dung · Ảnh và tài liệu · Vấn đề phát sinh · Theo dõi sau xử lý.
 * State + kiểm tra: `useAlertUpdateForm`; quy tắc: `features/alerts/update.ts`. Nháp sessionStorage theo mã. Chỉ mount khi mở (chunk lazy riêng).
 */
export default function AlertUpdateModal({ alert: a, actor, onClose, onSubmit }: AlertUpdateModalProps) {
  const now = useNow(30_000);
  const f = useAlertUpdateForm({ alert: a, now, onSubmit, onClose });
  const { cfg, values: v, set, err, modal } = f;
  const { confirming, submitting: busy, hasDraft, requestClose, discard } = modal;
  const blockId = `${useId()}-block`;
  const resolvedLabel = stateLabel(cfg, 'resolved');

  const footer = confirming ? (
    <DiscardConfirmButtons
      keepEditingRef={modal.keepEditingRef}
      onKeepEditing={modal.keepEditing}
      onDiscard={discard}
      hasDraft={hasDraft}
      draftDiscardLabel="Bỏ thay đổi (giữ bản nháp đã lưu)"
    />
  ) : (
    <>
      <Button variant="subtle" onClick={f.saveDraft}>
        Lưu nháp
      </Button>
      <Button
        type="submit"
        variant="primary"
        disabled={busy}
        aria-disabled={f.blocked || undefined}
        aria-describedby={f.blocked ? blockId : undefined}
      >
        Lưu cập nhật
      </Button>
    </>
  );

  return (
    <Modal
      open
      onClose={requestClose}
      size="xl"
      title={cfg.title}
      description={`Ghi nhận kết quả kiểm tra và tình trạng xử lý cảnh báo ${a.code}`}
      dismissOnBackdrop={!modal.dirty}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming) void f.submit();
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
      {hasDraft && f.initialDraft && <p className="text-sm text-fg-secondary">Bản nháp đã được khôi phục.</p>}

      <UpdateSummary alert={a} now={now} />

      <UpdateStateSection
        cfg={cfg}
        close={f.close}
        state={v.state}
        holdReason={v.holdReason}
        supportPeople={v.supportPeople}
        collaborators={a.collaborators}
        err={err}
        onStateChange={(s) => set('state', s)}
        onHoldReasonChange={(t) => set('holdReason', t)}
        onSupportPeopleChange={(ids) => set('supportPeople', ids)}
      />

      <UpdateInspectionSection
        code={a.code}
        steps={f.steps}
        inspection={v.inspection}
        errors={err.inspection}
        actor={actor}
        onChange={f.setInspection}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <UpdateReadingsSection
          cfg={cfg}
          rows={f.readingRows}
          source={v.source}
          recordedAt={v.recordedAt}
          editable={f.editable}
          primaryLost={f.primaryLost}
          onAfterChange={(id, val) => set('manualAfter', { ...v.manualAfter, [id]: val })}
          onSourceChange={(s) => set('source', s)}
          onRecordedAtChange={(t) => set('recordedAt', t)}
        />
        <UpdateVerificationFieldset
          cfg={cfg}
          items={f.verItems}
          value={v.verification}
          normalId={f.normalId}
          closeOk={f.close.ok}
          limit={f.warn}
          unit={a.unit}
          error={f.shown.verification}
          onToggle={f.toggleVerification}
        />
      </div>

      <UpdateCauseFields
        cause={v.cause}
        actionTaken={v.actionTaken}
        resolved={f.resolved}
        resolvedLabel={resolvedLabel}
        errors={err}
        onCauseChange={(t) => set('cause', t)}
        onActionTakenChange={(t) => set('actionTaken', t)}
      />

      <UpdateFilesSection
        code={a.code}
        attachments={a.attachments}
        files={f.files}
        uploadError={f.uploadError}
        onAdd={f.addFiles}
        onRemove={f.removeFile}
      />

      <UpdateIssueSection
        issues={cfg.issues}
        value={v.issue}
        error={err.issueNote}
        suggestSupport={suggestsSupport(v, cfg)}
        onChange={(issue) => set('issue', issue)}
        onRequestSupport={() => set('state', 'needs-support')}
      />

      <UpdateFollowUpSection
        cfg={cfg}
        value={v.followUp}
        customAtLocal={v.customAtLocal}
        unit={a.unit}
        resolved={f.resolved}
        resolvedLabel={resolvedLabel}
        active={f.followActive}
        window={f.followWindow}
        onChange={(followUp) => set('followUp', followUp)}
        onCustomAtChange={(t) => set('customAtLocal', t)}
      />

      <AssignNotices
        warnings={f.warnings.map((w, i) => ({ id: `w${i}`, label: w }))}
        warningSuffix="vẫn lưu được"
        issues={f.blocked ? f.issues : []}
        blockId={blockId}
        blockTitle="Chưa lưu được – còn thiếu:"
      />
      {f.submitError && (
        <p role="alert" className="text-sm text-danger-text">
          {f.submitError}
        </p>
      )}
    </Modal>
  );
}
