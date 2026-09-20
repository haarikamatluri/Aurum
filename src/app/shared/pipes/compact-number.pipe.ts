import { Pipe, PipeTransform } from '@angular/core';

/** Compacts large magnitudes for dense UI: 4320000000000 -> $4.32T, 92000000 -> 92.0M. */
@Pipe({ name: 'compactNumber', standalone: true })
export class CompactNumberPipe implements PipeTransform {
  transform(value: number | null | undefined, currency = false): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const prefix = currency ? '$' : '';
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`;
    return `${sign}${prefix}${abs.toFixed(currency ? 2 : 0)}`;
  }
}
