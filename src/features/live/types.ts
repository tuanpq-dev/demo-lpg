/*
 * Hợp đồng dữ liệu trực tiếp (live) – độc lập nguồn: mock hôm nay, WebSocket/SCADA (OPC UA, MQTT…) sau này.
 * UI chỉ dùng các kiểu này + `signal.ts`; đổi nguồn = viết một LiveDataSource mới, không sửa UI.
 * Module thuần (không React/three).
 */

/** Chất lượng tín hiệu theo chuẩn OPC (Good / Uncertain / Bad). */
export type TagQuality = 'good' | 'uncertain' | 'bad';

/** Giá trị đo hoặc trạng thái (chuỗi: "running", "fault"…). */
export type LiveValue = number | string;

export type TagValue = {
  value: LiveValue;
  unit?: string;
  /** Thời điểm đo (ms epoch) – dùng để phát hiện tín hiệu "đứng" (quá STALE_MS không cập nhật). */
  ts: number;
  quality: TagQuality;
};

/** Số liệu theo tag cảm biến. Tag không có trong map = chưa/không có dữ liệu. */
export type LiveData = Record<string, TagValue>;

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
  readonly status: LiveSourceStatus;
  /** Nghe đổi trạng thái kết nối (header "Dữ liệu trực tiếp"). Trả về hàm huỷ. */
  onStatusChange(cb: (status: LiveSourceStatus) => void): () => void;
}
