// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { Tabs } from './Tabs';
import { SegmentedControl } from '../SegmentedControl';

const items = [
  { id: 'all', label: 'Tất cả' },
  { id: 'open', label: 'Chưa xác nhận' },
  { id: 'done', label: 'Đã hoàn thành' },
];

function ControlledTabs() {
  const [v, setV] = useState('all');
  return <Tabs items={items} value={v} onChange={setV} label="Lọc trạng thái" />;
}

describe('Tabs – bàn phím (automatic activation)', () => {
  test('role tablist/tab + aria-selected; chỉ tab đang chọn trong thứ tự Tab', () => {
    render(<ControlledTabs />);
    expect(screen.getByRole('tablist', { name: 'Lọc trạng thái' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
  });

  test('→ / ← / End / Home vừa di chuyển focus vừa chọn, vòng quanh ở hai đầu', async () => {
    const user = userEvent.setup();
    render(<ControlledTabs />);
    await user.tab();
    expect(screen.getByRole('tab', { name: 'Tất cả' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Chưa xác nhận' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Chưa xác nhận' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Đã hoàn thành' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Tất cả' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Đã hoàn thành' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Tất cả' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('SegmentedControl – radiogroup bàn phím', () => {
  function Controlled() {
    const [v, setV] = useState('all');
    return <SegmentedControl options={items} value={v} onChange={setV} label="Góc nhìn" />;
  }
  test('mũi tên đổi lựa chọn, aria-checked theo giá trị', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    expect(screen.getByRole('radiogroup', { name: 'Góc nhìn' })).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Tất cả' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Chưa xác nhận' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Tất cả' })).not.toBeChecked();
  });
});
