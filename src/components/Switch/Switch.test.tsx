// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { Switch } from './Switch';

function Host() {
  const [on, setOn] = useState(true);
  return <Switch label="Gửi thông báo" description="Chờ backend" checked={on} onChange={setOn} />;
}

describe('Switch', () => {
  test('role="switch" + aria-checked; Space/click đổi; nhãn + mô tả', async () => {
    const user = userEvent.setup();
    render(<Host />);
    const sw = screen.getByRole('switch', { name: 'Gửi thông báo' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toHaveAccessibleDescription('Chờ backend');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
    sw.focus();
    await user.keyboard(' ');
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByText('Gửi thông báo'));
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });
});
