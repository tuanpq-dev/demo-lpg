import { Badge, type TagTone } from '@/components';
import { COMPLETION_LABEL, SIGNATURE_LABEL, type CompletionStatus, type SignatureStatus } from '@/features/reports';

const COMPLETION_TONE: Record<CompletionStatus, TagTone> = {
  'in-progress': 'primary',
  done: 'success',
  'missing-data': 'danger',
};

const SIGNATURE_TONE: Record<Exclude<SignatureStatus, 'not-sent'>, TagTone> = {
  pending: 'warning',
  signed: 'success',
  rejected: 'danger',
};

/** "Đang thực hiện" (primary) · "Hoàn thành" (success) · "Thiếu dữ liệu" (danger). */
export function CompletionBadge({ status }: { status: CompletionStatus }) {
  return (
    <Badge variant="tag" tone={COMPLETION_TONE[status]} className="font-semibold">
      {COMPLETION_LABEL[status]}
    </Badge>
  );
}

/** "Chưa gửi ký" = chữ xám (không badge, như ảnh) · "Chờ duyệt ký" · "Đã ký" · "Bị trả lại". */
export function SignatureBadge({ status }: { status: SignatureStatus }) {
  if (status === 'not-sent') return <span className="text-sm text-fg-secondary">{SIGNATURE_LABEL[status]}</span>;
  return (
    <Badge variant="tag" tone={SIGNATURE_TONE[status]} className="font-semibold">
      {SIGNATURE_LABEL[status]}
    </Badge>
  );
}
