// formatters.ts - Utility functions for formatting dates, currency, and numbers

/**
 * Format a date to YYYY-MM-DD format.
 * @param date - The date object to format.
 * @returns Formatted date string.
 */
export function formatDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format a number as currency.
 * @param amount - The amount to format.
 * @param currencySymbol - The symbol of the currency (default is '$').
 * @returns Formatted currency string.
 */
export function formatCurrency(amount: number, currencySymbol: string = '$'): string {
    return `${currencySymbol}${amount.toFixed(2)}`;
}

/**
 * Format a number with commas as thousands separators.
 * @param num - The number to format.
 * @returns Formatted number string.
 */
export function formatNumber(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}