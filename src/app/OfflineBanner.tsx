import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/** Thanh báo mất mạng (cố định đáy màn hình) – mọi trang trong khung app. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-warning/40 bg-surface-raised px-4 py-2 text-sm text-fg"
    >
      Mất kết nối mạng – số liệu trên màn hình có thể chưa cập nhật.
    </div>
  );
}
