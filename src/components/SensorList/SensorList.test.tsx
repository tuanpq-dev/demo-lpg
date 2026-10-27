// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { SensorList } from './SensorList';

describe('SensorList', () => {
  test('tên + giá trị + badge mức; dòng gây cảnh báo đọc kèm; mất tín hiệu không hiện số / badge', () => {
    render(
      <SensorList
        label="Cảm biến khí"
        rows={[
          { id: 'a', name: 'GS-01', valueText: '2% LEL', levelLabel: 'Bình thường', tone: 'success' },
          { id: 'b', name: 'GS-03', valueText: null, levelLabel: 'Bình thường', tone: 'success' },
          { id: 'c', name: 'GS-04', valueText: '25% LEL', levelLabel: 'Cảnh báo cấp 2', tone: 'warning', highlight: true },
        ]}
      />,
    );
    const rows = within(screen.getByRole('list', { name: 'Cảm biến khí' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('GS-012% LELBình thường');
    expect(rows[1]).toHaveTextContent('Mất tín hiệu');
    expect(rows[1]).not.toHaveTextContent('Bình thường');
    expect(rows[2]).toHaveTextContent('GS-04 – cảm biến gây cảnh báo');
    expect(within(rows[2]!).getByText('25% LEL').className).toContain('text-warning');
  });
});
