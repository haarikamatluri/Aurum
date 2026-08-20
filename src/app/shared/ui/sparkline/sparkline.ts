import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SeriesPoint } from '../../../core/models/common.model';

/** Minimal inline SVG sparkline — no charting-library overhead for tiny trend previews. */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  template: `
    <svg [attr.viewBox]="'0 0 ' + vbWidth + ' ' + vbHeight" preserveAspectRatio="none" class="spark" [class.positive]="isPositive()" [class.negative]="!isPositive()">
      @if (areaPath()) {
        <path [attr.d]="areaPath()" class="area" />
      }
      <path [attr.d]="linePath()" class="line" />
    </svg>
  `,
  styles: [
    `
      :host { display: block; width: 100%; height: 100%; }
      .spark { width: 100%; height: 100%; overflow: visible; }
      .line { fill: none; stroke-width: 1.6; vector-effect: non-scaling-stroke; }
      .area { stroke: none; opacity: 0.14; }
      .positive .line { stroke: var(--positive); }
      .positive .area { fill: var(--positive); }
      .negative .line { stroke: var(--negative); }
      .negative .area { fill: var(--negative); }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sparkline {
  readonly points = input.required<SeriesPoint[]>();
  readonly showArea = input<boolean>(true);

  protected readonly vbWidth = 120;
  protected readonly vbHeight = 36;

  private readonly coords = computed(() => {
    const pts = this.points();
    if (!pts.length) return [] as { x: number; y: number }[];
    const values = pts.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return pts.map((p, i) => ({
      x: (i / Math.max(pts.length - 1, 1)) * this.vbWidth,
      y: this.vbHeight - ((p.v - min) / span) * (this.vbHeight - 4) - 2,
    }));
  });

  readonly isPositive = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return true;
    return pts[pts.length - 1].v >= pts[0].v;
  });

  readonly linePath = computed(() => {
    const c = this.coords();
    if (!c.length) return '';
    return c.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  });

  readonly areaPath = computed(() => {
    if (!this.showArea()) return '';
    const c = this.coords();
    if (!c.length) return '';
    const line = this.linePath();
    return `${line} L${c[c.length - 1].x.toFixed(2)},${this.vbHeight} L${c[0].x.toFixed(2)},${this.vbHeight} Z`;
  });
}
