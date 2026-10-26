// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { ProgressSlider } from './ProgressSlider';

function Harness({ initial = 50, onChange }: { initial?: number; onChange?: (v: number) => void }) {
  const [v, setV] = useState(initial);
  return (
    <ProgressSlider
      label="Tiến độ hoàn thành"
      value={v}
      onChange={(x) => {
        setV(x);
        onChange?.(x);
      }}
    />
  );
}

describe('ProgressSlider – bàn phím + ARIA', () => {
  test('role slider có tên, aria-valuenow/min/max/valuetext', () => {
    render(<Harness />);
    const s = screen.getByRole('slider', { name: 'Tiến độ hoàn thành' });
    expect(s).toHaveAttribute('aria-valuenow', '50');
    expect(s).toHaveAttribute('aria-valuemin', '0');
    expect(s).toHaveAttribute('aria-valuemax', '100');
    expect(s).toHaveAttribute('aria-valuetext', '50%');
    expect(s).toHaveAttribute('tabindex', '0');
  });

  test('←/→/↑/↓ ±5 · PageUp/PageDown ±10 · Home/End', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const s = screen.getByRole('slider');
    s.focus();
    await user.keyboard('{ArrowRight}');
    expect(s).toHaveAttribute('aria-valuenow', '55');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(s).toHaveAttribute('aria-valuenow', '65');
    await user.keyboard('{ArrowLeft}{ArrowDown}');
    expect(s).toHaveAttribute('aria-valuenow', '55');
    await user.keyboard('{PageUp}');
    expect(s).toHaveAttribute('aria-valuenow', '65');
    await user.keyboard('{PageDown}{PageDown}');
    expect(s).toHaveAttribute('aria-valuenow', '45');
    await user.keyboard('{End}');
    expect(s).toHaveAttribute('aria-valuenow', '100');
    await user.keyboard('{Home}');
    expect(s).toHaveAttribute('aria-valuenow', '0');
  });

  test('kẹp ở biên: không gọi onChange khi đã ở 0/100', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={100} onChange={onChange} />);
    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowRight}{PageUp}{End}');
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{Home}{ArrowLeft}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  test('bấm trên rãnh → giá trị theo vị trí, làm tròn bước 5', () => {
    render(<Harness initial={0} />);
    const s = screen.getByRole('slider');
    const track = s.parentElement!;
    track.getBoundingClientRect = () => ({ left: 100, width: 200, top: 0, height: 20, right: 300, bottom: 20, x: 100, y: 0, toJSON: () => ({}) });
    // jsdom chưa có PointerEvent → dựng từ MouseEvent (có clientX/button).
    const press = (clientX: number) => fireEvent(track, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX }));
    press(100 + 200 * 0.62);
    expect(s).toHaveAttribute('aria-valuenow', '60');
    expect(s).toHaveFocus();
    press(999);
    expect(s).toHaveAttribute('aria-valuenow', '100');
    press(0);
    expect(s).toHaveAttribute('aria-valuenow', '0');
  });
});
