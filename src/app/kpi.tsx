import { Icon, KpiCard } from '@/components';
import type { KpiData } from '@/data/overview';

/** Map dữ liệu KPI thuần (mock/API, đã ghép số liệu trực tiếp – `applyLive`) → <KpiCard>. */
export function KpiFromData({ data, onAction }: { data: KpiData; onAction?: (id: string) => void }) {
  const { id, icon, iconBox = 24, subIcon, progress, progressTone, action, live: _live, ...rest } = data;
  void _live;
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
