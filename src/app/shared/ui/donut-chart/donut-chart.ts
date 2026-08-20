import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

export interface DonutSlice {
  key: string;
  label: string;
  valuePct: number;
  color: string;
}

interface DonutSegment extends DonutSlice {
  dashArray: string;
  dashOffset: number;
}

const RADIUS = 15.9155; // circumference = 100, so each 1% = 1 dash unit
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Interactive SVG donut chart (stroke-based, no chart-library dependency) with a paired legend. */
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  template: `
    <div class="donut-wrap">
      <svg viewBox="0 0 36 36" class="donut" role="img" aria-label="Allocation breakdown">
        <circle cx="18" cy="18" [attr.r]="RADIUS" fill="none" class="track" stroke-width="4.2" />
        @for (seg of segments(); track seg.key) {
          <circle
            cx="18" cy="18" [attr.r]="RADIUS" fill="none"
            [attr.stroke]="seg.color"
            stroke-width="4.2"
            [attr.stroke-dasharray]="seg.dashArray"
            [attr.stroke-dashoffset]="seg.dashOffset"
            class="segment"
            [class.dim]="hovered() && hovered() !== seg.key"
            (mouseenter)="hovered.set(seg.key)"
            (mouseleave)="hovered.set(null)"
            (click)="sliceClick.emit(seg.key)"
            tabindex="0"
            role="button"
            [attr.aria-label]="seg.label + ' ' + seg.valuePct.toFixed(1) + ' percent'"
          />
        }
      </svg>
      <div class="donut-center">
        @if (activeSlice(); as s) {
          <span class="center-value">{{ s.valuePct.toFixed(1) }}%</span>
          <span class="center-label">{{ s.label }}</span>
        } @else {
          <span class="center-value">{{ slices().length }}</span>
          <span class="center-label">Segments</span>
        }
      </div>
    </div>

    <ul class="legend">
      @for (s of slices(); track s.key) {
        <li
          class="legend-item"
          [class.dim]="hovered() && hovered() !== s.key"
          (mouseenter)="hovered.set(s.key)"
          (mouseleave)="hovered.set(null)"
          (click)="sliceClick.emit(s.key)"
        >
          <span class="dot" [style.background]="s.color"></span>
          <span class="legend-label truncate">{{ s.label }}</span>
          <span class="legend-value num">{{ s.valuePct.toFixed(1) }}%</span>
        </li>
      }
    </ul>
  `,
  styles: [
    `
      :host { display: flex; align-items: center; gap: var(--space-6); flex-wrap: wrap; }
      .donut-wrap { position: relative; width: 148px; height: 148px; flex: none; }
      .donut { width: 100%; height: 100%; transform: rotate(-90deg); }
      .track { stroke: var(--bg-secondary); }
      .segment { cursor: pointer; transition: opacity var(--duration-fast) var(--ease-standard); outline: none; }
      .segment.dim { opacity: 0.28; }
      .donut-center {
        position: absolute; inset: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        pointer-events: none;
      }
      .center-value { font-family: var(--font-mono); font-size: 20px; font-weight: 700; }
      .center-label { font-size: 10.5px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 2px; }

      .legend { display: flex; flex-direction: column; gap: 9px; flex: 1; min-width: 160px; }
      .legend-item {
        display: flex; align-items: center; gap: 8px;
        font-size: 12.5px; cursor: pointer;
        transition: opacity var(--duration-fast) var(--ease-standard);
        padding: 3px 0;
      }
      .legend-item.dim { opacity: 0.4; }
      .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
      .legend-label { flex: 1; color: var(--text-primary); }
      .legend-value { color: var(--text-secondary); font-weight: 600; }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonutChart {
  readonly slices = input.required<DonutSlice[]>();
  readonly sliceClick = output<string>();
  protected readonly hovered = signal<string | null>(null);
  protected readonly RADIUS = RADIUS;

  readonly segments = computed<DonutSegment[]>(() => {
    let cumulative = 0;
    return this.slices().map((s) => {
      const dash = (s.valuePct / 100) * CIRCUMFERENCE;
      const seg: DonutSegment = {
        ...s,
        dashArray: `${dash} ${CIRCUMFERENCE - dash}`,
        dashOffset: -((cumulative / 100) * CIRCUMFERENCE),
      };
      cumulative += s.valuePct;
      return seg;
    });
  });

  readonly activeSlice = computed(() => this.slices().find((s) => s.key === this.hovered()) ?? null);
}
