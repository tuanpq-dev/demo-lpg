import { useSyncExternalStore } from 'react';
import { prefersReducedMotion, subscribeReducedMotion } from '@/lib/reducedMotion';

/** true khi người dùng muốn giảm chuyển động (prefers-reduced-motion); tự cập nhật khi đổi cài đặt hệ thống. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
}
