import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_OPERATION_DEVICE, operationDevicePath } from '@/app/assetRoutes';
import { RefreshButton } from '@/app/HeaderActions';
import { Page } from '@/app/Page';
import { pageFallback, Placeholder } from '@/app/Placeholder';
import { Button, CpuIcon, InfoChip, InfoIcon, MapPinIcon, PageHeader, Select, StableWidth, StatusPill } from '@/components';
import { deriveMaintenanceSummary } from '@/data/assetDetail';
import { useLiveStatus } from '@/data/live';
import { useMaintenance } from '@/data/maintenance';
import {
  OPERATION_DEVICE_IDS,
  OPERATION_DEVICE_OPTIONS,
  deriveDeviceAlerts,
  deriveDeviceMaintenance,
  resolveOperationDeviceId,
  useOperationDevice,
} from '@/data/operationDevice';
import { connectionView, HEADER_RUN_LABELS, PLC_CONNECTION_LABELS } from '@/features/operations/device';
import { useNow } from '@/lib/useNow';
import NotFoundPage from '../errors/NotFoundPage';
import { PlcScadaView, plcHeaderStatus } from './PlcScadaView';
import { VaporizerView, vaporizerRun } from './VaporizerView';

const BREADCRUMB_BASE = [{ label: 'Vận hành' }, { label: 'Giám sát thiết bị' }];

/**
 * Route `/operations/devices/:deviceId` (menu "Vận hành"): chuẩn hoá mã (`e-101a` → `E-101A`, giữ query) rồi tải trang;
 * mã lạ → "Không tìm thấy thiết bị".
 */
export default function DeviceDetailRoute() {
  const { deviceId: raw = '' } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const id = resolveOperationDeviceId(raw);
  if (!id) {
    return (
      <NotFoundPage
        title="Không tìm thấy thiết bị"
        breadcrumb={[...BREADCRUMB_BASE, { label: raw || '—' }]}
        message={`Chưa có trang giám sát cho "${raw}". Thiết bị đang có: ${OPERATION_DEVICE_IDS.join(', ')}.`}
        actions={<Button onClick={() => void navigate(operationDevicePath(DEFAULT_OPERATION_DEVICE))}>Mở {DEFAULT_OPERATION_DEVICE}</Button>}
      />
    );
  }
  if (id !== raw) return <Navigate to={`${operationDevicePath(id)}${search}`} replace />;
  return <DeviceDetailPage deviceId={id} />;
}

/**
 * Chi tiết thiết bị – màn Vận hành. Khung chung: header (tên / khu / trạng thái / làm mới / PLC), 3 trạng thái tải; nội dung
 * theo loại: máy hóa hơi (`VaporizerView`, ảnh op-device-*.png) · hệ thống PLC/SCADA (`PlcScadaView`, Figma bản sao 168:4689).
 * Mọi số đo đọc tag trực tiếp (mất tín hiệu → xám, không số cũ); cảnh báo / bảo trì từ store chung.
 */
function DeviceDetailPage({ deviceId }: { deviceId: string }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  // Mỗi giây: cột "Cập nhật", mốc mất tín hiệu 10 s.
  const nowDate = useNow(1000);
  const now = nowDate.getTime();
  const { status, data, error, refetch, liveData, alerts } = useOperationDevice(deviceId);
  const maintenance = useMaintenance();
  const liveStatus = useLiveStatus();
  const conn = connectionView(liveStatus);

  const run = !data ? undefined : data.kind === 'vaporizer' ? vaporizerRun(data, liveData, now) : plcHeaderStatus(data, liveData, now);
  const runLabel = !run ? '' : 'headerLabel' in run ? run.headerLabel : run.label;

  const header = (
    <PageHeader
      breadcrumb={[...BREADCRUMB_BASE, { label: `Chi tiết thiết bị - ${deviceId}` }]}
      title="Chi tiết thiết bị"
      // Đổi thiết bị (chưa có màn danh sách "Giám sát thiết bị" – docs/questions.md 13.5): cạnh tiêu đề để KHÔNG xô vị trí khi
      // chip Tên/Khu vực đổi độ rộng theo thiết bị; giữ query.
      titleEnd={
        <Select
          variant="filter"
          label="Thiết bị"
          // Bề rộng cố định (vừa "Thiết bị ( PLC-SCADA )") – ô không co/giãn khi đổi thiết bị.
          fullWidth
          className="w-[200px]"
          options={OPERATION_DEVICE_OPTIONS}
          value={deviceId}
          onChange={(id) => {
            if (id && id !== deviceId) void navigate(`${operationDevicePath(id)}${search}`);
          }}
        />
      }
      // TODO: đổi sang `actionItems` (gom Tên/Khu vực/PLC vào "Thêm" < md) khi nhánh fix/header-mobile vào main.
      actions={
        <>
          {/* Chống layout shift khi dữ liệu về: luôn hiện đủ chip (đang tải → "—"); Tên / Khu vực bề rộng cố định (< md cả dòng,
              từ md 240px, dài thì cắt "…") – độ dài tên không đổi số dòng header; trạng thái / PLC rộng bằng nhãn dài nhất. */}
          <InfoChip icon={<InfoIcon size={16} />} label="Tên" value={data?.name ?? '—'} className="w-full md:w-60" />
          <InfoChip icon={<MapPinIcon />} label="Khu vực" value={data?.area ?? '—'} className="w-full md:w-60" />
          <StatusPill tone={run?.tone ?? 'neutral'}>
            Trạng thái: <StableWidth candidates={HEADER_RUN_LABELS}>{run ? runLabel : '—'}</StableWidth>
          </StatusPill>
          <RefreshButton accent onClick={refetch} />
          <InfoChip
            icon={<CpuIcon />}
            label="PLC"
            value={<StableWidth candidates={PLC_CONNECTION_LABELS}>{conn.plc}</StableWidth>}
            tone={conn.tone === 'neutral' ? 'muted' : conn.tone}
          />
        </>
      }
    />
  );

  if (status !== 'success') {
    return pageFallback(
      { status, error, refetch },
      {
        header,
        errorTitle: 'Không tải được thiết bị',
        errorActions: <Button onClick={() => void navigate('/overview')}>Về Tổng quan</Button>,
        skeleton: (
          <div className="reveal-delayed flex flex-col gap-6">
            <Placeholder label="Đang tải…" height={120} />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Placeholder label="Đang tải…" height={720} />
              <Placeholder label="Đang tải…" height={720} />
            </div>
          </div>
        ),
      },
    );
  }

  const deviceAlerts = deriveDeviceAlerts(alerts.data ?? [], data.relatedDevices, nowDate, 3, data.relatedKinds);
  const mt = deriveDeviceMaintenance(deriveMaintenanceSummary(maintenance.data ?? [], data.id, nowDate));
  const common = { liveData, nowDate, liveStatus, alerts: deviceAlerts, alertsState: alerts, mt, maintenanceState: maintenance };

  return (
    <Page pageHeader={header}>
      {data.kind === 'vaporizer' ? <VaporizerView data={data} {...common} /> : <PlcScadaView data={data} {...common} />}
    </Page>
  );
}
