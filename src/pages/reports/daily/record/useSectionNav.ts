import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/reducedMotion';

/** Tab điều hướng nhanh (Figma 126:8003) → id mục trong thân modal. */
export const RECORD_NAV = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'tank', label: 'Bồn chứa LPG' },
  { id: 'vaporizer', label: 'Máy hóa hơi' },
  { id: 'regulator', label: 'Bộ điều áp' },
  { id: 'flow', label: 'Lưu lượng' },
  { id: 'gas', label: 'Gas & Báo cháy' },
  { id: 'plc', label: 'PLC/SCADA' },
  { id: 'remark', label: 'Nhận xét' },
] as const;
export type RecordNavId = (typeof RECORD_NAV)[number]['id'];

/**
 * Tab theo mục đang xem trong thân cuộn của modal: mục cuối có đầu mục đã cuộn qua mép trên thân (cuộn hết → mục cuối).
 * Bấm tab → cuộn tới mục (không hiệu ứng khi người dùng giảm chuyển động).
 */
export function useSectionNav() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<RecordNavId, HTMLElement | null>>>({});
  const [active, setActive] = useState<RecordNavId>('overview');

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const onScroll = () => {
      const top = body.getBoundingClientRect().top;
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) return setActive(RECORD_NAV[RECORD_NAV.length - 1]!.id);
      let current: RecordNavId = 'overview';
      for (const n of RECORD_NAV) {
        const el = sectionRefs.current[n.id];
        if (el && el.getBoundingClientRect().top - top <= 32) current = n.id;
      }
      setActive(current);
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, []);

  return {
    bodyRef,
    active,
    goTo: (id: RecordNavId) => {
      setActive(id);
      sectionRefs.current[id]?.scrollIntoView?.({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    /** Ref callback gắn đầu mục. */
    sectionRef: (id: RecordNavId) => (el: HTMLElement | null) => {
      sectionRefs.current[id] = el;
    },
  };
}
