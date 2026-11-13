import { useEffect, useRef } from 'react';
import { useUnacknowledgedCount } from '@/data/alertApi';
import { useLiveStatus } from '@/data/live';
import { useAnnouncement } from '@/hooks/useAnnounce';
import { announce } from '@/lib/announce';

const STATUS_TEXT = {
  connected: 'Đã kết nối lại dữ liệu trực tiếp.',
  connecting: 'Đang kết nối lại dữ liệu trực tiếp…',
  disconnected: 'Mất kết nối dữ liệu trực tiếp.',
} as const;

/**
 * Vùng thông báo `aria-live="polite"` (ẩn) cho mọi trang: đổi trạng thái nguồn dữ liệu trực tiếp (bỏ qua lần kết nối
 * đầu), số cảnh báo chưa xác nhận tăng (cảnh báo mới), và mọi `announce()` khác (vd Tổng quan: số điểm đo mất tín hiệu).
 */
export function LiveAnnouncer() {
  const text = useAnnouncement();
  const status = useLiveStatus();
  const prevStatus = useRef(status);
  const everConnected = useRef(status === 'connected');
  useEffect(() => {
    if (status === prevStatus.current) return;
    prevStatus.current = status;
    if (status === 'connected' && !everConnected.current) {
      everConnected.current = true;
      return;
    }
    announce(STATUS_TEXT[status]);
  }, [status]);

  // Số đếm từ máy chủ (GET /alerts/counts) – không tải danh sách cảnh báo ở mọi trang.
  const unack = useUnacknowledgedCount();
  const prevUnack = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (unack === undefined) return;
    const prev = prevUnack.current;
    prevUnack.current = unack;
    if (prev !== undefined && unack > prev) announce(`Có ${unack - prev} cảnh báo mới chưa xác nhận (tổng ${unack}).`);
  }, [unack]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-live-announcer>
      {text}
    </div>
  );
}
