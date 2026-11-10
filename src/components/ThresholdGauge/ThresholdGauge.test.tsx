// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ThresholdGauge } from './ThresholdGauge';

describe('ThresholdGauge – role="meter"', () => {
  test('min/max/now + valuetext nói rõ vượt ngưỡng; phần vẽ ẩn khỏi trình đọc', () => {
    render(
      <ThresholdGauge
        label="Áp suất so với ngưỡng"
        value={11.8}
        min={0}
        max={14.4}
        threshold={10.5}
        valueText="11.8 bar, vượt ngưỡng 10.5 bar"
        valueLabel="11.8"
      />,
    );
    const m = screen.getByRole('meter', { name: 'Áp suất so với ngưỡng' });
    expect(m).toHaveAttribute('aria-valuemin', '0');
    expect(m).toHaveAttribute('aria-valuemax', '14.4');
    expect(m).toHaveAttribute('aria-valuenow', '11.8');
    expect(m).toHaveAttribute('aria-valuetext', '11.8 bar, vượt ngưỡng 10.5 bar');
    expect(m.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
  test('above: xanh trước ngưỡng, đỏ sau; below: đảo màu', () => {
    const { container, rerender } = render(
      <ThresholdGauge label="x" value={11.8} min={0} max={14.4} threshold={10.5} valueText="" valueLabel="11.8" />,
    );
    const segs = () => [...container.querySelectorAll('.rounded-full > span')].map((s) => s.className);
    expect(segs()[0]).toContain('bg-success');
    expect(segs()[1]).toContain('bg-danger');
    rerender(<ThresholdGauge label="x" direction="below" value={45} min={0} max={60} threshold={50} valueText="" valueLabel="45" />);
    expect(segs()[0]).toContain('bg-danger');
    expect(segs()[1]).toContain('bg-success');
    expect(screen.getByText('45').className).toContain('text-danger-solid');
  });
  test('giá trị ngoài thang: aria-valuenow kẹp trong [min, max]', () => {
    render(<ThresholdGauge label="x" value={30} min={0} max={24} threshold={20} valueText="" valueLabel="30" />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '24');
  });
  test('nhiều mức (bands): đoạn theo token, mốc "40 (ESD)" chữ danger-text, valuetext nêu mức hiện tại', () => {
    const bands = [
      { from: 0, to: 10, tone: 'success' as const, label: 'Bình thường' },
      { from: 10, to: 20, tone: 'warning-dim' as const, label: 'Cảnh báo cấp 1' },
      { from: 20, to: 40, tone: 'warning' as const, label: 'Cảnh báo cấp 2' },
      { from: 40, tone: 'danger' as const, label: 'ESD' },
    ];
    const ticks = [
      { value: 0, label: '0' },
      { value: 10, label: '10' },
      { value: 20, label: '20' },
      { value: 40, label: '40 (ESD)', danger: true },
      { value: 100, label: '100' },
    ];
    const { container } = render(
      <ThresholdGauge
        label="Nồng độ"
        value={25}
        min={0}
        max={100}
        threshold={10}
        bands={bands}
        ticks={ticks}
        valueText="25% LEL – Cảnh báo cấp 2"
        valueLabel="25%"
      />,
    );
    const m = screen.getByRole('meter', { name: 'Nồng độ' });
    expect(m).toHaveAttribute('aria-valuetext', '25% LEL – Cảnh báo cấp 2');
    expect(m).toHaveAttribute('aria-valuenow', '25');
    const segs = [...container.querySelectorAll('.rounded-sm > span')];
    expect(segs.map((x) => x.className)).toEqual(['bg-success', 'bg-warning/60', 'bg-warning', 'bg-danger']);
    expect(segs.map((x) => (x as HTMLElement).style.width)).toEqual(['10%', '10%', '20%', '60%']);
    expect(screen.getByText('40 (ESD)').className).toContain('text-danger-text');
  });
});
