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
  test('nhãn phụ (Tạm dừng) ở bước đang thực hiện – không đổi bước', () => {
    const withNote = steps.map((s, i) => (i === 2 ? { ...s, note: 'Gặp sự cố', noteTone: 'danger' as const } : s));
    render(<WorkflowStepper steps={withNote} completed={3} current={3} label="x" />);
    const li = screen.getByRole('navigation', { name: 'x' }).querySelectorAll('li');
    expect(li[2]).toHaveTextContent('Đang thực hiện – đã xong, Gặp sự cố');
    expect(li[3]).toHaveAttribute('aria-current', 'step');
  });
  test('dọc: giờ sau nhãn, aria-current đúng một bước, trạng thái đọc được', () => {
    const v = [
      { id: 'd', label: 'Phát hiện', time: '10:45:22' },
      { id: 'n', label: 'Gửi thông báo', time: '10:45:25' },
      { id: 'a', label: 'Chưa xác nhận' },
      { id: 'p', label: 'Đang xử lý' },
      { id: 'h', label: 'Hoàn thành' },
    ];
    render(<WorkflowStepper orientation="vertical" steps={v} completed={2} current={2} label="Tiến trình ALT-1" />);
    const li = screen.getByRole('navigation', { name: 'Tiến trình ALT-1' }).querySelectorAll('li');
    expect(li).toHaveLength(5);
    expect(li[0]).toHaveTextContent('Phát hiện (10:45:22) – đã xong');
    expect(li[2]).toHaveAttribute('aria-current', 'step');
    expect(li[2]).toHaveTextContent('Chưa xác nhận – bước hiện tại');
    expect(li[4]).toHaveTextContent('Hoàn thành – chưa tới');
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1);
  });
});
