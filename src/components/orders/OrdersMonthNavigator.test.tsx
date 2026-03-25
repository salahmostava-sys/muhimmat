import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersMonthNavigator } from './OrdersMonthNavigator';

describe('OrdersMonthNavigator', () => {
  it('renders label and triggers prev/next handlers', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    render(
      <OrdersMonthNavigator
        label="يناير 2026"
        onPrev={onPrev}
        onNext={onNext}
      />
    );

    expect(screen.getByText('يناير 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('الشهر السابق'));
    fireEvent.click(screen.getByLabelText('الشهر التالي'));

    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
