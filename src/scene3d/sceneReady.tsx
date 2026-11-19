import { PerformanceMonitor } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';

/** Số khung hình đã vẽ trước khi coi là sẵn sàng: camera canh khung (effect theo kích thước) + nhãn Html đã đặt vị trí. */
const READY_FRAMES = 3;
/** Lưới an toàn: quá thời gian này vẫn hiện cảnh (vd tab ẩn – trình duyệt ngừng vẽ). */
const READY_TIMEOUT_MS = 5000;
/** Chờ sau khi hiện cảnh rồi mới đo FPS: khung đầu chậm do biên dịch shader → không hạ chất lượng oan (gây tắt đen). */
const MONITOR_DELAY_MS = 1500;

/**
 * Đặt CUỐI cây <Canvas>: nếu con nào còn suspend (nạp tài nguyên) thì component này cũng chưa chạy. Đếm khung đã vẽ
 * (frameloop "demand" → tự `invalidate`) rồi báo `onReady` MỘT lần.
 */
export function ReadySignal({ onReady, onCapture }: { onReady: () => void; onCapture?: (canvas: HTMLCanvasElement) => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const canvas = useThree((s) => s.gl.domElement);
  const capture = useRef(onCapture);
  capture.current = onCapture;
  const frames = useRef(0);
  const done = useRef(false);
  const fire = useRef(onReady);
  fire.current = onReady;
  // Hàm ổn định (tạo một lần) – dùng được làm dependency.
  const finish = useRef(() => {
    if (done.current) return;
    done.current = true;
    fire.current();
  }).current;
  useFrame(() => {
    if (done.current) return;
    frames.current += 1;
    if (frames.current < READY_FRAMES) {
      invalidate();
      return;
    }
    // Khung này vẽ SAU các useFrame → microtask chạy khi khung đã vẽ xong, trước khi trình duyệt xoá drawing buffer.
    const cb = capture.current;
    if (cb) queueMicrotask(() => cb(canvas));
    finish();
  });
  useEffect(() => {
    invalidate();
    const t = window.setTimeout(finish, READY_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [invalidate, finish]);
  return null;
}

/** `ready` = cảnh đã vẽ xong (ẩn lớp chờ) · `monitor` = được phép đo FPS để tự đổi preset chất lượng. */
export function useSceneReady() {
  const [ready, setReady] = useState(false);
  const [monitor, setMonitor] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setMonitor(true), MONITOR_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [ready]);
  return { ready, monitor, markReady: () => setReady(true) };
}

/**
 * Chất lượng 'auto': drei PerformanceMonitor hạ/nâng preset theo FPS – chỉ gắn khi `armed` (cảnh đã hiện + chờ ổn định).
 * Hạ khi < 48 FPS, nâng khi > 58 FPS (mục tiêu ≥ 50 FPS) – không phụ thuộc tần số quét màn hình.
 */
export function QualityMonitor({
  auto,
  armed,
  onStep,
  onFallback,
}: {
  auto: boolean;
  armed: boolean;
  onStep: (d: 1 | -1) => void;
  onFallback: () => void;
}) {
  if (!auto || !armed) return null;
  return (
    <PerformanceMonitor bounds={() => [48, 58]} onDecline={() => onStep(-1)} onIncline={() => onStep(1)} flipflops={3} onFallback={onFallback} />
  );
}
