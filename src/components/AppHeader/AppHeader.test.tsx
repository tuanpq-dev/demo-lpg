// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { AppHeader } from './AppHeader';

const base = { navItems: [], navValue: '', onNavChange: () => {} };

describe('AppHeader – menu tài khoản', () => {
  test('mở menu, thấy email/vai trò, chọn Đăng xuất → callback id; Esc đóng và trả focus', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <AppHeader
        {...base}
        user={{ name: 'Kỹ sư A', detail: 'eng@example.com · Kỹ sư' }}
        userMenu={[{ id: 'logout', label: 'Đăng xuất' }]}
        onUserMenuSelect={onSelect}
      />,
    );
    const toggle = screen.getByRole('button', { name: /Kỹ sư A.*mở menu tài khoản/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('eng@example.com · Kỹ sư')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();

    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(onSelect).toHaveBeenCalledWith('logout');
  });

  test('không có userMenu → nút người dùng như cũ', () => {
    render(<AppHeader {...base} user={{ name: 'Admin' }} />);
    expect(screen.getByRole('button', { name: 'Admin' })).not.toHaveAttribute('aria-expanded');
  });
});
