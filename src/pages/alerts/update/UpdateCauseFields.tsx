import { Textarea } from '@/components';

export type UpdateCauseFieldsProps = {
  cause: string;
  actionTaken: string;
  /** Đang chọn trạng thái đã xử lý → hai ô bắt buộc. */
  resolved: boolean;
  /** Nhãn trạng thái đã xử lý theo loại (gợi ý khi chưa bắt buộc). */
  resolvedLabel: string;
  errors: { cause?: string; actionTaken?: string };
  onCauseChange: (t: string) => void;
  onActionTakenChange: (t: string) => void;
};

/** Khối "Nguyên nhân xử lý" + "Nội dung đã xử lý" (bắt buộc khi chọn trạng thái đã xử lý). */
export function UpdateCauseFields({
  cause,
  actionTaken,
  resolved,
  resolvedLabel,
  errors,
  onCauseChange,
  onActionTakenChange,
}: UpdateCauseFieldsProps) {
  const hint = resolved ? undefined : `Bắt buộc khi chọn "${resolvedLabel}".`;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Textarea
        label="Nguyên nhân xử lý"
        labelVariant="section"
        required={resolved}
        value={cause}
        onChange={onCauseChange}
        rows={3}
        maxLength={1000}
        error={errors.cause}
        hint={hint}
        placeholder="Nhập nguyên nhân gây ra cảnh báo..."
      />
      <Textarea
        label="Nội dung đã xử lý"
        labelVariant="section"
        required={resolved}
        value={actionTaken}
        onChange={onActionTakenChange}
        rows={3}
        maxLength={1000}
        error={errors.actionTaken}
        hint={hint}
        placeholder="Mô tả các bước đã thực hiện..."
      />
    </div>
  );
}
