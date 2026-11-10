import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircleIcon,
  AlertItem,
  DonutGauge,
  FocusIcon,
  HistoryIcon,
  InfoIcon,
  KpiCard,
  MaintenanceSummaryCard,
  MapIcon,
  SegmentedControl,
  StatusPill,
  TankCutawayDiagram,
  TankLayerList,
} from '@/components';
import { tankLayers } from '@/features/tank/layers';
import { Demo } from './Demo';

/** Ảnh Figma chỉ ở máy dev (`scratch/figma-ref/`, gitignore); bản build: undefined (không đóng gói). */
const REF_ASSET_V101_DESIGN = import.meta.env.DEV ? '/scratch/figma-ref/asset-v101-design.png' : undefined;

const DIMS = { length: 4.8, diameter: 1.9 };
const CASES = [
  { id: 'figma', label: 'Theo ảnh (73 / 5.2)', level: 73, water: 5.2 },
  { id: 'low', label: 'Mức thấp (12 / 4)', level: 12, water: 4 },
  { id: 'wet', label: 'Nhiều nước (60 / 18)', level: 60, water: 18 },
  { id: 'full', label: 'Đầy (100 / 0)', level: 100, water: 0 },
  { id: 'lost', label: 'Mất tín hiệu', level: NaN, water: NaN },
] as const;

/** Mục 10 – component trang chi tiết tài sản (GĐ 5D, ảnh "Bồn LPG V-101" – chưa có node Figma). */
export function AssetSection() {
  const [caseId, setCaseId] = useState<(typeof CASES)[number]['id']>('figma');
  const c = CASES.find((x) => x.id === caseId)!;
  const l = tankLayers(c.level, c.water, DIMS);
  const fmt = (p: number, v: number) => `${p.toFixed(1)}% | ${v.toFixed(v < 1 ? 2 : 1)} m³`;

  return (
    <>
      <p className="text-sm text-fg-muted">
        Trang thật:{' '}
        <Link className="text-accent underline" to="/map/V-101">
          /map/V-101
        </Link>
        . Ảnh thiết kế: chỉ hiện trên máy dev (nếu có file trong thư mục ảnh tham chiếu).
      </p>
      <Demo title="TankCutawayDiagram + TankLayerList (lớp tính bằng tankLayers – tổng 100 %)" refImg={REF_ASSET_V101_DESIGN}>
        <SegmentedControl label="Ca thử" size="sm" options={CASES} value={caseId} onChange={(id) => setCaseId(id as typeof caseId)} />
        <div className="grid max-w-[760px] gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="rounded-lg border border-line/30 bg-surface-sunken/40 p-3">
            <TankCutawayDiagram
              length={DIMS.length}
              diameter={DIMS.diameter}
              state="lost"
              layers={
                l && {
                  levelPct: l.levelPct,
                  waterPct: l.waterPct,
                  lpgPercent: l.lpg.percent,
                  vaporPercent: l.vapor.percent,
                  waterPercent: l.water.percent,
                }
              }
            />
          </div>
          <TankLayerList
            items={[
              { id: 'lpg', label: 'LPG lỏng', value: l ? fmt(l.lpg.percent, l.lpg.volume) : 'Mất tín hiệu', tone: l ? 'info' : 'muted' },
              {
                id: 'vapor',
                label: 'Pha hơi / khí gas',
                value: l ? fmt(l.vapor.percent, l.vapor.volume) : 'Mất tín hiệu',
                tone: l ? 'neutral' : 'muted',
              },
              { id: 'water', label: 'Nước đáy bồn', value: l ? fmt(l.water.percent, l.water.volume) : 'Mất tín hiệu', tone: l ? 'warning' : 'muted' },
              { id: 'status', label: 'Trạng thái', value: 'Bình thường', tone: 'success' },
            ]}
          />
        </div>
      </Demo>

      <Demo title="KpiCard dense (+ hint ⓘ, progress, mất tín hiệu) · StatusPill sm/neutral">
        <div className="grid max-w-[760px] auto-rows-[102px] grid-cols-3 gap-4">
          <KpiCard
            dense
            label="Mức bồn"
            hint="% thể tích toàn bộ chất lỏng"
            hintIcon
            value="78.2"
            unit="%"
            progress={{ value: 78.2, tone: 'info' }}
          />
          <KpiCard dense label="Áp suất" value="9.2" unit="bar" sub="Định mức: 12.0 bar" subTone="muted" />
          <KpiCard dense label="Nhiệt độ" value="28.6" unit="°C" signalLost />
        </div>
        <div className="flex flex-wrap gap-3">
          <StatusPill size="sm">Bình thường</StatusPill>
          <StatusPill size="sm" tone="warning">
            Cảnh báo
          </StatusPill>
          <StatusPill size="sm" tone="danger">
            Nguy hiểm
          </StatusPill>
          <StatusPill size="sm" tone="neutral">
            Mất tín hiệu
          </StatusPill>
        </div>
      </Demo>

      <Demo title="DonutGauge center · AlertItem inline · MaintenanceSummaryCard · icon tạm">
        <div className="grid max-w-[900px] gap-6 md:grid-cols-3">
          <DonutGauge
            size={132}
            ringWidth={10}
            hideLegend
            label="Tình trạng 98%"
            segments={[
              { id: 'a', label: 'Tốt', value: 98, tone: 'success' },
              { id: 'b', label: 'Còn lại', value: 2, tone: 'offline' },
            ]}
            center={{ value: '98%', caption: 'Tối ưu' }}
          />
          <div className="rounded-xl border border-line/30 bg-surface">
            <AlertItem layout="inline" id="1" code="ALT-1" message="Áp suất bồn V-101 vượt ngưỡng" time="10:45" severity="critical" />
            <AlertItem layout="inline" id="2" code="ALT-2" message="Kiểm tra định kỳ thành công" time="Hôm qua" severity="low" tone="success" />
            <AlertItem layout="inline" id="3" code="ALT-3" message="Cảnh báo mức cao (High Level)" time="20/10" severity="high" last />
          </div>
          <MaintenanceSummaryCard
            next={{ date: '19 Tháng 10, 2026', note: 'Quá hạn 4 ngày', overdue: true }}
            last={{ date: '7 Tháng 9, 2026' }}
            records={{ value: 100, status: 'Đầy đủ' }}
          />
        </div>
        <div className="flex items-center gap-4 text-fg-muted">
          <AlertCircleIcon /> <HistoryIcon /> <MapIcon /> <FocusIcon /> <InfoIcon />
          <span className="text-xs">AlertCircle · History · Map · Focus · Info</span>
        </div>
      </Demo>
    </>
  );
}
