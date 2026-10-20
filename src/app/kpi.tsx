import { Icon, KpiCard } from '@/components';
import type { KpiMock } from '@/mocks/types';

/** Map dữ liệu KPI thuần (mock/API) → <KpiCard>. */
export function KpiFromData({ data, onAction }: { data: KpiMock; onAction?: (id: string) => void }) {
  const {
    id,
    icon,
    iconBox = 24,
    subIcon,
    progress,
    progressTone,
    action,
    ...rest
  } = data;
  return (
    <KpiCard
      {...rest}
      icon={icon ? <Icon name={icon} box={iconBox} /> : undefined}
      subIcon={subIcon ? <Icon name={subIcon} box={subIcon === 'kpiDash' ? 12 : 18} /> : undefined}
      progress={progress !== undefined ? { value: progress, tone: progressTone ?? 'success' } : undefined}
      action={action ? { label: action, onClick: () => onAction?.(id) } : undefined}
    />
  );
}
