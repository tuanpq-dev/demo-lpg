import { ToastList } from '@/components';
import { dismissToast, useToasts } from '@/lib/toast';

/** Khung toast dùng chung (gắn trong `Page`): đọc store `lib/toast`, nút × gọi `dismissToast`. */
export function ToastHost() {
  const items = useToasts();
  return <ToastList items={items} onDismiss={dismissToast} />;
}
