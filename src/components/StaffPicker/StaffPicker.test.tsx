// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { StaffList, type StaffPickerItem } from './StaffPicker';

const items: StaffPickerItem[] = [
  {
    id: 'A',
    name: 'Nguyễn Văn A',
    subtitle: 'Cơ khí • Van/Bồn',
    shiftLabel: 'Ca 2',
    shiftMatch: true,
    busy: false,
    active: 1,
    overdue: 0,
    workloadHint: 'cách tính',
  },
  { id: 'B', name: 'Trần Bình', subtitle: 'Cơ khí • Áp lực', shiftLabel: 'Ca 1', busy: true, active: 3, overdue: 1 },
  { id: 'C', name: 'Lê Thị C', subtitle: 'Đo lường • Cảm biến', shiftLabel: 'Ca 2', busy: false, active: 0, overdue: 0 },
];

function Host({ onChange = () => {} }: { onChange?: (id: string) => void }) {
  const [v, setV] = useState<string | null>(null);
  return (
    <StaffList
      label="Danh sách nhân sự"
      items={items}
      value={v}
      onChange={(id) => {
        setV(id);
        onChange(id);
      }}
    />
  );
}

describe('StaffList', () => {
  test('radiogroup có nhãn; KHÔNG chọn sẵn; Tab vào mục đầu chưa chọn; ↓ chuyển + chọn; Space chọn', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const group = screen.getByRole('radiogroup', { name: 'Danh sách nhân sự' });
    const radios = screen.getAllByRole('radio');
    expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    await user.tab();
    expect(radios[0]).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{ArrowDown}');
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowDown} ');
    expect(radios[2]).toHaveAttribute('aria-checked', 'true');
    expect(group).toBeInTheDocument();
  });

  test('chip: ca, Sẵn sàng/Bận, "x đang làm (y quá hạn)" – đọc kèm qua aria-describedby', () => {
    render(<Host />);
    const b = screen.getByRole('radio', { name: /Trần Bình/ });
    expect(b).toHaveAccessibleDescription(/Ca 1.*Bận.*3 đang làm.*\(1 quá hạn\)/);
    expect(screen.getByRole('radio', { name: /Nguyễn Văn A/ })).toHaveAccessibleDescription(/Sẵn sàng.*1 đang làm.*cách tính/);
  });

  test('rỗng → empty state, không có radiogroup', () => {
    render(<StaffList label="Danh sách" items={[]} value={null} onChange={() => {}} emptyState="Không có ai" />);
    expect(screen.getByText('Không có ai')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});

describe('StaffPickerCard – biến thể có xét ca (phân công cảnh báo)', () => {
  test('availability: Sẵn sàng / Bận / Ngoài ca, chip tải việc tuỳ chữ, chip gợi ý; người Ngoài ca vẫn chọn được', async () => {
    const onChange = vi.fn();
    render(
      <StaffList
        label="Chọn nhân sự"
        value={null}
        onChange={onChange}
        items={[
          {
            id: 'A',
            name: 'Trần Bình',
            subtitle: 'KTV • Áp lực',
            shiftLabel: 'Ca 1',
            shiftMatch: true,
            busy: false,
            active: 1,
            overdue: 0,
            availability: 'available',
            loadLabel: '1 cảnh báo đang xử lý',
            suggestion: 'Cùng khu',
          },
          {
            id: 'B',
            name: 'Lê Thị C',
            subtitle: 'KTV • Cảm biến',
            shiftLabel: 'Ca 2',
            busy: true,
            active: 3,
            overdue: 1,
            availability: 'off-shift',
            loadLabel: '3 cảnh báo đang xử lý (1 nghiêm trọng)',
          },
        ]}
      />,
    );
    const a = screen.getByRole('radio', { name: /Trần Bình/ });
    expect(a).toHaveAccessibleDescription(/Sẵn sàng/);
    expect(a).toHaveTextContent('1 cảnh báo đang xử lý');
    expect(a).toHaveTextContent('Cùng khu');
    const b = screen.getByRole('radio', { name: /Lê Thị C/ });
    // Ngoài ca thắng Bận (nhãn do nơi gọi tính) – chip tải việc vẫn hiện.
    expect(b).toHaveAccessibleDescription(/Ngoài ca/);
    expect(b).not.toHaveTextContent('Bận');
    expect(b).toHaveTextContent('3 cảnh báo đang xử lý (1 nghiêm trọng)');
    expect(b).toHaveClass('border-dashed');
    expect(b.className).not.toMatch(/opacity/);
    await userEvent.setup().click(b);
    expect(onChange).toHaveBeenCalledWith('B');
  });
});
