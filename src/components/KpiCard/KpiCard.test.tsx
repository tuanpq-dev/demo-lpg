// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { KpiCard } from './KpiCard';

/** Cỡ chữ Tailwind của dự án (px) – tailwind.config.ts `fontSize`. */
const SIZE_PX: Record<string, number> = { 'text-2xs': 10, 'text-xs': 11, 'text-sm': 12, 'text-base': 14, 'text-md': 16, 'text-lg': 18, 'text-xl': 24, 'text-2xl': 28, 'text-kpi': 28, 'text-3xl': 32 };
/** "Chữ lớn" WCAG 1.4.3: ≥ 24px thường hoặc ≥ 18.66px đậm (≥ 700). */
const isLargeText = (cls: string) => {
  const size = Object.entries(SIZE_PX).find(([c]) => cls.split(/\s+/).includes(c))?.[1] ?? 0;
  const bold = /\bfont-bold\b/.test(cls);
  return size >= 24 || (bold && size >= 18.66);
};

describe('KpiCard variant="danger" – chữ đỏ', () => {
  test('số KPI dùng danger-strong CHỈ khi là chữ lớn WCAG (text-kpi 28px đậm)', () => {
    render(<KpiCard variant="danger" label="Cảnh báo" value="3" unit="Active" action={{ label: 'Xem chi tiết' }} />);
    const num = screen.getByText('3');
    expect(num.className).toContain('text-danger-strong');
    expect(isLargeText(num.className)).toBe(true);
  });
  test('compact (text-2xl 28px đậm) cũng là chữ lớn', () => {
    render(<KpiCard variant="compact" tone="danger" label="Quá hạn" value="04" />);
    expect(isLargeText(screen.getByText('04').className)).toBe(true);
  });
  test('"Active" và "Xem chi tiết": danger-text, không độ mờ; thứ bậc bằng cỡ/gạch chân/mũi tên', () => {
    render(<KpiCard variant="danger" label="Cảnh báo" value="3" unit="Active" action={{ label: 'Xem chi tiết' }} />);
    const unit = screen.getByText('Active');
    expect(unit.className).toMatch(/\btext-danger-text\b/);
    expect(unit.className).not.toMatch(/text-danger[\w-]*\/\d+/);
    const link = screen.getByRole('button', { name: 'Xem chi tiết' });
    expect(link.className).toMatch(/\btext-danger-text\b/);
    expect(link.className).toMatch(/(^|\s)underline(\s|$)/);
    expect(link).toHaveTextContent('Xem chi tiết →');
  });
  test('isLargeText: biên chuẩn WCAG', () => {
    expect(isLargeText('text-xl')).toBe(true); // 24px thường
    expect(isLargeText('text-lg font-bold')).toBe(false); // 18px đậm < 18.66
    expect(isLargeText('text-md font-bold')).toBe(false);
    expect(isLargeText('text-2xl')).toBe(true);
  });
});
