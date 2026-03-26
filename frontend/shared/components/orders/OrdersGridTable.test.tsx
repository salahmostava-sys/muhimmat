import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersGridTable } from './OrdersGridTable';

vi.mock('@shared/hooks/useAppColors', () => ({
  getAppColor: () => ({
    bg: '#11111122',
    text: '#111111',
    cellBg: '#ffffff',
    val: '#111111',
  }),
}));

const baseProps = {
  tableRef: { current: null },
  seqColMin: 36,
  repColMin: 132,
  days: 2,
  year: 2026,
  month: 3,
  today: -1,
  visibleApps: [{ id: 'app-1', name: 'Talabat' }],
  appColorsList: [],
  expandedEmp: new Set<string>(),
  cellPopover: null,
  canEditMonth: true,
  dayArr: [1, 2],
  getVal: vi.fn(() => 0),
  getActiveApps: vi.fn(() => [{ id: 'app-1', name: 'Talabat' }]),
  empDayTotal: vi.fn(() => 0),
  empMonthTotal: vi.fn(() => 0),
  empAppMonthTotal: vi.fn(() => 0),
  shortName: (name: string) => name,
  toggleExpand: vi.fn(),
  handleCellClick: vi.fn(),
};

describe('OrdersGridTable', () => {
  it('renders loading state', () => {
    render(<OrdersGridTable {...baseProps} loading filteredEmployees={[]} />);
    expect(screen.getByText(/جاري التحميل/i)).toBeInTheDocument();
  });

  it('renders empty state with no employees', () => {
    render(<OrdersGridTable {...baseProps} loading={false} filteredEmployees={[]} />);
    expect(screen.getByText('لا يوجد مناديب')).toBeInTheDocument();
  });

  it('handles expand and cell click actions', () => {
    const toggleExpand = vi.fn();
    const handleCellClick = vi.fn();

    render(
      <OrdersGridTable
        {...baseProps}
        loading={false}
        toggleExpand={toggleExpand}
        handleCellClick={handleCellClick}
        filteredEmployees={[{ id: 'emp-1', name: 'Ahmed Ali' }]}
      />
    );

    fireEvent.click(screen.getByText('Ahmed Ali'));
    expect(toggleExpand).toHaveBeenCalledWith('emp-1');

    fireEvent.click(screen.getAllByText('·')[0]);
    expect(handleCellClick).toHaveBeenCalled();
  });
});
