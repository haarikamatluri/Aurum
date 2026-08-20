import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
  UTCTimestamp,
  createChart,
} from 'lightweight-charts';
import { PerformancePoint } from '../../../core/models/portfolio.model';
import { Skeleton } from '../skeleton/skeleton';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function toUtc(t: string): UTCTimestamp {
  return Math.floor(new Date(t).getTime() / 1000) as UTCTimestamp;
}

interface HoverState {
  t: string;
  portfolio: number;
  benchmark: number;
}

/**
 * Portfolio-vs-benchmark performance chart. Wraps lightweight-charts (crosshair, tooltip,
 * legend, responsive resize come from the library) with a small custom legend/tooltip
 * overlay styled to match the design system.
 */
@Component({
  selector: 'app-performance-chart',
  standalone: true,
  imports: [Skeleton],
  template: `
    <div class="chart-shell">
      <div class="legend">
        <span class="legend-item"><span class="dot portfolio"></span>Portfolio</span>
        <span class="legend-item"><span class="dot benchmark"></span>S&amp;P 500</span>
      </div>

      @if (hover(); as h) {
        <div class="hover-readout">
          <span class="hover-time">{{ formatDate(h.t) }}</span>
          <span class="hover-val portfolio">Portfolio {{ h.portfolio >= 0 ? '+' : '' }}{{ h.portfolio.toFixed(2) }}%</span>
          <span class="hover-val benchmark">S&amp;P 500 {{ h.benchmark >= 0 ? '+' : '' }}{{ h.benchmark.toFixed(2) }}%</span>
        </div>
      }

      @if (loading()) {
        <app-skeleton height="280px" radius="12px" />
      }
      <div #chartContainer class="chart-container" [style.display]="loading() ? 'none' : 'block'"></div>
    </div>
  `,
  styles: [
    `
      .chart-shell { position: relative; width: 100%; }
      .chart-container { width: 100%; height: 280px; }
      .legend { display: flex; gap: var(--space-4); font-size: 12px; margin-bottom: var(--space-2); color: var(--text-secondary); }
      .legend-item { display: flex; align-items: center; gap: 6px; font-weight: 600; }
      .dot { width: 8px; height: 8px; border-radius: 50%; }
      .dot.portfolio { background: var(--accent); }
      .dot.benchmark { background: var(--text-tertiary); }
      .hover-readout {
        position: absolute;
        top: 0;
        right: 0;
        display: flex;
        gap: var(--space-3);
        font-size: 11.5px;
        font-family: var(--font-mono);
        background: var(--surface-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 4px 10px;
        z-index: 2;
        box-shadow: var(--shadow-sm);
      }
      .hover-time { color: var(--text-tertiary); }
      .hover-val.portfolio { color: var(--accent); font-weight: 700; }
      .hover-val.benchmark { color: var(--text-secondary); font-weight: 700; }
      @media (max-width: 640px) {
        .hover-readout { position: static; margin-bottom: var(--space-2); width: fit-content; }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerformanceChart implements AfterViewInit, OnDestroy {
  readonly data = input<PerformancePoint[]>([]);
  readonly loading = input<boolean>(false);

  private readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('chartContainer');
  protected readonly hover = signal<HoverState | null>(null);

  private chart: IChartApi | null = null;
  private portfolioSeries: ISeriesApi<'Area'> | null = null;
  private benchmarkSeries: ISeriesApi<'Line'> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const points = this.data();
      if (!this.chart || !this.portfolioSeries || !this.benchmarkSeries) return;
      this.applyData(points);
    });
  }

  ngAfterViewInit(): void {
    const el = this.containerRef()?.nativeElement;
    if (!el) return;
    this.createChart(el);
    this.applyData(this.data());

    this.resizeObserver = new ResizeObserver(() => {
      this.chart?.applyOptions({ width: el.clientWidth });
    });
    this.resizeObserver.observe(el);
  }

  private createChart(el: HTMLElement): void {
    this.chart = createChart(el, {
      width: el.clientWidth,
      height: 280,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: cssVar('--text-secondary') || '#8b95a5',
        fontFamily: cssVar('--font-sans'),
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: cssVar('--border-subtle') || '#1c232d' },
      },
      rightPriceScale: {
        borderVisible: false,
        textColor: cssVar('--text-tertiary') || '#5b6472',
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: cssVar('--border-strong') || '#34404e', width: 1, style: LineStyle.Solid, labelBackgroundColor: cssVar('--surface-elevated') || '#1b222c' },
        horzLine: { color: cssVar('--border-strong') || '#34404e', width: 1, style: LineStyle.Solid, labelBackgroundColor: cssVar('--surface-elevated') || '#1b222c' },
      },
      handleScroll: { mouseWheel: false, pressedMouseMove: true },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: false },
    });

    this.portfolioSeries = this.chart.addSeries(AreaSeries, {
      lineColor: cssVar('--accent') || '#6366f1',
      topColor: 'rgba(99, 102, 241, 0.28)',
      bottomColor: 'rgba(99, 102, 241, 0.02)',
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, minMove: 0.01 },
    });

    this.benchmarkSeries = this.chart.addSeries(LineSeries, {
      color: cssVar('--text-tertiary') || '#5b6472',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceFormat: { type: 'custom', formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, minMove: 0.01 },
    });

    this.chart.subscribeCrosshairMove((param) => {
      if (!param.time || !this.portfolioSeries || !this.benchmarkSeries) {
        this.hover.set(null);
        return;
      }
      const p = param.seriesData.get(this.portfolioSeries) as { value: number } | undefined;
      const b = param.seriesData.get(this.benchmarkSeries) as { value: number } | undefined;
      if (!p || !b) {
        this.hover.set(null);
        return;
      }
      this.hover.set({ t: new Date((param.time as number) * 1000).toISOString(), portfolio: p.value, benchmark: b.value });
    });
  }

  private applyData(points: PerformancePoint[]): void {
    if (!points.length || !this.portfolioSeries || !this.benchmarkSeries) return;
    this.portfolioSeries.setData(points.map((p) => ({ time: toUtc(p.t), value: p.portfolioReturnPct })));
    this.benchmarkSeries.setData(points.map((p) => ({ time: toUtc(p.t), value: p.benchmarkReturnPct })));
    this.chart?.timeScale().fitContent();
  }

  formatDate(t: string): string {
    const d = new Date(t);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.remove();
  }
}
