import { Button, Icon, Select, StatusDot, type SelectOption } from '@/components';
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

export function LiveDataButton({ onClick }: ActionProps) {
  return (
    <Button icon={<StatusDot status="live" />} onClick={onClick}>
      Dữ liệu trực tiếp
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
