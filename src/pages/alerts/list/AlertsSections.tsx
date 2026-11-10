/** Khối giao diện của /alerts: cảnh báo ưu tiên, thanh thao tác hàng loạt. Tách từ AlertsPage. */
import { AlertCard, Button, Icon, type AlertCardData } from '@/components';

/** 1. Cảnh báo ưu tiên – Figma 70:2901. */
export function PriorityAlerts({ cards, onOpen }: { cards: readonly AlertCardData[]; onOpen: (id: string) => void }) {
  return (
    <section aria-labelledby="priority-heading" className="flex flex-col gap-3">
      <h2 id="priority-heading" className="flex items-center gap-2 text-xl font-semibold uppercase leading-6 tracking-label text-fg-secondary">
        <Icon name="dangerLg" box={24} />
        Cảnh báo ưu tiên
      </h2>
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {cards.map((c) => (
            <AlertCard key={c.id} {...c} onClick={onOpen} />
          ))}
        </div>
      ) : (
        <p className="text-base text-fg-muted/70">Không còn cảnh báo ưu tiên cần xử lý.</p>
      )}
    </section>
  );
}

export type BulkActionsBarProps = {
  selected: number;
  /** Số dòng đang chọn đủ điều kiện từng thao tác. */
  acknowledgeable: number;
  assignable: number;
  closable: number;
  onAcknowledge: () => void;
  onAssign: () => void;
  onClose: () => void;
  onClear: () => void;
};

const withCount = (label: string, n: number) => (n > 0 ? `${label} (${n})` : label);

/** Thanh thao tác hàng loạt trên bảng (hiện khi có dòng được chọn). */
export function BulkActionsBar({ selected, acknowledgeable, assignable, closable, onAcknowledge, onAssign, onClose, onClear }: BulkActionsBarProps) {
  return (
    <div role="toolbar" aria-label="Thao tác hàng loạt" className="flex flex-wrap items-center gap-3 border-b border-info/20 bg-info/10 px-4 py-2.5">
      <span className="text-base font-semibold text-info">Đã chọn {selected} cảnh báo</span>
      <Button variant="primary" disabled={acknowledgeable === 0} onClick={onAcknowledge}>
        {withCount('Xác nhận', acknowledgeable)}
      </Button>
      <Button disabled={assignable === 0} onClick={onAssign}>
        {withCount('Phân công…', assignable)}
      </Button>
      <Button disabled={closable === 0} onClick={onClose}>
        {withCount('Đóng cảnh báo', closable)}
      </Button>
      <Button variant="link" size="md" onClick={onClear} className="ml-auto">
        Bỏ chọn
      </Button>
    </div>
  );
}
