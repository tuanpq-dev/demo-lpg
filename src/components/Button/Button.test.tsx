// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { Button } from './Button';

describe('Button aria-disabled', () => {
  test('vẫn focus được nhưng click / Enter / Space không gọi onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button aria-disabled onClick={onClick}>
        Gửi
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Gửi' });
    await user.click(btn);
    btn.focus();
    expect(btn).toHaveFocus(); // không phải disabled thật → vẫn nhận focus
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).not.toHaveBeenCalled();
  });

  test('nút submit: click, Enter trên nút và Enter trong ô nhập (gửi ngầm) KHÔNG submit form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Ô nhập" />
        <Button type="submit" aria-disabled>
          Gửi nghiệm thu
        </Button>
      </form>,
    );
    const btn = screen.getByRole('button', { name: 'Gửi nghiệm thu' });
    await user.click(btn);
    btn.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.type(screen.getByRole('textbox', { name: 'Ô nhập' }), 'abc{Enter}');
    fireEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('đối chứng: bỏ aria-disabled → click gọi onClick và submit form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const onClick = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" onClick={onClick}>
          Gửi
        </Button>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Gửi' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
