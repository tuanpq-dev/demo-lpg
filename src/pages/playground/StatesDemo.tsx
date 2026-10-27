import { AssetRow, Button, Card, KpiCard, MapMarker } from '@/components';
import { Placeholder } from '@/app/Placeholder';
import { Demo } from './Demo';

/**
 * Trạng thái dùng chung giữa các trang: loading (Placeholder) · lỗi (Card danger + "Thử lại") · mất tín hiệu số liệu
 * trực tiếp (KPI, dòng theo dõi, nhãn bản đồ). Drawer chi tiết cảnh báo: mục 15.
 */
export function StatesDemo() {
  return (
    <Demo title="Trạng thái: loading · lỗi · mất tín hiệu" node="— (dựng theo token)">
      <div className="grid w-[1100px] grid-cols-3 gap-4">
        <Placeholder label="Đang tải…" height={128} />
        <Card title="Không tải được dữ liệu" headerVariant="plain" tone="danger">
          <p className="mb-3 text-base text-fg-secondary">Mất kết nối tới máy chủ.</p>
          <Button className="self-start">Thử lại</Button>
        </Card>
        <KpiCard label="Mức bồn V-101 (mất tín hiệu)" value="76.02" unit="%" signalLost />
      </div>
      <div className="flex w-[1100px] items-start gap-6">
        <div className="flex w-[326px] flex-col gap-2">
          <AssetRow id="v-101" name="V-101" statusLabel="Ổn định" tone="success" />
          <AssetRow id="pr-101" name="PR-101" statusLabel="Mất tín hiệu" tone="offline" signalLost />
        </div>
        <div className="relative h-[90px] w-[300px] rounded-lg bg-bg-canvas">
          <MapMarker id="ft" variant="callout" tone="neutral" title="FT-101" value="Mất tín hiệu" showSignalLostIcon x={0.5} y={0.95} />
        </div>
      </div>
    </Demo>
  );
}
