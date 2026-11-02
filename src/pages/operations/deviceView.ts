import type { DeviceAlerts, DeviceMaintenanceView } from '@/data/operationDevice';
import type { LiveSourceStatus, TagValue } from '@/features/live/types';

/** Props chung của phần nội dung theo loại thiết bị (VaporizerView, PlcScadaView). */
export type DeviceViewProps<D> = {
  data: D;
  liveData: Readonly<Record<string, TagValue>> | undefined;
  /** Mỗi giây (cột "Cập nhật", mốc mất tín hiệu 10 s). */
  nowDate: Date;
  liveStatus: LiveSourceStatus;
  alerts: DeviceAlerts;
  alertsState: { status: 'loading' | 'error' | 'success' };
  mt: DeviceMaintenanceView;
  maintenanceState: { status: 'loading' | 'error' | 'success' };
};
