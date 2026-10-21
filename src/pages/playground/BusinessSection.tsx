import { useState, type ReactNode } from 'react';
import {
  AlertCard,
  AlertItem,
  AssetWatchlist,
  Card,
  Icon,
  KpiCard,
  RecentEventsCard,
  SystemHealthCard,
} from '@/components';
import { KpiFromData } from '@/app/kpi';
import { deriveAlertKpis, derivePriorityCards } from '@/data/alerts';
import { alertRecords } from '@/mocks/alerts';
import { deriveMaintenanceKpis } from '@/data/maintenance';
import { maintenanceRecords } from '@/mocks/maintenance';
import { overviewKpis, priorityAlarms, recentEvents, systemHealth, watchlist } from '@/mocks/overview';
import { FigmaRef } from './FigmaRef';
import { Demo } from './Demo';

const alertKpis = deriveAlertKpis(alertRecords);
const priorityAlertCards = derivePriorityCards(alertRecords);
const maintenanceKpis = deriveMaintenanceKpis(maintenanceRecords, new Date());

const OVERVIEW = '/figma-ref/53-11-overview.png';
const ALERTS = '/figma-ref/70-2809-alerts.png';
const MAINT = '/figma-ref/70-3964-maintenance.png';

function Log({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs text-fg-muted/65">{children}</p>;
}

export function BusinessSection() {
  const [clicked, setClicked] = useState('—');

  return (
    <div className="flex flex-col gap-10">
      <Demo title="KpiCard – Tổng quan (default / danger / with-progress)" node="53:166">
        <div className="grid w-[1148px] grid-cols-6 gap-4">
          {overviewKpis.map((k) => (
            <KpiFromData key={k.id} data={k} onAction={(id) => setClicked(`kpi:${id}`)} />
          ))}
        </div>
        <FigmaRef src={OVERVIEW} x={30} y={144} w={1148} h={128} />
      </Demo>

      <Demo title="KpiCard compact – Cảnh báo" node="70:2957">
        <div className="grid w-[1501px] grid-cols-5 gap-3">
          {alertKpis.map((k) => (
            <KpiFromData key={k.id} data={k} />
          ))}
        </div>
        <FigmaRef src={ALERTS} x={32} y={359} w={1501} h={92} />
      </Demo>

      <Demo title="KpiCard compact – Bảo trì" node="70:5207">
        <div className="grid w-[1503px] grid-cols-6 gap-[18px]">
          {maintenanceKpis.map((k) => (
            <KpiFromData key={k.id} data={k} />
          ))}
        </div>
        <FigmaRef src={MAINT} x={31} y={200} w={1503} h={130} />
      </Demo>

      <Demo title="KpiCard – API trực tiếp (không qua mock)" node="—">
        <div className="grid w-[760px] grid-cols-4 gap-4">
          <KpiCard label="Áp suất" value="1.82" unit="bar" sub="Ổn định" />
          <KpiCard label="Cảnh báo" value="3" unit="Active" variant="danger" icon={<Icon name="kpiDanger" box={24} />} action={{ label: 'Xem chi tiết' }} />
          <KpiCard label="Hiệu suất" value="64" unit="%" variant="with-progress" tone="success" progress={{ value: 64 }} />
          <KpiCard label="Quá hạn" value="05" variant="compact" tone="danger" outlined sub="Cần xử lý ngay" subTone="danger" />
        </div>
      </Demo>

      <div className="grid gap-10 xl:grid-cols-2">
        <Demo title="SystemHealthCard" node="53:429">
          <div className="flex flex-wrap items-start gap-6">
            <SystemHealthCard {...systemHealth} className="w-[326px]" />
            <FigmaRef src={OVERVIEW} x={1209} y={144} w={326} h={235} />
          </div>
        </Demo>

        <Demo title="AlertItem (trong Card)" node="53:470">
          <div className="flex flex-wrap items-start gap-6">
            <Card
              title="Cảnh báo ưu tiên"
              icon={<Icon name="danger" />}
              action={{ label: 'Xem tất cả', onClick: () => setClicked('alarms:all') }}
              padding="none"
              className="w-[326px]"
            >
              {priorityAlarms.map((a, i) => (
                <AlertItem
                  key={a.id}
                  {...a}
                  highlighted={i === 0}
                  last={i === priorityAlarms.length - 1}
                  onClick={(id) => setClicked(`alarm:${id}`)}
                />
              ))}
            </Card>
            <FigmaRef src={OVERVIEW} x={1209} y={403} w={326} h={239} />
          </div>
        </Demo>

        <Demo title="AssetRow + AssetWatchlist" node="53:495 (màu đọc từ ảnh chụp)">
          <div className="flex flex-wrap items-start gap-6">
            <AssetWatchlist assets={watchlist} onAssetClick={(id) => setClicked(`asset:${id}`)} className="w-[326px]" />
            <FigmaRef src={OVERVIEW} x={1209} y={666} w={326} h={234} />
          </div>
        </Demo>

        <Demo title="EventTimeline (RecentEventsCard)" node="53:528 (màu đọc từ ảnh chụp)">
          <div className="flex flex-wrap items-start gap-6">
            <RecentEventsCard events={recentEvents} className="w-[326px]" />
            <FigmaRef src={OVERVIEW} x={1209} y={924} w={326} h={197} />
          </div>
        </Demo>
      </div>

      <Demo title="AlertCard" node="70:2910">
        <div className="grid w-[1501px] grid-cols-3 gap-[15.5px]">
          {priorityAlertCards.map((a) => (
            <AlertCard key={a.id} {...a} onClick={(id) => setClicked(`alertcard:${id}`)} />
          ))}
        </div>
        <FigmaRef src={ALERTS} x={32} y={236} w={1501} h={99} />
      </Demo>

      <Log>click gần nhất: {clicked}</Log>
    </div>
  );
}
