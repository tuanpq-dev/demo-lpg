// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { DataTable } from './DataTable';

type Row = { id: string; name: string };
const rows: Row[] = [
  { id: '1', name: 'V-101' },
  { id: '2', name: 'P-101A' },
  { id: '3', name: 'F-101' },
];

function Harness({ initial = [] as string[] }) {
  const [sel, setSel] = useState<string[]>(initial);
  return (
    <>
      <DataTable
        label="Thiết bị"
        columns={[{ id: 'name', header: 'Tên' }]}
        rows={rows}
        getRowId={(r) => r.id}
        selectable
        selectedIds={sel}
        onSelectionChange={setSel}
      />
      <output data-testid="sel">{sel.join(',')}</output>
    </>
  );
}

describe('DataTable – chọn tất cả', () => {
  test('chọn tất cả → mọi dòng; bấm lại → bỏ hết', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('checkbox', { name: 'Chọn tất cả' }));
    expect(screen.getByTestId('sel')).toHaveTextContent('1,2,3');
    await user.click(screen.getByRole('checkbox', { name: 'Bỏ chọn tất cả' }));
    expect(screen.getByTestId('sel')).toHaveTextContent('');
  });

  test('chọn một phần → ô header ở trạng thái indeterminate (mixed)', () => {
    render(<Harness initial={['2']} />);
    const all = screen.getByRole('checkbox', { name: 'Chọn tất cả' }) as HTMLInputElement;
    expect(all.indeterminate || all.getAttribute('aria-checked') === 'mixed').toBe(true);
  });

  test('bảng có tên truy cập, header cột là columnheader', () => {
    render(<Harness />);
    expect(screen.getByRole('table', { name: 'Thiết bị' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên' })).toBeInTheDocument();
  });
});

describe('DataTable – số dòng mỗi trang', () => {
  test('ô chọn có nhãn, đổi giá trị → onPageSizeChange(số)', async () => {
    const user = userEvent.setup();
    const sizes: number[] = [];
    render(
      <DataTable
        label="Thiết bị"
        columns={[{ id: 'name', header: 'Tên' }]}
        rows={rows}
        getRowId={(r) => r.id}
        pagination={{ page: 1, pageSize: 10, total: 3, onPageChange: () => {}, pageSizeOptions: [10, 20], onPageSizeChange: (n) => sizes.push(n) }}
      />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), '20');
    expect(sizes).toEqual([20]);
  });

  test('không truyền pageSizeOptions → không có ô chọn', () => {
    render(
      <DataTable
        label="Thiết bị"
        columns={[{ id: 'name', header: 'Tên' }]}
        rows={rows}
        getRowId={(r) => r.id}
        pagination={{ page: 1, pageSize: 10, total: 3, onPageChange: () => {} }}
      />,
    );
    expect(screen.queryByRole('combobox', { name: 'Số dòng mỗi trang' })).not.toBeInTheDocument();
  });
});

describe('DataTable – nhóm dòng (groupBy)', () => {
  type G = { id: string; name: string; group: string };
  const grouped: G[] = [
    { id: 'a', name: 'Mức bồn', group: 'V-101' },
    { id: 'b', name: 'Áp suất bồn', group: 'V-101' },
    { id: 'c', name: 'Nồng độ khí', group: 'GS' },
  ];
  const renderGrouped = () =>
    render(
      <DataTable
        label="Số liệu"
        columns={[{ id: 'name', header: 'Hạng mục', className: (r: G) => (r.id === 'c' ? 'bg-bg-app' : undefined) }]}
        rows={grouped}
        getRowId={(r) => r.id}
        groupBy={(r) => ({ id: r.group, label: `Nhóm ${r.group}` })}
        density="dense"
        gridLines
      />,
    );

  test('mỗi nhóm một dòng tiêu đề (colgroup) trước các dòng của nhóm', () => {
    renderGrouped();
    const headers = screen.getAllByRole('columnheader').filter((h) => h.getAttribute('scope') === 'colgroup');
    expect(headers.map((h) => h.textContent)).toEqual(['Nhóm V-101', 'Nhóm GS']);
    expect(screen.getAllByRole('row').map((r) => r.textContent)).toEqual([
      'Hạng mục',
      'Nhóm V-101',
      'Mức bồn',
      'Áp suất bồn',
      'Nhóm GS',
      'Nồng độ khí',
    ]);
  });

  test('bấm tên nhóm → thu gọn (aria-expanded=false, ẩn dòng); bấm lại → mở', async () => {
    const user = userEvent.setup();
    renderGrouped();
    const btn = screen.getByRole('button', { name: 'Nhóm V-101' });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Mức bồn')).not.toBeInTheDocument();
    expect(screen.getByText('Nồng độ khí')).toBeInTheDocument();
    await user.click(btn);
    expect(screen.getByText('Mức bồn')).toBeInTheDocument();
  });

  test('className dạng hàm áp theo từng dòng', () => {
    renderGrouped();
    expect(screen.getByText('Nồng độ khí').closest('td')).toHaveClass('bg-bg-app');
    expect(screen.getByText('Mức bồn').closest('td')).not.toHaveClass('bg-bg-app');
  });
});
