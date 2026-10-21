// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { Select } from './Select';

const options = [
  { value: 'a', label: 'Bồn chứa' },
  { value: 'b', label: 'Bơm' },
];

function Harness({ onChange = vi.fn() }: { onChange?: (v: string | null) => void }) {
  const [v, setV] = useState<string | null>(null);
  return (
    <div>
      <Select
        label="Khu vực"
        options={options}
        value={v}
        allLabel="Tất cả khu vực"
        onChange={(x) => {
          setV(x);
          onChange(x);
        }}
      />
      <p>Bên ngoài</p>
    </div>
  );
}

describe('Select', () => {
  test('mở bằng click, click ra ngoài thì đóng, không đổi giá trị', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /Khu vực/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByText('Bên ngoài'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('Esc đóng và trả focus về nút; chọn option → đóng + onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /Khu vực/ });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'Bơm' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
