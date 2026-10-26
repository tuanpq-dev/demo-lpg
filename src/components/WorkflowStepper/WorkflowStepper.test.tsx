// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { WorkflowStepper } from './WorkflowStepper';

const steps = ['Tạo yêu cầu', 'Tiếp nhận', 'Đang thực hiện', 'Chờ nghiệm thu', 'Hoàn thành'].map((label, i) => ({ id: String(i), label }));

describe('WorkflowStepper', () => {
  test('aria-current="step" ở bước đang chờ; bước xong có chữ "đã xong"', () => {
    render(<WorkflowStepper steps={steps} completed={1} current={1} label="Tiến trình MT-1" />);
    const nav = screen.getByRole('navigation', { name: 'Tiến trình MT-1' });
    const li = nav.querySelectorAll('li');
    expect(li[1]).toHaveAttribute('aria-current', 'step');
    expect(nav.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(li[0]).toHaveTextContent('Tạo yêu cầu – đã xong');
    expect(li[2]).toHaveTextContent('Đang thực hiện – chưa tới');
  });
  test('đã xong hết / đã dừng → không có aria-current', () => {
    const { rerender, container } = render(<WorkflowStepper steps={steps} completed={5} current={null} label="x" />);
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(0);
    rerender(<WorkflowStepper steps={steps} completed={3} current={null} label="x" />);
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(0);
  });
});
