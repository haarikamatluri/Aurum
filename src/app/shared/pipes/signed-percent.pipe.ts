import { Pipe, PipeTransform } from '@angular/core';

/** Formats a percentage with an explicit +/- sign — financial UX rule: numbers, never color-only. */
@Pipe({ name: 'signedPercent', standalone: true })
export class SignedPercentPipe implements PipeTransform {
  transform(value: number | null | undefined, digits = 2): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(digits)}%`;
  }
}
