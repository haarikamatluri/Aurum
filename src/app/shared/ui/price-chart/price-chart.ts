import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
  UTCTimestamp,
  createChart,
} from 'lightweight-charts';
import { Candle } from '../../../core/models/common.model';
import { bollinger, ema, sma } from '../../utils/technical-math';
import { Skeleton } from '../skeleton/skeleton';

export interface PriceChartIndicatorState {
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  ema: boolean;
  bollinger: boolean;
  volume: boolean;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Candlestick price chart with volume + configurable SMA/EMA/Bollinger overlays. */
@Component({
  selector: 'app-price-chart',
  standalone: true,
  imports: [Skeleton],
  template: `
    @if (loading()) {
      <app-skeleton height="360px" radius="12px" />
    }
    <div #chartContainer class="chart-container" [style.display]="loading() ? 'none' : 'block'"></div>
  `,
  styles: [`.chart-container { width: 100%; height: 360px; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceChart implements AfterViewInit, OnDestroy {
  readonly candles = input<Candle[]>([]);
  readonly indicators = input<PriceChartIndicatorState>({ sma20: true, sma50: false, sma200: false, ema: false, bollinger: false, volume: true });
  readonly loading = input<boolean>(false);

  private readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('chartContainer');

  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private sma20Series: ISeriesApi<'Line'> | null = null;
  private sma50Series: ISeriesApi<'Line'> | null = null;
  private sma200Series: ISeriesApi<'Line'> | null = null;
  private emaSeries: ISeriesApi<'Line'> | null = null;
  private bollUpperSeries: ISeriesApi<'Line'> | null = null;
  private bollLowerSeries: ISeriesApi<'Line'> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const candles = this.candles();
      const indicators = this.indicators();
      if (!this.chart) return;
      this.applyData(candles, indicators);
    });
  }

  ngAfterViewInit(): void {
    const el = this.containerRef()?.nativeElement;
    if (!el) return;
    this.createChart(el);
    this.applyData(this.candles(), this.indicators());
    this.resizeObserver = new ResizeObserver(() => this.chart?.applyOptions({ width: el.clientWidth }));
    this.resizeObserver.observe(el);
  }

  private createChart(el: HTMLElement): void {
    this.chart = createChart(el, {
      width: el.clientWidth,
      height: 360,
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
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      handleScroll: { mouseWheel: false, pressedMouseMove: true },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: false },
    });

    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: cssVar('--positive') || '#22c55e',
      downColor: cssVar('--negative') || '#ef4444',
      borderVisible: false,
      wickUpColor: cssVar('--positive') || '#22c55e',
      wickDownColor: cssVar('--negative') || '#ef4444',
      priceScaleId: 'right',
    });
    this.chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.08, bottom: 0.24 } });

    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      color: cssVar('--border-strong') || '#34404e',
    });
    this.chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    this.sma20Series = this.chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    this.sma50Series = this.chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    this.sma200Series = this.chart.addSeries(LineSeries, { color: '#f472b6', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    this.emaSeries = this.chart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    this.bollUpperSeries = this.chart.addSeries(LineSeries, { color: 'rgba(139,149,165,0.55)', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
    this.bollLowerSeries = this.chart.addSeries(LineSeries, { color: 'rgba(139,149,165,0.55)', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
  }

  private applyData(candles: Candle[], indicators: PriceChartIndicatorState): void {
    if (!candles.length || !this.candleSeries) return;

    this.candleSeries.setData(
      candles.map((c) => ({ time: this.toUtc(c.t), open: c.open, high: c.high, low: c.low, close: c.close })),
    );

    this.volumeSeries?.setData(
      candles.map((c) => ({
        time: this.toUtc(c.t),
        value: c.volume,
        color: c.close >= c.open ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)',
      })),
    );
    this.volumeSeries?.applyOptions({ visible: indicators.volume });

    this.sma20Series?.setData(indicators.sma20 ? sma(candles, 20).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })) : []);
    this.sma50Series?.setData(indicators.sma50 ? sma(candles, 50).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })) : []);
    this.sma200Series?.setData(indicators.sma200 ? sma(candles, 200).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })) : []);
    this.emaSeries?.setData(indicators.ema ? ema(candles, 20).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })) : []);

    if (indicators.bollinger) {
      const bands = bollinger(candles, 20);
      this.bollUpperSeries?.setData(bands.map((b) => ({ time: b.time as UTCTimestamp, value: b.upper })));
      this.bollLowerSeries?.setData(bands.map((b) => ({ time: b.time as UTCTimestamp, value: b.lower })));
    } else {
      this.bollUpperSeries?.setData([]);
      this.bollLowerSeries?.setData([]);
    }

    this.chart?.timeScale().fitContent();
  }

  private toUtc(t: string): UTCTimestamp {
    return Math.floor(new Date(t).getTime() / 1000) as UTCTimestamp;
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.remove();
  }
}
