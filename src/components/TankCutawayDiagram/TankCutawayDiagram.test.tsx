// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TankCutawayDiagram } from './TankCutawayDiagram';

const layers = { levelPct: 73, waterPct: 5.2, lpgPercent: 76.2, vaporPercent: 21.8, waterPercent: 2 };

describe('TankCutawayDiagram', () => {
  it('SVG có <title> + <desc> mô tả ba lớp, nhãn dẫn và chú thích', () => {
    const { container } = render(<TankCutawayDiagram label="Mặt cắt bồn V-101" layers={layers} length={4.8} diameter={1.9} />);
    const img = screen.getByRole('img', { name: /Mặt cắt bồn V-101/ });
    expect(img.querySelector('title')?.textContent).toBe('Mặt cắt bồn V-101');
    expect(img.querySelector('desc')?.textContent).toContain('LPG lỏng 76.2%');
    expect(screen.getByText('Pha hơi – 21.8%')).toBeInTheDocument();
    expect(screen.getByText('Nước đáy – 2.0%')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['LPG lỏng', 'Pha hơi / khí gas', 'Nước đáy bồn']);
    // Lớp nước nằm dưới cùng, LPG ở giữa.
    const y = (id: string) => Number(container.querySelector(`[data-layer="${id}"]`)!.getAttribute('y'));
    expect(y('vapor')).toBeLessThan(y('lpg'));
    expect(y('lpg')).toBeLessThan(y('water'));
  });

  it('mất tín hiệu → không vẽ lớp, không hiện số', () => {
    const { container } = render(<TankCutawayDiagram layers={null} state="lost" length={4.8} diameter={1.9} />);
    expect(container.querySelector('[data-layer]')).toBeNull();
    expect(screen.getByText('Mất tín hiệu')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
