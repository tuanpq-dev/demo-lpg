import { cn } from '@/lib/cn';
import { Card } from '../Card';

export type TimelineEvent = {
  id: string;
  title: string;
  /** "08:15 AM", "Hôm nay, 14:00" */
  time: string;
  /** Dòng phụ có icon ghim (variant="schedule"), ví dụ khu vực "Bồn chứa". */
  location?: string;
  /** Sự kiện đang diễn ra / gần nhất – vòng accent (mặc định: sự kiện đầu tiên). */
  active?: boolean;
  /** variant="history": màu chấm (danger tô cả tiêu đề) – ảnh MT-00128 "Lịch sử xử lý". */
  tone?: TimelineTone;
};

export type TimelineTone = 'success' | 'neutral' | 'info' | 'warning' | 'danger';

const historyDot: Record<TimelineTone, string> = {
  success: 'bg-success',
  neutral: 'bg-neutral/70',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-danger-strong',
};

export type EventTimelineProps = {
  events: readonly TimelineEvent[];
  /**
   * - event:    chấm 12px, tiêu đề rồi giờ (Sự kiện gần đây 53:532)
   * - schedule: chấm 16px, giờ rồi tiêu đề 14px rồi vị trí kèm icon ghim (Lịch sắp tới 70:4895)
   * - history:  chấm đặc 8px theo `tone`, tiêu đề trái + giờ phải trên một dòng (Lịch sử xử lý – ảnh MT-00128)
   */
  variant?: 'event' | 'schedule' | 'history';
  /** Click vào một mục (render thành button). */
  onEventClick?: (id: string) => void;
  className?: string;
};

/** Icon ghim vị trí 8×10 – Figma 70:4907 chưa tải được (MCP giới hạn) → SVG tối giản theo currentColor. */
function PinIcon() {
  return (
    <svg width="8" height="10" viewBox="0 0 8 10" aria-hidden="true" className="shrink-0">
      <path
        d="M4 9.4S7.2 6.3 7.2 4A3.2 3.2 0 0 0 .8 4C.8 6.3 4 9.4 4 9.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="4" r="1.1" fill="currentColor" />
    </svg>
  );
}

/**
 * Dòng thời gian dọc: đường kẻ line, chấm tròn rỗng (Figma 53:532, 70:4895).
 * Màu lấy từ ảnh chụp Figma (node chưa có design context).
 */
export function EventTimeline({ events, variant = 'event', onEventClick, className }: EventTimelineProps) {
  if (variant === 'history') return <HistoryTimeline events={events} className={className} />;
  const hasActive = events.some((e) => e.active !== undefined);
  const schedule = variant === 'schedule';
  return (
    <ol className={cn('relative flex flex-col gap-3', className)}>
      {/* Đường dọc chạy qua tâm chấm: x = 6px (chấm 12) hoặc 7.5px (chấm 16) */}
      <span
        aria-hidden="true"
        className={cn('absolute w-px bg-line', schedule ? 'bottom-2 left-[7.5px] top-2' : 'bottom-0 left-1.5 top-0')}
      />
      {events.map((e, i) => {
        const active = hasActive ? !!e.active : i === 0;
        const Tag = onEventClick ? 'button' : 'div';
        return (
          <li key={e.id} className="relative">
            <Tag
              {...(onEventClick ? { type: 'button' as const, onClick: () => onEventClick(e.id) } : {})}
              className={cn('flex w-full gap-3 text-left', onEventClick && 'rounded-md hover:bg-surface-muted/20')}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'relative shrink-0 rounded-full border-2 bg-surface-sunken',
                  schedule ? 'mt-0.5 size-4' : 'mt-1 size-3',
                  active ? 'border-accent' : 'border-line',
                )}
              />
              {schedule ? (
                <span className="flex min-w-0 flex-col gap-1">
                  <time className="text-xs text-fg-muted/70">{e.time}</time>
                  <span className="text-base text-fg">{e.title}</span>
                  {e.location && (
                    <span className="flex items-center gap-1 text-sm text-fg-muted/70">
                      <PinIcon />
                      {e.location}
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm text-fg">{e.title}</span>
                  <time className="text-2xs text-fg-muted/65">{e.time}</time>
                </span>
              )}
            </Tag>
          </li>
        );
      })}
    </ol>
  );
}

function HistoryTimeline({ events, className }: Pick<EventTimelineProps, 'events' | 'className'>) {
  return (
    <ol className={cn('relative flex flex-col gap-4', className)}>
      <span aria-hidden="true" className="absolute bottom-2 left-[3.5px] top-2 w-px bg-line/60" />
      {events.map((e) => {
        const tone = e.tone ?? 'neutral';
        return (
          <li key={e.id} className="relative flex items-baseline gap-3">
            <span aria-hidden="true" className={cn('relative top-[-1px] size-2 shrink-0 self-center rounded-full', historyDot[tone])} />
            <span className={cn('min-w-0 flex-1 text-base', tone === 'danger' ? 'text-danger-text' : 'text-fg-secondary')}>{e.title}</span>
            <time className="shrink-0 text-sm tabular-nums text-fg-secondary">{e.time}</time>
          </li>
        );
      })}
    </ol>
  );
}

export type RecentEventsCardProps = EventTimelineProps & {
  title?: string;
  action?: { label: string; onClick?: () => void };
};

/** Card "Sự kiện gần đây" – sidebar Tổng quan (Figma 53:528). */
export function RecentEventsCard({ title = 'Sự kiện gần đây', events, action, className, ...rest }: RecentEventsCardProps) {
  return (
    <Card title={title} headerVariant="plain" action={action} className={className}>
      <EventTimeline events={events} {...rest} />
    </Card>
  );
}
