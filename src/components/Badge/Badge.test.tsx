// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Badge, WORK_STATUS_LABEL } from './Badge';

describe('Badge status monitoring', () => {
  test('nhãn mặc định "Đang theo dõi", pill vàng; children ghi đè nhãn', () => {
    const { rerender } = render(<Badge variant="status" value="monitoring" />);
    expect(screen.getByText(WORK_STATUS_LABEL.monitoring)).toHaveClass('text-warning', 'bg-warning/10');
    expect(WORK_STATUS_LABEL.monitoring).toBe('Đang theo dõi');
    rerender(<Badge variant="status" value="done">Ghi nhận</Badge>);
    expect(screen.getByText('Ghi nhận')).toHaveClass('text-success');
  });
});
