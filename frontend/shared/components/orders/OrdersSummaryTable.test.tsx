import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersSummaryTable } from './OrdersSummaryTable';

vi.mock('@shared/hooks/useAppColors', () => ({
  getAppColor: () => ({ bg: '#ff660022', val: '#ff6600' }),
}));

describe('OrdersSummaryTable', () => {
  it('renders employee row and supports sorting callback', () => {
    const onSort = vi.fn();

    render(
      <OrdersSummaryTable
        loading={false}
        apps={[{ id: 'app-1', name: 'Talabat' }]}
        appColorsList={[
          {
            id: 'app-1',
            name: 'Talabat',
            brand_color: '#ff6600',
            text_color: '#ffffff',
            is_active: true,
            custom_columns: [],
          },
        ]}
        sortedEmployees={[{ id: 'emp-1', name: 'Ahmed Ali' }]}
        employeesCount={1}
        data={{ 'emp-1::app-1::1': 12 }}
        dayArr={[1]}
        days={30}
        empTotal={() => 12}
        appGrandTotal={() => 12}
        grandTotal={12}
        shortName={(v) => v}
        sortField="name"
        sortDir="asc"
        onSort={onSort}
      />
    );

    expect(screen.getByText('Ahmed Ali')).toBeInTheDocument();
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText(/المندوب/i));
    expect(onSort).toHaveBeenCalled();
  });

  it('renders loading skeleton rows', () => {
    const { container } = render(
      <OrdersSummaryTable
        loading
        apps={[{ id: 'app-1', name: 'Talabat' }]}
        appColorsList={[]}
        sortedEmployees={[]}
        employeesCount={0}
        data={{}}
        dayArr={[1]}
        days={30}
        empTotal={() => 0}
        appGrandTotal={() => 0}
        grandTotal={0}
        shortName={(v) => v}
        sortField="name"
        sortDir="asc"
        onSort={vi.fn()}
      />
    );

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});
