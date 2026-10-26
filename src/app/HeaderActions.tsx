import { Button, Icon, Select, StatusDot, type SelectOption } from '@/components';
import { useLiveStatus } from '@/data/live';
import { formatDateTime, useNow } from '@/lib/useNow';

/** Các nút dùng lại trong slot actions của PageHeader (Figma 70:2882, 70:4037, 53:124). */

type ActionProps = { onClick?: () => void };

export function TodayButton({ onClick }: ActionProps) {
  return (
    <Button icon={<Icon name="calendar" />} onClick={onClick}>
      Hôm nay
    </Button>
  );
}

/** "Hôm nay" dạng chọn khoảng thời gian (Select variant="button", 70:2883). */
export function DateRangeSelect<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (v: V) => void;
}) {
  return (
    <Select
      variant="button"
      label="Khoảng thời gian"
      icon={<Icon name="calendar" />}
      options={options}
      value={value}
      onChange={(v) => v && onChange(v)}
      align="end"
    />
  );
}

export function ExportButton({ onClick }: ActionProps) {
  return (
    <Button icon={<Icon name="download" />} onClick={onClick}>
      Xuất báo cáo
    </Button>
  );
}

const LIVE_STATUS = {
  connected: { dot: 'live', label: 'Dữ liệu trực tiếp', className: undefined },
  connecting: { dot: 'warning', label: 'Đang kết nối lại…', className: 'text-warning' },
  disconnected: { dot: 'danger', label: 'Mất kết nối', className: 'text-danger-text' },
} as const;

/**
 * Trạng thái nguồn dữ liệu trực tiếp (Figma 53:124 = trạng thái connected). Đọc `useLiveStatus` – giữ kết nối mở:
 * connected "Dữ liệu trực tiếp" (chấm live) · connecting "Đang kết nối lại…" (vàng, nhấp nháy) · disconnected
 * "Mất kết nối" (đỏ). Trình đọc màn hình được báo qua LiveAnnouncer.
 */
export function LiveDataButton({ onClick }: ActionProps) {
  const status = useLiveStatus();
  const s = LIVE_STATUS[status];
  return (
    <Button
      icon={<StatusDot status={s.dot} pulse={status === 'connecting'} />}
      onClick={onClick}
      data-live-status={status}
    >
      {/* Đổi trạng thái được đọc qua LiveAnnouncer (aria-live polite) – không đặt vùng live trong nút. */}
      <span className={s.className}>{s.label}</span>
    </Button>
  );
}

/**
 * Nút làm mới. `accent` = nền accent như màn Cảnh báo (70:2890) – chỉ là kiểu hiển thị,
 * không phải nút bật/tắt nên bỏ aria-pressed.
 */
export function RefreshButton({ accent, onClick }: ActionProps & { accent?: boolean }) {
  return (
    <Button
      variant="icon"
      aria-label="Làm mới"
      pressed={accent}
      aria-pressed={undefined}
      onClick={onClick}
      icon={<Icon name={accent ? 'refreshAccent' : 'refresh'} box={12} />}
    />
  );
}

export function ClockButton() {
  const now = useNow();
  return (
    <Button icon={<Icon name="clock" />} className="tabular-nums">
      {formatDateTime(now)}
    </Button>
  );
}
