import { useId } from 'react';
import { Checkbox } from '@/components';
import { metricText } from '@/data/alertDetail';
import type { AlertUpdateConfig } from '@/features/alerts/kinds';

export type UpdateVerificationFieldsetProps = {
  cfg: AlertUpdateConfig;
  items: readonly { id: string; text: string }[];
  value: readonly string[];
  /** Mục "trở về bình thường" (chỉ chọn được khi đạt điều kiện đóng). */
  normalId: string | undefined;
  /** Đạt điều kiện đóng. */
  closeOk: boolean;
  /** Ngưỡng cảnh báo + đơn vị – câu gợi ý mục "bình thường". */
  limit: number;
  unit: string;
  /** Lỗi mâu thuẫn xác minh (hiện ngay, không chờ bấm lưu). */
  error: string | undefined;
  onToggle: (id: string, on: boolean) => void;
};

/** Khối "Kết quả xác minh (Chọn nhiều)": ô chọn theo loại; mục "bình thường" khoá (aria-disabled) khi chưa đạt điều kiện đóng. */
export function UpdateVerificationFieldset({ cfg, items, value, normalId, closeOk, limit, unit, error, onToggle }: UpdateVerificationFieldsetProps) {
  const hintId = `${useId()}-normal-hint`;
  const normalText = normalId ? (items.find((x) => x.id === normalId)?.text ?? normalId) : '';
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-3 text-lg font-semibold text-fg-secondary">Kết quả xác minh (Chọn nhiều)</legend>
      {items.map((it) => {
        const on = value.includes(it.id);
        const locked = it.id === normalId && !closeOk && !on;
        return (
          <Checkbox
            key={it.id}
            variant="card"
            label={it.text}
            checked={on}
            onChange={(c) => onToggle(it.id, c)}
            aria-disabled={locked || undefined}
            aria-describedby={it.id === normalId ? hintId : undefined}
          />
        );
      })}
      {normalId && (
        <p id={hintId} className="text-sm text-fg-secondary">
          "{normalText}" chỉ chọn được khi {cfg.close.rule === 'fire' ? cfg.normalHint : `${cfg.normalHint ?? `${cfg.quantity} hiện tại dưới ngưỡng`} (${metricText(limit, unit)})`}.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-fg">
          {error}
        </p>
      )}
    </fieldset>
  );
}
