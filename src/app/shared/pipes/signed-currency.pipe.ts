import { Pipe, PipeTransform } from '@angular/core';

/** Formats a dollar amount with an explicit +/- sign, e.g. +$1,284.32 / -$512.00. */
@Pipe({ name: 'signedCurrency', standalone: true })
export class SignedCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, digits = 2): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    const abs = Math.abs(value);
    return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  }
}
