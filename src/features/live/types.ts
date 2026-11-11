/*
 * Hợp đồng dữ liệu trực tiếp (live) – độc lập nguồn: mock hôm nay, WebSocket/SCADA (OPC UA, MQTT…) sau này.
 * UI chỉ dùng các kiểu này + `signal.ts`; đổi nguồn = viết một LiveDataSource mới, không sửa UI.
 * Module thuần (không React/three).
 */

/** Kiểu dữ liệu tag dùng chung FE/BE – định nghĩa ở `packages/shared/src/live.ts` (kèm schema zod cho BE). */
export type { LiveData, LiveValue, TagQuality, TagValue } from '@demo-lpg/shared/live';
import type { LiveData } from '@demo-lpg/shared/live';

/** Trạng thái kết nối của nguồn: connecting = đang kết nối (lần đầu hoặc thử lại sau khi mất). */
export type LiveSourceStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * Nguồn dữ liệu trực tiếp. Bản hiện tại: `MockLiveSource` (src/data/live/MockLiveSource.ts).
 * Khi có backend: viết `WebSocketLiveSource` cùng interface rồi đổi `liveSource` trong src/data/live/index.ts.
 */
export interface LiveDataSource {
  /**
   * Nhận số liệu của `tags` (null = mọi tag): gọi `cb` với ảnh chụp mới mỗi khi có cập nhật.
   * Trả về hàm huỷ đăng ký.
   */
  subscribe(tags: readonly string[] | null, cb: (data: LiveData) => void): () => void;
  /** Ảnh chụp hiện tại một lần (vd nạp ban đầu, xuất báo cáo). */
  getSnapshot(tags: readonly string[] | null): Promise<LiveData>;
  /**
   * Ảnh chụp ĐỒNG BỘ đang có trong bộ nhớ (chỉ khi đã kết nối; chưa có → undefined). Hook dùng làm giá trị khởi tạo để
   * trang mới mở hiện ngay số đang có thay vì "—" một khung rồi mới có số (nháy khi chuyển trang).
   */
  peek(tags: readonly string[] | null): LiveData | undefined;
  readonly status: LiveSourceStatus;
  /**
   * Nghe đổi trạng thái kết nối (header "Dữ liệu trực tiếp"). Trả về hàm huỷ.
   * Hết người nghe (subscribe + onStatusChange) → nguồn được phép ngắt, nhưng PHẢI chờ một khoảng (chuyển trang gỡ trang cũ
   * trước khi gắn trang mới) – ngắt ngay sẽ kết nối lại mỗi lần đổi trang.
   */
  onStatusChange(cb: (status: LiveSourceStatus) => void): () => void;
}
