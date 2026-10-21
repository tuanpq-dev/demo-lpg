import { useMemo, useState, type ReactNode } from 'react';
import {
  Badge,
  FilterBar,
  NavTabs,
  SearchInput,
  SegmentedControl,
  Select,
  Tabs,
  type FilterDef,
  type FilterValues,
  type NavTabItem,
  type Severity,
  type TabItem,
  type WorkStatus,
} from '@/components';
import { FigmaRef } from './FigmaRef';

const OVERVIEW = '/figma-ref/53-11-overview.png';
const ALERTS = '/figma-ref/70-2809-alerts.png';
const MAINT = '/figma-ref/70-3964-maintenance.png';

function Demo({ title, node, children }: { title: string; node: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h3 className="text-md font-semibold">{title}</h3>
        <span className="font-mono text-xs text-fg-muted/65">Figma {node}</span>
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-dashed border-line/30 p-4">{children}</div>
    </div>
  );
}

function StateLine({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs text-fg-muted/65">{children}</p>;
}

// ---------------- Dữ liệu mẫu (Figma) ----------------

const navItems: NavTabItem[] = [
  { id: 'overview', label: 'Tổng quan', icon: 'navOverview', activeIcon: 'navOverviewActive' },
  { id: 'map', label: 'Bản đồ nội khu', icon: 'navMap' },
  { id: 'operation', label: 'Vận hành', icon: 'navOperation', disabled: true, hasSubmenu: true },
  { id: 'alerts', label: 'Cảnh báo', icon: 'navAlert', activeIcon: 'navAlertActive', count: 2 },
  { id: 'maintenance', label: 'Bảo trì', icon: 'navMaintenance', activeIcon: 'navMaintenanceActive' },
  { id: 'report', label: 'Báo cáo', icon: 'navReport' },
];

const mapViews = [
  { id: 'all', label: 'Toàn cảnh' },
  { id: 'tanks', label: 'Bồn chứa' },
  { id: 'pumps', label: 'Bơm & Lọc' },
];

type Alert = {
  time: string;
  severity: Severity;
  code: string;
  text: string;
  device: string;
  area: string;
  status: WorkStatus;
};

const alerts: Alert[] = [
  { time: '10:45:22', severity: 'critical', code: 'ALT-00128', text: 'Áp suất bồn V-101 vượt ngưỡng', device: 'V-101', area: 'Bồn chứa', status: 'unacknowledged' },
  { time: '09:12:05', severity: 'high', code: 'ALT-00127', text: 'Cảnh báo rò rỉ Gas nhẹ', device: 'GS-04', area: 'Khu nạp xuất', status: 'in-progress' },
  { time: '08:45:10', severity: 'high', code: 'ALT-00126', text: 'Nhiệt độ máy hóa hơi thấp', device: 'E-101A', area: 'Trạm hóa hơi', status: 'unacknowledged' },
  { time: '08:10:00', severity: 'medium', code: 'ALT-00125', text: 'Chênh áp lọc cao', device: 'F-201', area: 'Khu Lọc', status: 'in-progress' },
  { time: '07:30:22', severity: 'low', code: 'ALT-00124', text: 'Cảnh báo lưu lượng thấp', device: 'FT-101', area: 'Tuyến chính', status: 'done' },
];

const uniq = (xs: string[]) => [...new Set(xs)].map((v) => ({ value: v, label: v }));

const filterDefs: FilterDef[] = [
  { id: 'area', label: 'Khu vực', allLabel: 'Tất cả khu vực', options: uniq(alerts.map((a) => a.area)) },
  {
    id: 'severity',
    label: 'Mức độ',
    options: [
      { value: 'critical', label: 'Nghiêm trọng' },
      { value: 'high', label: 'Cao' },
      { value: 'medium', label: 'Trung bình' },
      { value: 'low', label: 'Thấp' },
    ],
  },
  {
    id: 'status',
    label: 'Trạng thái',
    options: [
      { value: 'unacknowledged', label: 'Chưa xác nhận' },
      { value: 'in-progress', label: 'Đang xử lý' },
      { value: 'done', label: 'Đã hoàn thành' },
    ],
  },
  { id: 'device', label: 'Thiết bị', options: uniq(alerts.map((a) => a.device)) },
];

const maintTabs: TabItem[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ tiếp nhận', count: 12 },
  { id: 'assigned', label: 'Đã phân công' },
  { id: 'doing', label: 'Đang thực hiện', count: 18, countTone: 'info' },
  { id: 'review', label: 'Chờ nghiệm thu' },
  { id: 'done', label: 'Hoàn thành' },
  { id: 'overdue', label: 'Quá hạn', count: 5, countTone: 'danger' },
];

// ---------------- Section ----------------

export function NavigationSection() {
  const [nav, setNav] = useState('overview');
  const [mapView, setMapView] = useState('all');
  const [maintTab, setMaintTab] = useState('all');
  const [soloSearch, setSoloSearch] = useState('');
  const [soloSelect, setSoloSelect] = useState<string | null>(null);

  // FilterBar + Tabs lọc thật trên dữ liệu cảnh báo
  const [alertTab, setAlertTab] = useState<'all' | WorkStatus>('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({});
  const [advanced, setAdvanced] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter(
      (a) =>
        (alertTab === 'all' || a.status === alertTab) &&
        (!q || [a.text, a.code, a.device, a.area].some((s) => s.toLowerCase().includes(q))) &&
        (!filters.area || a.area === filters.area) &&
        (!filters.severity || a.severity === filters.severity) &&
        (!filters.status || a.status === filters.status) &&
        (!filters.device || a.device === filters.device),
    );
  }, [alertTab, search, filters]);

  const countBy = (s: WorkStatus) => alerts.filter((a) => a.status === s).length;
  const alertTabs: TabItem[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'unacknowledged', label: 'Chưa xác nhận', count: countBy('unacknowledged'), countTone: 'danger' },
    { id: 'in-progress', label: 'Đang xử lý', count: countBy('in-progress'), countTone: 'info' },
    { id: 'done', label: 'Đã hoàn thành', count: countBy('done') },
  ];

  return (
    <div className="flex flex-col gap-10">
      <Demo title="NavTabs" node="53:23">
        <div className="overflow-x-auto rounded-md bg-bg-header px-6 py-2.5">
          <NavTabs items={navItems} value={nav} onChange={setNav} />
        </div>
        <StateLine>value = &quot;{nav}&quot; · ←/→ di chuyển, Enter chọn · &quot;Vận hành&quot; disabled</StateLine>
        <FigmaRef src={OVERVIEW} x={270} y={0} w={950} h={60} caption="Figma – active: Tổng quan" />
        <FigmaRef src={ALERTS} x={270} y={0} w={950} h={60} caption="Figma – active: Cảnh báo" />
      </Demo>

      <Demo title="SegmentedControl" node="53:302">
        <SegmentedControl label="Chế độ xem bản đồ" options={mapViews} value={mapView} onChange={setMapView} />
        <StateLine>value = &quot;{mapView}&quot;</StateLine>
        <FigmaRef src={OVERVIEW} x={47} y={313} w={280} h={38} />
      </Demo>

      <Demo title="Tabs" node="70:3006 · 70:5311">
        <Tabs label="Lọc yêu cầu bảo trì" items={maintTabs} value={maintTab} onChange={setMaintTab} />
        <StateLine>value = &quot;{maintTab}&quot; · count tone: neutral / info / danger</StateLine>
        <FigmaRef src={MAINT} x={32} y={620.5} w={1130} h={55} />
      </Demo>

      <Demo title="SearchInput & Select" node="70:3016 · 65:1602">
        <div className="flex flex-wrap items-start gap-3">
          <SearchInput value={soloSearch} onChange={setSoloSearch} placeholder="Tìm kiếm sự kiện, mã thiết bị..." className="w-[360px]" />
          <Select label="Khu vực" allLabel="Tất cả khu vực" options={filterDefs[0].options} value={soloSelect} onChange={setSoloSelect} />
          <Select label="Mức độ" options={filterDefs[1].options} value={null} onChange={() => undefined} disabled />
        </div>
        <StateLine>
          search = &quot;{soloSearch}&quot; · khu vực = {soloSelect === null ? 'null' : `"${soloSelect}"`} · Esc xoá ô tìm kiếm / đóng menu
        </StateLine>
      </Demo>

      <Demo title="FilterBar + Tabs (lọc thật)" node="70:3015 · 70:3006">
        <div className="overflow-visible rounded-lg border border-line/30 bg-surface shadow-card">
          <Tabs label="Lọc cảnh báo theo trạng thái" items={alertTabs} value={alertTab} onChange={(v) => setAlertTab(v as typeof alertTab)} />
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            filters={filterDefs}
            values={filters}
            onValuesChange={setFilters}
            onAdvancedFilter={() => setAdvanced((v) => !v)}
            advancedActive={advanced}
          />
          <ul className="divide-y divide-line/10">
            {filtered.map((a) => (
              <li key={a.code} className="grid grid-cols-[72px_100px_80px_1fr_64px_110px_110px] items-center gap-3 px-4 py-3 text-sm">
                <span className="text-fg-secondary">{a.time}</span>
                <Badge variant="severity" value={a.severity} />
                <span className="text-fg-secondary">{a.code}</span>
                <span className="truncate">{a.text}</span>
                <span className="text-info">{a.device}</span>
                <span className="text-fg-secondary">{a.area}</span>
                <Badge variant="status" value={a.status} />
              </li>
            ))}
            {filtered.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-muted/65">Không có cảnh báo phù hợp.</li>}
          </ul>
        </div>
        <StateLine>
          {filtered.length}/{alerts.length} cảnh báo · tab = &quot;{alertTab}&quot; · filters = {JSON.stringify(filters)} · advanced = {String(advanced)}
        </StateLine>
        <FigmaRef src={ALERTS} x={34.5} y={474} w={1496} h={108} caption="Figma – Tabs + Filters (70:3006, 70:3015)" />
      </Demo>
    </div>
  );
}
