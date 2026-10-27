import { useId, type ReactNode } from 'react';
import { Divider } from '../Divider';
import { Drawer } from './Drawer';

export type DetailField = {
  label: string;
  value: ReactNode;
};

export type DetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Dòng nhỏ phía trên tiêu đề, ví dụ "Chi tiết cảnh báo". */
  eyebrow?: string;
  /** Tiêu đề chính (mã bản ghi). */
  title: ReactNode;
  /** Badge cạnh tiêu đề. */
  badges?: ReactNode;
  /** Đoạn mô tả đầu thân drawer. */
  description?: ReactNode;
  /** Nội dung chèn sau mô tả (badge trạng thái, tiến độ…). */
  summary?: ReactNode;
  fields: readonly DetailField[];
  /** Nút ở chân drawer. */
  actions?: ReactNode;
  /** Đổi khi nội dung thay đổi – để đưa focus về nút Đóng nếu nút đang focus bị ẩn. */
  contentKey?: unknown;
};

/**
 * Panel chi tiết dạng nhãn/giá trị (khung `Drawer` dùng chung). Drawer chi tiết cảnh báo có thiết kế riêng
 * (`pages/alerts/AlertDetailDrawer.tsx`); component này còn cho bản ghi chưa có thiết kế.
 * ⚠ Figma CHƯA có thiết kế – dựng tối giản bằng token sẵn có.
 */
export function DetailDrawer({ open, onClose, eyebrow, title, badges, description, summary, fields, actions, contentKey }: DetailDrawerProps) {
  const titleId = useId();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      contentKey={contentKey}
      header={
        <div className="flex min-w-0 flex-col gap-2 pr-10">
          {eyebrow && <span className="text-sm text-fg-secondary">{eyebrow}</span>}
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className="text-xl font-semibold text-fg">
              {title}
            </h2>
            {badges}
          </div>
        </div>
      }
      footer={actions && <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>}
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        {description && <p className="text-md text-fg">{description}</p>}
        {summary}
        <Divider />
        <dl className="flex flex-col divide-y divide-line/10">
          {fields.map((f) => (
            <div key={f.label} className="flex items-start justify-between gap-4 py-2">
              <dt className="shrink-0 text-sm text-fg-muted">{f.label}</dt>
              <dd className="text-right text-base text-fg">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Drawer>
  );
}
