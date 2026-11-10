import { Card, EventTimeline, Icon, PriorityTaskCard, type TimelineEvent } from '@/components';
import { KpiFromData } from '@/app/kpi';
import type { deriveMaintenanceKpis, derivePriorityTasks } from '@/data/maintenance';

export function SectionHeading({ icon, children, id }: { icon: 'sectionWarning' | 'sectionTimer'; children: string; id: string }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-xl font-semibold text-fg">
      <Icon name={icon} box={24} />
      {children}
    </h2>
  );
}

/** 1. KPI – Figma 70:5207 (6 cột gap 18). */
export function MaintenanceKpiSection({ kpis }: { kpis: ReturnType<typeof deriveMaintenanceKpis> }) {
  return (
    <section aria-label="Thống kê bảo trì" className="grid grid-cols-2 gap-[18px] md:grid-cols-3 wide:grid-cols-6">
      {kpis.map((k) => (
        <KpiFromData key={k.id} data={k} />
      ))}
    </section>
  );
}

/** 2. Công việc cần ưu tiên – Figma 70:5208. */
export function PriorityTasksSection({ tasks, onDetail }: { tasks: ReturnType<typeof derivePriorityTasks>; onDetail: (id: string) => void }) {
  return (
    <section aria-labelledby="mt-priority" className="flex flex-col gap-3">
      <SectionHeading id="mt-priority" icon="sectionWarning">
        Công việc cần ưu tiên
      </SectionHeading>
      {tasks.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {tasks.map((p) => (
            <PriorityTaskCard key={p.id} {...p} onDetail={onDetail} />
          ))}
        </div>
      ) : (
        <p className="text-base text-fg-muted/70">Không có công việc ưu tiên.</p>
      )}
    </section>
  );
}

/** Lịch sắp tới – Figma 70:4889 (cột phải của danh sách). */
export function ScheduleCard({
  events,
  onShowSchedule,
  onEventClick,
}: {
  events: TimelineEvent[];
  onShowSchedule: () => void;
  onEventClick: (id: string) => void;
}) {
  return (
    <Card title="Lịch sắp tới" headerVariant="plain" action={{ label: 'Xem lịch', onClick: onShowSchedule }}>
      {events.length ? (
        <EventTimeline variant="schedule" events={events} onEventClick={onEventClick} />
      ) : (
        <p className="text-sm text-fg-muted/70">Không có lịch bảo trì định kỳ sắp tới.</p>
      )}
    </Card>
  );
}
