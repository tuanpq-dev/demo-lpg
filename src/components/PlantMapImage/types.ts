/** Kiểu props của PlantMap (2.5D ảnh / 3D). */
import type { ReactNode } from 'react';
import type { LiveData, SceneConfig, SceneQuality } from '@/features/scene';
import type { ImageAsset } from '@/lib/imageAsset';
import type { MapMarkerData } from './MapMarker';

/** Chế độ xem của renderer ảnh: điểm cần căn giữa (phân số của ảnh) và mức zoom; bỏ trống = toàn cảnh. */
export type MapView = {
  id: string;
  label: string;
  focus?: { x: number; y: number; zoom: number };
};

export type CommonProps = {
  alt: string;
  /** Ảnh: id marker · 3D: id object (click object hoặc nhãn của nó). */
  onSelect?: (id: string) => void;
  /** Có → hiện nút chuyển 2.5D/3D nhỏ ở góc dưới trái; trang tự đổi renderer (vd. qua `?map=3d`). */
  onRendererChange?: (renderer: PlantMapRenderer) => void;
  /** Chiều cao khung (px). Figma 591 (gồm viền). */
  height?: number;
  /** Thông báo nhỏ ở góc dưới trái (vd. "3D không khả dụng – đang hiện 2.5D"). */
  notice?: ReactNode;
  className?: string;
};

export type PlantMapRenderer = 'image' | 'three';

export type PlantMapImageProps = CommonProps & {
  renderer?: 'image';
  /** Ảnh 2.5D: URL hoặc ImageAsset (srcSet AVIF/WebP + kích thước gốc). */
  image: string | ImageAsset;
  /** Marker đặt theo toạ độ % trên ảnh. */
  markers: readonly MapMarkerData[];
  views: readonly MapView[];
  view: string;
  onViewChange: (id: string) => void;
  /** Tỉ lệ rộng/cao của ảnh gốc (mặc định 2730/1536). */
  imageAspect?: number;
  /**
   * Khung ảnh như Figma 53:244: ảnh rộng 112.3% khung, căn giữa ngang,
   * tâm dọc ở 45% chiều cao ảnh.
   */
  framing?: { widthScale: number; centerY: number };
};

export type PlantMapThreeProps = CommonProps & {
  renderer: 'three';
  /** Cảnh đã nạp + validate (trang dùng `useSceneConfig` hoặc `ConnectedPlantMap`). Views + nhãn lấy từ cảnh. */
  scene: SceneConfig;
  /** Số liệu theo tag – nhãn/màu cập nhật theo `bindings` của object. */
  liveData?: LiveData;
  /** Chế độ sửa (dev, vd `?edit=1`): click chọn → kéo/xoay (snap 0.5 m / 15°), nút "Copy JSON". Chưa lưu. */
  editable?: boolean;
  /** Preset chất lượng 3D; mặc định 'auto' (PerformanceMonitor). Trang có thể ghi đè (vd. `?quality=low`). */
  quality?: SceneQuality | 'auto';
  /**
   * WebGL không khả dụng/lỗi → gọi kèm lý do; trang chuyển sang ảnh 2.5D (+ `notice`).
   * Không truyền → hiện thông báo ngay trong khung bản đồ.
   */
  onFallback?: (reason: string) => void;
  /**
   * Id object cần nhắm khi mở (vd `?focus=V-101` ở Tổng quan): thêm chế độ xem "<nhãn object>" (bay vừa khít object)
   * và chọn sẵn. Id không có trong cảnh → bỏ qua.
   */
  focus?: string;
};

export type PlantMapProps = PlantMapImageProps | PlantMapThreeProps;
