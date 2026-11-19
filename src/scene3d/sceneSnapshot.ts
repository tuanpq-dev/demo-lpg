import { useState } from 'react';

/**
 * Ảnh khung hình đầu của cảnh 3D, theo mã cảnh, giữ trong bộ nhớ (mất khi tải lại trang).
 * Rời trang rồi quay lại → canvas WebGL tạo mới, phải biên dịch shader + vẽ lại từ đầu. Lớp chờ hiện ngay ảnh này thay cho
 * vòng xoay rồi mờ sang canvas khi vẽ xong → mô hình không còn "biến mất → Đang tải… → hiện lại" (nháy).
 * Chỉ dùng cho cảnh XEM ở camera mặc định (không Editor, không `view`) – ảnh khớp đúng khung đầu của lần mở sau.
 */
const shots = new Map<string, string>();
/** Thu hồi URL ảnh cũ sau khoảng này (lớp chờ đã mờ hết từ lâu). */
const REVOKE_DELAY_MS = 10_000;

export const sceneSnapshot = (sceneId: string): string | undefined => shots.get(sceneId);

/**
 * Chụp canvas WebGL. PHẢI gọi trong cùng khung hình vừa vẽ (vd microtask từ `useFrame`) – sau đó trình duyệt xoá
 * drawing buffer (không bật `preserveDrawingBuffer`). `toBlob` lấy điểm ảnh ngay lúc gọi, nén ngoài luồng chính.
 */
export function captureSceneSnapshot(sceneId: string, canvas: HTMLCanvasElement) {
  try {
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const prev = shots.get(sceneId);
        shots.set(sceneId, URL.createObjectURL(blob));
        // Ảnh cũ có thể vẫn nằm trong lớp chờ đang mờ dần → thu hồi trễ (tránh rò bộ nhớ khi mở lại nhiều lần).
        if (prev) window.setTimeout(() => URL.revokeObjectURL(prev), REVOKE_DELAY_MS);
      },
      'image/webp',
      0.85,
    );
  } catch {
    // Canvas không đọc được (trình duyệt chặn) → lần sau vẫn dùng vòng xoay.
  }
}

/**
 * Cho SceneViewer: `snapshot` = ảnh lần vẽ trước (đọc MỘT lần lúc gắn) cho lớp chờ; `onCapture` = chụp lại khi lần này vẽ
 * xong. Đang sửa (Editor) hoặc có `view` (camera bay tới chế độ xem) → không dùng ảnh (khung đầu không cố định).
 */
export function useSceneSnapshot(id: string, { edit, view }: { edit?: unknown; view?: unknown }) {
  const sceneId = edit || view ? undefined : id;
  const [snapshot] = useState(() => (sceneId ? sceneSnapshot(sceneId) : undefined));
  const onCapture = sceneId ? (canvas: HTMLCanvasElement) => captureSceneSnapshot(sceneId, canvas) : undefined;
  return { snapshot, onCapture };
}
