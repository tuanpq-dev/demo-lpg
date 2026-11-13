import { useSyncExternalStore } from 'react';
import { readToasts, subscribeToasts, type ToastItem } from '@/lib/toast';

/** Danh sách toast đang hiện. */
export function useToasts(): readonly ToastItem[] {
  return useSyncExternalStore(subscribeToasts, readToasts, readToasts);
}
