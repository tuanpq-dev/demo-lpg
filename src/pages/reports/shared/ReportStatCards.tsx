import type { ReactNode } from 'react';
import { Card, ProgressBar, type CardTone } from '@/components';
import type { DailyCard, DailyCardTone } from '@/features/reports';
import { cn } from '@/lib/cn';

export type ReportStatCard = DailyCard & { icon: ReactNode };

const CARD_TONE: Record<DailyCardTone, CardTone> = {
  primary: 'primary',
  success: 'success-vivid',
  warning: 'warning',
  danger: 'danger',
  neutral: 'strong',
};

/** Số góc phải 18px đậm – chưa đạt "chữ lớn" WCAG → đỏ dùng danger-text. */
const VALUE_TONE: Record<DailyCardTone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-text',
  neutral: 'text-fg-secondary',
};

/**
 * Hàng thẻ tóm tắt của màn chi tiết báo cáo (Figma 117:4367): viền màu theo tone + vạch trái 3px, icon 18px trái, số
 * đậm phải, tiêu đề, dòng phụ; thẻ có `percent` thêm "83%" + thanh 4px. Dữ liệu đã suy dẫn (`deriveDailyCards`).
 * Dùng lại được cho chi tiết báo cáo tháng/quý/năm (đơn vị mốc khác).
 */
export function ReportStatCards({ cards, label = 'Tóm tắt báo cáo' }: { cards: readonly ReportStatCard[]; label?: string }) {
  return (
    <section aria-label={label} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.id} tone={CARD_TONE[c.tone]} radius="lg" padding="none" className="border-l-[3px]" bodyClassName="gap-1 py-3 pl-3.5 pr-3">
          <div className="flex items-start justify-between gap-2">
            {c.icon}
            <span className={cn('text-lg font-bold leading-[27px] tabular-nums', VALUE_TONE[c.tone])}>{c.value}</span>
          </div>
          <h3 className="pt-1 text-base font-semibold leading-4.5 text-fg-label">{c.title}</h3>
          {c.percent !== undefined && (
            <>
              <span className={cn('text-xs font-semibold tabular-nums', VALUE_TONE[c.tone])}>{c.percent}%</span>
              <ProgressBar value={c.percent} tone="primary" track="solid" label={c.title} />
            </>
          )}
          <p className="text-sm text-fg-secondary">{c.sub}</p>
        </Card>
      ))}
    </section>
  );
}
