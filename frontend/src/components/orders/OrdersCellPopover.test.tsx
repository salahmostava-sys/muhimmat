import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersCellPopover, type OrdersPopoverState } from './OrdersCellPopover';

vi.mock('@/hooks/useAppColors', () => ({
  getAppColor: () => ({ bg: '#00000011', text: '#111111' }),
}));

const baseState: OrdersPopoverState = { empId: 'emp-1', day: 3, x: 100, y: 120 };

describe('OrdersCellPopover', () => {
  it('applies values and closes popover', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    render(
      <OrdersCellPopover
        state={baseState}
        apps={[{ id: 'app-1', name: 'Talabat' }]}
        data={{ 'emp-1::app-1::3': 7 }}
        appColorsList={[]}
        canEdit
        onApply={onApply}
        onClose={onClose}
      />
    );

    const input = screen.getByDisplayValue('7');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /تطبيق/i }));

    expect(onApply).toHaveBeenCalledWith('emp-1', 3, { 'app-1': 9 });
    expect(onClose).toHaveBeenCalled();
  });

  it('disables inputs and hides apply button when cannot edit', () => {
    render(
      <OrdersCellPopover
        state={baseState}
        apps={[{ id: 'app-1', name: 'Talabat' }]}
        data={{}}
        appColorsList={[]}
        canEdit={false}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('0')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /تطبيق/i })).not.toBeInTheDocument();
  });

  it('closes on escape key press', () => {
    const onClose = vi.fn();
    render(
      <OrdersCellPopover
        state={baseState}
        apps={[{ id: 'app-1', name: 'Talabat' }]}
        data={{}}
        appColorsList={[]}
        canEdit
        onApply={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(screen.getByPlaceholderText('0'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
