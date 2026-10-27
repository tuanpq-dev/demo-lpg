import { Button, Icon, PageHeader, StatusPill } from '@/components';
import { ClockButton, ExportButton, LiveDataButton, RefreshButton, TodayButton } from '@/app/HeaderActions';
import { RoutedAppHeader } from '@/app/Page';
import { FigmaRef } from './FigmaRef';
import { Demo } from './Demo';

const OVERVIEW = (import.meta.env.DEV ? '/scratch/figma-ref/53-11-overview.png' : undefined);
const ALERTS = (import.meta.env.DEV ? '/scratch/figma-ref/70-2809-alerts.png' : undefined);
const MAINT = (import.meta.env.DEV ? '/scratch/figma-ref/70-3964-maintenance.png' : undefined);

export function LayoutSection() {
  return (
    <div className="flex flex-col gap-10">
      <Demo title="AppHeader (gắn router)" node="53:13">
        <RoutedAppHeader />
        <FigmaRef src={OVERVIEW} x={0} y={0} w={1565} h={60} />
      </Demo>

      <Demo title="StatusPill" node="53:125">
        <div className="flex flex-wrap gap-3">
          <StatusPill tone="success">Hệ thống bình thường</StatusPill>
          <StatusPill tone="warning">Có cảnh báo</StatusPill>
          <StatusPill tone="danger" pulse>
            Sự cố nghiêm trọng
          </StatusPill>
        </div>
      </Demo>

      <Demo title="PageHeader – Tổng quan (chỉ actions)" node="53:124">
        <PageHeader
          actions={
            <>
              <StatusPill>Hệ thống bình thường</StatusPill>
              <ClockButton />
              <LiveDataButton />
            </>
          }
        />
        <FigmaRef src={OVERVIEW} x={900} y={84} w={665} h={36} />
      </Demo>

      <Demo title="PageHeader – Cảnh báo" node="70:2848">
        <PageHeader
          breadcrumb={[{ label: 'Cảnh báo', to: '/alerts' }, { label: 'Trung tâm cảnh báo' }]}
          title="Trung tâm cảnh báo"
          description="Theo dõi, xác nhận và xử lý cảnh báo trên toàn hệ thống LPG"
          actions={
            <>
              <TodayButton />
              <ExportButton />
              <RefreshButton accent />
              <LiveDataButton />
            </>
          }
        />
        <FigmaRef src={ALERTS} x={32} y={84} w={1501} h={92} />
      </Demo>

      <Demo title="PageHeader – Bảo trì" node="70:4003">
        <PageHeader
          breadcrumb={[{ label: 'Bảo trì', to: '/maintenance' }, { label: 'Quản lý bảo trì' }]}
          title="Quản lý bảo trì"
          description="Theo dõi, phân công và quản lý tiến độ bảo trì thiết bị trong hệ thống LPG"
          actions={
            <>
              <TodayButton />
              <ExportButton />
              <LiveDataButton />
              <RefreshButton />
              <Button variant="primary" icon={<Icon name="add" />}>
                Tạo yêu cầu bảo trì
              </Button>
            </>
          }
        />
        <FigmaRef src={MAINT} x={32} y={84} w={1501} h={96} />
      </Demo>
    </div>
  );
}
