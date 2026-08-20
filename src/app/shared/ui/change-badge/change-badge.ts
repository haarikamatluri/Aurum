import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';
import { SignedPercentPipe } from '../../pipes/signed-percent.pipe';

/**
 * Standard "change" pill used across the app for price/portfolio movement.
 * Always renders the numeric value alongside color — never color alone.
 */
@Component({
  selector: 'app-change-badge',
  standalone: true,
  imports: [Icon, SignedPercentPipe],
  template: `
    <span class="chip" [class.pos]="isPositive()" [class.neg]="isNegative()" [class.flat]="isFlat()">
      @if (!isFlat()) {
        <app-icon [name]="isPositive() ? 'arrow-up-right' : 'arrow-down-right'" [size]="size() === 'sm' ? 11 : 13" />
      }
      {{ value() | signedPercent: digits() }}
    </span>
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        font-family: var(--font-mono);
      }
      .pos { color: var(--positive); }
      .neg { color: var(--negative); }
      .flat { color: var(--text-secondary); }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeBadge {
  readonly value = input.required<number>();
  readonly digits = input<number>(2);
  readonly size = input<'sm' | 'md'>('md');

  readonly isPositive = computed(() => this.value() > 0);
  readonly isNegative = computed(() => this.value() < 0);
  readonly isFlat = computed(() => this.value() === 0);
}
