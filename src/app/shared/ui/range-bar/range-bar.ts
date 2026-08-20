import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Compact visual range bar for 52W high/low, today's range, etc. */
@Component({
  selector: 'app-range-bar',
  standalone: true,
  template: `
    <div class="range-bar">
      <div class="track">
        @if (secondaryLow() !== undefined && secondaryHigh() !== undefined) {
          <div class="today-range" [style.left.%]="secondaryLowPct()" [style.width.%]="secondaryWidthPct()"></div>
        }
        <div class="marker" [style.left.%]="currentPct()" [attr.aria-label]="'Current value at ' + currentPct().toFixed(0) + '% of range'"></div>
      </div>
      <div class="labels">
        <span class="lo">{{ lowLabel() }}</span>
        <span class="hi">{{ highLabel() }}</span>
      </div>
    </div>
  `,
  styles: [
    `
      .range-bar { width: 100%; }
      .track {
        position: relative;
        height: 6px;
        border-radius: var(--radius-full);
        background: linear-gradient(90deg, var(--negative) 0%, var(--border-strong) 50%, var(--positive) 100%);
        opacity: 0.55;
      }
      .today-range {
        position: absolute;
        top: -2px;
        height: 10px;
        border-radius: var(--radius-full);
        background: var(--accent-bg);
        border: 1px solid var(--accent-border);
      }
      .marker {
        position: absolute;
        top: 50%;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--text-primary);
        border: 2px solid var(--bg);
        box-shadow: 0 0 0 1px var(--border-strong);
        transform: translate(-50%, -50%);
      }
      .labels {
        display: flex;
        justify-content: space-between;
        margin-top: 6px;
        font-size: 11px;
        font-family: var(--font-mono);
        color: var(--text-tertiary);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RangeBar {
  readonly low = input.required<number>();
  readonly high = input.required<number>();
  readonly current = input.required<number>();
  readonly lowLabel = input<string>('');
  readonly highLabel = input<string>('');
  readonly secondaryLow = input<number | undefined>(undefined);
  readonly secondaryHigh = input<number | undefined>(undefined);

  private pct(v: number): number {
    const span = this.high() - this.low() || 1;
    return Math.min(Math.max(((v - this.low()) / span) * 100, 0), 100);
  }

  readonly currentPct = computed(() => this.pct(this.current()));
  readonly secondaryLowPct = computed(() => (this.secondaryLow() !== undefined ? this.pct(this.secondaryLow()!) : 0));
  readonly secondaryWidthPct = computed(() =>
    this.secondaryLow() !== undefined && this.secondaryHigh() !== undefined
      ? Math.max(this.pct(this.secondaryHigh()!) - this.pct(this.secondaryLow()!), 1.5)
      : 0,
  );
}
