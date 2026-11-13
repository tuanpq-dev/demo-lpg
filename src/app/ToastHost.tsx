import { ToastList } from '@/components';
import { useToasts } from '@/hooks/useToasts';
import { dismissToast } from '@/lib/toast';

/** Khung toast dùng chung (gắn trong `Page`): đọc store `lib/toast`, nút × gọi `dismissToast`. */
export function ToastHost() {
  const items = useToasts();
  return <ToastList items={items} onDismiss={dismissToast} />;
}
