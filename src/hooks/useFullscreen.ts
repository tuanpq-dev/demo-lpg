import { useEffect, useState, type RefObject } from 'react';

/** Bật/tắt toàn màn hình cho phần tử `ref` (Fullscreen API); `isFullscreen` theo dõi cả khi thoát bằng Esc. */
export function useFullscreen(ref: RefObject<HTMLElement>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [ref]);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen?.();
  };
  return { isFullscreen, toggle };
}
