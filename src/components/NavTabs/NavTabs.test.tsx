// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { NavMenu, NavTabs, navTopId, type NavTabItem } from './NavTabs';

const ITEMS: NavTabItem[] = [
  { id: 'overview', label: 'Tổng quan', icon: 'navOverview' },
  {
    id: 'operation',
    label: 'Vận hành',
    icon: 'navOperation',
    children: [
      { id: 'op-main', label: 'Vận hành' },
      { id: 'op-logs', label: 'Nhật ký vận hành' },
      { id: 'op-ai', label: 'AI mô phỏng sự cố' },
    ],
  },
  { id: 'alerts', label: 'Cảnh báo', icon: 'navAlert' },
];

describe('navTopId', () => {
  test('mục con → mục cha; mục cấp 1 / lạ giữ nguyên', () => {
    expect(navTopId(ITEMS, 'op-logs')).toBe('operation');
    expect(navTopId(ITEMS, 'alerts')).toBe('alerts');
    expect(navTopId(ITEMS, '')).toBe('');
  });
});

describe('NavTabs – menu con', () => {
  test('bấm "Vận hành" mở menu (không chọn), chọn mục con → onChange id con, menu đóng, focus về tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NavTabs items={ITEMS} value="overview" onChange={onChange} />);
    const tab = screen.getByRole('tab', { name: /Vận hành/ });
    expect(tab).toHaveAttribute('aria-haspopup', 'menu');
    expect(tab).toHaveAttribute('aria-expanded', 'false');

    await user.click(tab);
    expect(onChange).not.toHaveBeenCalled();
    expect(tab).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu', { name: 'Vận hành' });
    expect(menu).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Vận hành', 'Nhật ký vận hành', 'AI mô phỏng sự cố']);
    expect(screen.getByRole('menuitem', { name: 'Vận hành' })).toHaveFocus();

    await user.click(screen.getByRole('menuitem', { name: 'Nhật ký vận hành' }));
    expect(onChange).toHaveBeenCalledWith('op-logs');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(tab).toHaveFocus();
  });

  test('bàn phím: ↓ mở + focus mục đầu, ↑/↓/End di chuyển vòng, Esc đóng và trả focus; Enter chọn', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NavTabs items={ITEMS} value="overview" onChange={onChange} />);
    const tab = screen.getByRole('tab', { name: /Vận hành/ });
    tab.focus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Vận hành' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'AI mô phỏng sự cố' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Vận hành' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'AI mô phỏng sự cố' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(tab).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Vận hành' })).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('op-logs');
  });

  test('đang ở trang con → tab cha sáng (aria-selected), hiện tên trang con, mục con aria-current', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<NavTabs items={ITEMS} value="op-ai" onChange={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'Vận hành – AI mô phỏng sự cố' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    rerender(<NavTabs items={ITEMS} value="op-main" onChange={() => {}} />);
    expect(tab).toHaveAccessibleName('Vận hành');
    rerender(<NavTabs items={ITEMS} value="op-ai" onChange={() => {}} />);
    expect(tab).toHaveAttribute('tabindex', '0');
    await user.click(tab);
    expect(screen.getByRole('menuitem', { name: 'AI mô phỏng sự cố' })).toHaveAttribute('aria-current', 'page');
  });

  test('click ra ngoài đóng menu; tab thường vẫn chọn ngay', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <NavTabs items={ITEMS} value="overview" onChange={onChange} />
        <p>ngoài</p>
      </>,
    );
    await user.click(screen.getByRole('tab', { name: /Vận hành/ }));
    await user.click(screen.getByText('ngoài'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Cảnh báo/ }));
    expect(onChange).toHaveBeenCalledWith('alerts');
  });
});

describe('NavMenu – menu con', () => {
  test('mục con hiện trong nhóm "Vận hành"; chọn → onChange id con; nút hiện tên trang con', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NavMenu items={ITEMS} value="op-logs" onChange={onChange} />);
    const toggle = screen.getByRole('button', { name: /Nhật ký vận hành.*mở menu điều hướng/ });
    await user.click(toggle);
    const group = screen.getByRole('list', { name: 'Vận hành' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nhật ký vận hành' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'AI mô phỏng sự cố' }));
    expect(onChange).toHaveBeenCalledWith('op-ai');
  });
});
