import { Button, ChecklistEditor, Modal, SendIcon, ToolsIcon } from '@/components';
import type { AlertRecord } from '@/data/alerts';
import { CHECKLIST_TEMPLATES, type NewMaintenanceInput } from '@/data/maintenance';
import { AlertLinkBanner, DraftBanner } from './create/CreateBanners';
import { PlanColumn, RequestInfoColumn } from './create/CreateInfoColumns';
import { AiSuggestionPanel, AttachmentsNotesSection, CreateOverview } from './create/CreateSections';
import { useCreateMaintenanceForm } from './create/useCreateMaintenanceForm';

export type CreateMaintenanceModalProps = {
  open: boolean;
  onClose: () => void;
  /** Danh bạ thiết bị → khu vực (`deriveDeviceDirectory`). */
  devices: readonly { device: string; area: string }[];
  defaultDevice?: string;
  /** Cảnh báo nguồn (mở từ /alerts). */
  alert?: AlertRecord;
  /** Tên yêu cầu điền sẵn thay câu suy từ cảnh báo (báo cháy "Báo động giả" → "Kiểm tra đầu báo HD-02"). */
  defaultTitle?: string;
  onSubmit: (input: NewMaintenanceInput) => Promise<unknown>;
  onDraftSaved?: () => void;
};

/**
 * "Tạo yêu cầu bảo trì" – theo ảnh thiết kế người dùng gửi (chưa có node Figma).
 * Khối (thư mục `create/`): liên kết cảnh báo / nháp · hai cột thông tin · Góp ý từ AI (mock) · Checklist · Tệp đính kèm ·
 * Ghi chú & An toàn · thanh tổng quan. State + kiểm tra: `useCreateMaintenanceForm`; hàm thuần: `create/createForm.ts`.
 */
export function CreateMaintenanceModal({
  open,
  onClose,
  devices,
  defaultDevice,
  alert,
  defaultTitle,
  onSubmit,
  onDraftSaved,
}: CreateMaintenanceModalProps) {
  const f = useCreateMaintenanceForm({ devices, defaultDevice, alert, defaultTitle, onSubmit, onDraftSaved });
  const { form } = f;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={<ToolsIcon />}
      title="Tạo yêu cầu bảo trì"
      description="Tạo công việc kiểm tra, sửa chữa hoặc bảo dưỡng thiết bị"
      onSubmit={(e) => void f.handleSubmit(e)}
      dismissOnBackdrop={false}
      footerStart={
        <button type="button" onClick={onClose} className="rounded-sm px-1 text-base text-fg-secondary hover:text-fg">
          Hủy
        </button>
      }
      footer={
        <>
          <Button onClick={f.saveDraft}>Lưu nháp</Button>
          <Button variant="primary" type="submit" disabled={f.submitting}>
            Tạo yêu cầu
            <SendIcon />
          </Button>
        </>
      }
    >
      {alert && <AlertLinkBanner alert={alert} />}
      {f.draftInfo && <DraftBanner savedAt={f.draftInfo} onDiscard={f.discardDraft} />}

      <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
        <RequestInfoColumn f={f} devices={devices} />
        <PlanColumn f={f} />
      </div>

      {f.suggestion && <AiSuggestionPanel suggestion={f.suggestion} checklist={form.checklist} onToggle={f.toggleSuggestion} />}

      <hr className="border-line/30" />

      <ChecklistEditor items={form.checklist} onChange={(v) => f.set('checklist', v)} templates={CHECKLIST_TEMPLATES} />

      <AttachmentsNotesSection f={f} />

      {f.submitError && (
        <p role="alert" className="text-sm text-danger-text">
          {f.submitError}
        </p>
      )}

      <CreateOverview form={form} />
    </Modal>
  );
}
