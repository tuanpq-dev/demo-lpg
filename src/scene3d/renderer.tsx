import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WebGLRenderer, WebGLRenderTarget, type Material } from 'three';

/** Lưới an toàn: quá thời gian này vẫn cho vẽ (chunk hậu kỳ không về, driver không báo xong). */
const WARMUP_TIMEOUT_MS = 3000;

/**
 * Tạo renderer (giống mặc định của R3F). Không kiểm WebGL trước bằng context thử (tốn 70–400 ms lần đầu): tạo context
 * lỗi thì ném lỗi tiếng Việt, `WebGLErrorBoundary` bắt → `onWebGLError`.
 */
export function createRenderer(canvas: HTMLCanvasElement | OffscreenCanvas) {
  try {
    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    // Đọc log biên dịch sau mỗi lần link buộc main thread chờ GPU (chặn biên dịch song song) → chỉ bật khi dev.
    renderer.debug.checkShaderErrors = import.meta.env.DEV;
    return renderer;
  } catch {
    throw new Error('Trình duyệt không hỗ trợ WebGL.');
  }
}

/** frameloop của Canvas: 'never' tới khi shader biên dịch xong (ShaderWarmup gọi `markWarm`), sau đó theo `animated`. */
export function useWarmFrameloop(animated: boolean) {
  const [warm, setWarm] = useState(false);
  const markWarm = useCallback(() => setWarm(true), []);
  const running = animated ? 'always' : 'demand';
  return { frameloop: warm ? running : 'never', markWarm } as const;
}

/**
 * Biên dịch shader của cảnh TRƯỚC khung đầu (`gl.compile` + chờ KHR_parallel_shader_compile: GPU biên dịch song song,
 * main thread không chờ). Nơi gọi giữ Canvas ở frameloop 'never' (`useWarmFrameloop`) tới khi `onDone` – nếu vẽ ngay,
 * khung đầu biên dịch từng program nối tiếp và khoá main thread vài trăm ms.
 * - Đặt CUỐI cây Canvas (trước ReadySignal): mọi object / đèn đã gắn → đủ material và đúng số đèn.
 * - `offscreen` (preset có composer): cảnh vẽ vào render target của composer (không tone mapping, màu tuyến tính – biến
 *   thể shader khác khi vẽ thẳng ra màn hình) → biên dịch với một render target tạm, bắt đầu ngay không chờ chunk hậu kỳ.
 * - `hold`: chưa mở vòng vẽ dù đã biên dịch xong (composer chưa gắn – vẽ thẳng ra màn hình sẽ biên dịch thêm biến thể).
 * - Chưa phủ: shader đổ bóng (depth) và các pass hậu kỳ – vẫn biên dịch ở khung đầu.
 */
export function ShaderWarmup({ offscreen, hold, onDone }: { offscreen: boolean; hold: boolean; onDone: () => void }) {
  const get = useThree((s) => s.get);
  const frameloop = useThree((s) => s.frameloop);
  const invalidate = useThree((s) => s.invalidate);
  const [compiled, setCompiled] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const t = window.setTimeout(() => done.current(), WARMUP_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Một lần lúc gắn: preset đổi sau đó (tự hạ chất lượng) thì khung kế tiếp biên dịch như bình thường.
  useEffect(() => {
    const { gl, scene, camera } = get();
    const target = offscreen ? new WebGLRenderTarget(1, 1) : null;
    const prev = gl.getRenderTarget();
    let materials: Set<Material>;
    gl.setRenderTarget(target);
    try {
      materials = gl.compile(scene, camera);
    } catch {
      // Lỗi biên dịch không chặn cảnh: khung đầu biên dịch lại như bình thường.
      materials = new Set();
    } finally {
      gl.setRenderTarget(prev);
      target?.dispose();
    }
    // Tự chờ thay vì `compileAsync`: material bị thay / huỷ giữa chừng (Editor) không còn program → three ném lỗi trong
    // setTimeout và promise treo. Không có KHR_parallel_shader_compile thì isReady() luôn true → xong ngay.
    let timer = 0;
    const poll = () => {
      for (const m of materials) {
        const program = (gl.properties.get(m) as { currentProgram?: { isReady(): boolean } }).currentProgram;
        if (!program || program.isReady()) materials.delete(m);
      }
      if (materials.size === 0) setCompiled(true);
      else timer = window.setTimeout(poll, 10);
    };
    poll();
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Chỉ biên dịch trước cho khung đầu (xem trên).
  }, []);

  useEffect(() => {
    if (compiled && !hold) done.current();
  }, [compiled, hold]);

  // Ở frameloop 'demand', lời invalidate lúc gắn (ReadySignal…) bị bỏ qua khi còn 'never' → vẽ lại khi đã mở vòng vẽ.
  useEffect(() => {
    if (frameloop !== 'never') invalidate();
  }, [frameloop, invalidate]);
  return null;
}
