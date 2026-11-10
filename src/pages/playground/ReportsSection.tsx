import { useState } from 'react';
import { ActionItemList, Card, FilterBar, KpiCard, MetricListCard, ScheduleList, type ActionItemData } from '@/components';
import { CompletionBadge, SignatureBadge } from '@/pages/reports/shared/ReportBadges';
import { Demo } from './Demo';

/** Ảnh thiết kế chỉ ở máy dev (`scratch/figma-ref/`, gitignore); bản build: undefined (không đóng gói). */
const REF = (name: string) => (import.meta.env.DEV ? `/scratch/figma-ref/${name}` : undefined);

const ACTIONS: ActionItemData[] = [
  { id: 'a1', tone: 'danger', subject: 'BCVH-N-24062026', message: 'Thiếu mốc 18:00' },
  { id: 'a2', tone: 'danger', subject: 'BCVH-N-20062026', message: 'Bị trả lại' },
  { id: 'a3', tone: 'warning', subject: 'Dữ liệu 14:00', message: 'Cần xác minh' },
];

/** Mục 18 – component dùng chung màn Báo cáo (ảnh thiết kế, chưa có node Figma). */
export function ReportsSection() {
  const [clicked, setClicked] = useState('');
  const [q, setQ] = useState('');
  const [values, setValues] = useState<Record<string, string | null>>({ status: null });
  return (
    <>
      <Demo title="KpiCard compact dense outlined – 5 tone" refImg={REF('reports-kpi.png')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard variant="compact" dense outlined label="Tổng báo cáo" value={186} sub="Ngày, tháng, quý và năm" subTone="muted" />
          <KpiCard
            variant="compact"
            dense
            outlined
            tone="primary"
            label="Đang thực hiện"
            value={4}
            sub="Còn thiếu mốc hoặc chưa hoàn tất"
            subTone="muted"
          />
          <KpiCard variant="compact" dense outlined tone="warning" label="Chờ xác nhận" value={6} sub="Chờ một hoặc nhiều chữ ký" subTone="muted" />
          <KpiCard variant="compact" dense outlined tone="success" label="Đã ký đầy đủ" value={168} sub="Đã hoàn thành quy trình" subTone="muted" />
          <KpiCard
            variant="compact"
            dense
            outlined
            tone="danger"
            label="Có dữ liệu thiếu"
            value={8}
            sub="Cần kiểm tra hoặc bổ sung"
            subTone="muted"
          />
        </div>
      </Demo>

      <Demo title="MetricListCard · ScheduleList · ActionItemList" refImg={REF('reports-summary-cards.png')}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MetricListCard
            title="Chờ xác nhận"
            count={{ value: 6, tone: 'warning', label: 'báo cáo chờ xác nhận' }}
            rows={[
              { id: 'i', label: 'Người kiểm tra (Inspector)', value: 2 },
              { id: 'a', label: 'Người duyệt (Approver)', value: 2 },
              { id: 't', label: 'Ban TAP (TAP)', value: 2 },
            ]}
            action={{ label: 'Xem tất cả', onClick: () => setClicked('Xem tất cả') }}
          />
          <MetricListCard
            title="Tiến độ tháng 06"
            progress={{ label: 'Hoàn thành', value: 19, max: 24, valueText: '19/24 ngày' }}
            rows={[
              { id: 'p', label: 'Đang thực hiện', value: 1 },
              { id: 'm', label: 'Thiếu dữ liệu', value: 2, tone: 'danger' },
              { id: 's', label: 'Chờ chữ ký', value: 2, tone: 'warning' },
            ]}
          />
          <Card title="Lịch báo cáo sắp tới" radius="lg">
            <ScheduleList
              items={[
                { id: 'w', date: '2026-06-26', weekday: 'T6', day: '26', title: 'Báo cáo tuần 4 - Tháng 6', meta: 'Hạn chót: 17:00' },
                { id: 'm', date: '2026-06-30', weekday: 'T3', day: '30', title: 'Báo cáo tháng 6', meta: 'Hạn chót: 12:00' },
                { id: 'q', date: '2026-06-30', weekday: 'T3', day: '30', title: 'Báo cáo quý 2', meta: 'Hạn chót: 17:00' },
              ]}
            />
          </Card>
          <Card title="Cần xử lý hôm nay" radius="lg">
            <ActionItemList items={ACTIONS} onAction={(id) => setClicked(`Xử lý ngay ${id}`)} />
          </Card>
        </div>
        <p role="status" className="text-sm text-fg-secondary">
          {clicked ? `Đã bấm: ${clicked}` : 'Bấm link để thử callback.'}
        </p>
      </Demo>

      <Demo title="Badge trạng thái báo cáo + FilterBar inline (Xóa bộ lọc)" refImg={REF('reports-table.png')}>
        <div className="flex flex-wrap items-center gap-3">
          <CompletionBadge status="in-progress" />
          <CompletionBadge status="done" />
          <CompletionBadge status="missing-data" />
          <SignatureBadge status="not-sent" />
          <SignatureBadge status="pending" />
          <SignatureBadge status="signed" />
          <SignatureBadge status="rejected" />
        </div>
        <FilterBar
          layout="inline"
          search={q}
          onSearchChange={setQ}
          searchPlaceholder="Mã báo cáo, ngày, người kiểm tra..."
          filters={[{ id: 'status', label: 'Trạng thái hoàn thành', allLabel: 'Tất cả', options: [{ value: 'done', label: 'Hoàn thành' }] }]}
          values={values}
          onValuesChange={setValues}
          onClear={() => {
            setQ('');
            setValues({ status: null });
          }}
          clearDisabled={!q && !values.status}
        />
      </Demo>
    </>
  );
}
