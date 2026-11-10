import { useCallback, useRef, type KeyboardEvent } from 'react';

type Item = { id: string; disabled?: boolean };

type Options<T extends Item> = {
  items: readonly T[];
  value: string;
  onChange: (id: string) => void;
  /**
   * auto:   mũi tên vừa chuyển focus vừa chọn luôn (Tabs, SegmentedControl).
   * manual: mũi tên chỉ chuyển focus, Enter/Space mới chọn (NavTabs – điều hướng trang).
   */
  activation?: 'auto' | 'manual';
  orientation?: 'horizontal' | 'vertical';
};

/**
 * Roving tabindex cho nhóm tab/segment theo WAI-ARIA:
 * chỉ 1 phần tử có tabIndex=0 (mục đang chọn); ←/→ (hoặc ↑/↓), Home/End để di chuyển, bỏ qua mục disabled.
 */
export function useRovingFocus<T extends Item>({ items, value, onChange, activation = 'auto', orientation = 'horizontal' }: Options<T>) {
  const refs = useRef(new Map<string, HTMLElement>());

  const setRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) refs.current.set(id, el);
      else refs.current.delete(id);
    },
    [],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, currentId: string) => {
    const enabled = items.filter((i) => !i.disabled);
    if (enabled.length === 0) return;
    const idx = enabled.findIndex((i) => i.id === currentId);
    const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';

    let target: T | undefined;
    switch (e.key) {
      case nextKey:
        target = enabled[(idx + 1) % enabled.length];
        break;
      case prevKey:
        target = enabled[(idx - 1 + enabled.length) % enabled.length];
        break;
      case 'Home':
        target = enabled[0];
        break;
      case 'End':
        target = enabled[enabled.length - 1];
        break;
      case 'Enter':
      case ' ':
        if (activation === 'manual') {
          e.preventDefault();
          onChange(currentId);
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    refs.current.get(target.id)?.focus();
    if (activation === 'auto') onChange(target.id);
  };

  /** tabIndex cho từng mục: mục đang chọn = 0; nếu nó disabled/không tồn tại thì mục enabled đầu tiên = 0. */
  const focusableId = items.some((i) => i.id === value && !i.disabled) ? value : items.find((i) => !i.disabled)?.id;

  const getTabIndex = (id: string) => (id === focusableId ? 0 : -1);

  return { setRef, onKeyDown, getTabIndex };
}
