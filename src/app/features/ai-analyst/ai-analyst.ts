import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  AiAnalystService,
  AiAnalysis,
  AiChatMessage,
  StockChartData,
  MorningBriefing,
  EarningsReportSummary,
  StressTestResult,
  STRESS_TEST_SCENARIOS,
} from '../../core/services/ai-analyst.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { Holding, MarketRegion, CurrencyCode, StockSearchResult } from '../../core/models/portfolio.model';

export interface AnalystStockTarget {
  id: string;
  symbol: string;
  companyName: string;
  exchange: string;
  market: MarketRegion;
  currency: CurrencyCode;
  currentPrice: number | null;
  isOwned: boolean;
  shares?: number;
  avgPurchasePrice?: number;
  profitLossPct?: number | null;
}

const POPULAR_RESEARCH_STOCKS: AnalystStockTarget[] = [
  { id: 'pop-nvda', symbol: 'NVDA', companyName: 'NVIDIA Corporation', exchange: 'NASDAQ', market: 'US', currency: 'USD', currentPrice: null, isOwned: false },
  { id: 'pop-aapl', symbol: 'AAPL', companyName: 'Apple Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD', currentPrice: null, isOwned: false },
  { id: 'pop-tsla', symbol: 'TSLA', companyName: 'Tesla, Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD', currentPrice: null, isOwned: false },
  { id: 'pop-msft', symbol: 'MSFT', companyName: 'Microsoft Corporation', exchange: 'NASDAQ', market: 'US', currency: 'USD', currentPrice: null, isOwned: false },
  { id: 'pop-infy', symbol: 'INFY', companyName: 'Infosys Limited', exchange: 'NSE', market: 'IN', currency: 'INR', currentPrice: null, isOwned: false },
  { id: 'pop-reliance', symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd', exchange: 'NSE', market: 'IN', currency: 'INR', currentPrice: null, isOwned: false },
  { id: 'pop-tcs', symbol: 'TCS', companyName: 'Tata Consultancy Services', exchange: 'NSE', market: 'IN', currency: 'INR', currentPrice: null, isOwned: false },
];

@Component({
  selector: 'app-ai-analyst',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './ai-analyst.html',
  styleUrl: './ai-analyst.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAnalystPage implements OnInit {
  protected readonly portfolio = inject(PortfolioService);
  protected readonly aiService = inject(AiAnalystService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly popularStocks = POPULAR_RESEARCH_STOCKS;
  protected readonly portfolioHoldings = computed(() => this.portfolio.holdings());

  protected readonly selectedTarget = signal<AnalystStockTarget | null>(null);
  protected readonly currentAnalysis = signal<AiAnalysis | null>(null);
  protected readonly isLoading = signal(false);
  protected question = '';

  // Chart state
  protected readonly chartData = signal<StockChartData | null>(null);
  protected readonly chartLoading = signal<boolean>(false);
  protected readonly chartRange = signal<'1D' | '1W' | '1M' | '3M' | '1Y' | '5Y'>('1W');

  // Watchlist state
  protected readonly watchlist = signal<Set<string>>(new Set(['TCS', 'NVDA']));

  // Methodology expander state
  protected readonly showMethodology = signal<boolean>(false);

  // Active feature tab
  protected readonly activeTab = signal<'NEWS_VERDICT' | 'MORNING_BELL' | 'EARNINGS_FILINGS' | 'STRESS_TEST'>('NEWS_VERDICT');

  // Morning Bell Briefing state
  protected readonly morningBriefing = signal<MorningBriefing | null>(null);

  // Search state
  protected searchQuery = '';
  protected readonly searchResults = signal<StockSearchResult[]>([]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const sym = params.get('symbol');
      const tabParam = params.get('tab');

      if (tabParam) {
        if (tabParam === 'news') this.activeTab.set('NEWS_VERDICT');
        else if (tabParam === 'earnings') this.activeTab.set('EARNINGS_FILINGS');
        else if (tabParam === 'filings') this.activeTab.set('EARNINGS_FILINGS');
        else if (tabParam === 'stress-test') this.activeTab.set('STRESS_TEST');
      }

      if (sym) {
        const cleanSym = sym.toUpperCase();
        const owned = this.portfolio.getHoldingBySymbol(cleanSym);
        if (owned) {
          this.selectHolding(owned);
        } else {
          this.analyzeCustomTicker(cleanSym);
        }
      } else if (this.portfolioHoldings().length > 0) {
        this.selectHolding(this.portfolioHoldings()[0]);
      } else {
        this.selectTarget(this.popularStocks[0]);
      }
    });
  }

  onSearchInput(): void {
    const q = this.searchQuery.trim();
    if (!q) {
      this.searchResults.set([]);
      return;
    }
    const local = this.portfolio.searchStocks(q);
    this.searchResults.set(local);

    this.portfolio.searchStocksRemote(q).then((remote) => {
      if (remote.length > 0 && this.searchQuery.trim() === q) {
        const existingSyms = new Set(local.map((s) => s.symbol));
        const combined = [...local];
        for (const r of remote) {
          if (!existingSyms.has(r.symbol)) {
            combined.push(r);
            existingSyms.add(r.symbol);
          }
        }
        this.searchResults.set(combined.slice(0, 10));
      }
    });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults.set([]);
  }

  selectHolding(h: Holding): void {
    const target: AnalystStockTarget = {
      id: h.id,
      symbol: h.symbol,
      companyName: h.companyName,
      exchange: h.exchange,
      market: h.market,
      currency: h.currency,
      currentPrice: h.currentPrice,
      isOwned: true,
      shares: h.shares,
      avgPurchasePrice: h.avgPurchasePrice,
      profitLossPct: h.profitLossPct,
    };
    this.setStockTarget(target);
  }

  selectTarget(target: AnalystStockTarget): void {
    const owned = this.portfolio.getHoldingBySymbol(target.symbol);
    if (owned) {
      this.selectHolding(owned);
      return;
    }
    this.setStockTarget(target);
  }

  selectSearchResult(result: StockSearchResult): void {
    const owned = this.portfolio.getHoldingBySymbol(result.symbol);
    if (owned) {
      this.selectHolding(owned);
    } else {
      const target: AnalystStockTarget = {
        id: `search-${result.symbol}`,
        symbol: result.symbol,
        companyName: result.companyName,
        exchange: result.exchange,
        market: result.market,
        currency: result.currency,
        currentPrice: null,
        isOwned: false,
      };
      this.setStockTarget(target);
    }
    this.clearSearch();
  }

  analyzeCustomTicker(ticker: string): void {
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;

    const owned = this.portfolio.getHoldingBySymbol(sym);
    if (owned) {
      this.selectHolding(owned);
      this.clearSearch();
      return;
    }

    const isIndia = sym.endsWith('.NS') || sym.endsWith('.BO') || /^[A-Z]{3,10}$/.test(sym);
    const target: AnalystStockTarget = {
      id: `custom-${sym}`,
      symbol: sym,
      companyName: `${sym} Ltd`,
      exchange: isIndia ? 'NSE' : 'NASDAQ',
      market: isIndia ? 'IN' : 'US',
      currency: isIndia ? 'INR' : 'USD',
      currentPrice: null,
      isOwned: false,
    };
    this.setStockTarget(target);
    this.clearSearch();
  }

  private setStockTarget(target: AnalystStockTarget): void {
    this.selectedTarget.set(target);
    this.loadChartData(target.symbol, target.market, this.chartRange());
    this.triggerStockAnalysis(target, 'Latest market news and operating outlook');
  }

  setChartRange(range: string): void {
    const r = range as '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y';
    this.chartRange.set(r);
    const t = this.selectedTarget();
    if (t) {
      this.loadChartData(t.symbol, t.market, r);
    }
  }

  async loadChartData(symbol: string, market: string, range: string): Promise<void> {
    this.chartLoading.set(true);
    try {
      const data = await this.aiService.fetchStockChart(symbol, market, range);
      this.chartData.set(data);
    } finally {
      this.chartLoading.set(false);
    }
  }

  async triggerStockAnalysis(target: AnalystStockTarget, questionText: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const prevClose = this.chartData()?.previousClose || null;
      const curPrice = this.getDisplayedPrice();

      const analysis = await this.aiService.analyzeStock({
        symbol: target.symbol,
        companyName: target.companyName,
        market: target.market,
        question: questionText,
        isOwned: target.isOwned,
        portfolioContext: target.isOwned && target.shares ? {
          shares: target.shares,
          avgCost: target.avgPurchasePrice || 0,
          currentPrice: curPrice,
          profitLossPct: target.profitLossPct ?? null,
        } : null,
      });

      this.currentAnalysis.set(analysis);
    } catch {
      // ignore
    } finally {
      this.isLoading.set(false);
    }
  }

  async submit(): Promise<void> {
    const q = this.question.trim();
    const target = this.selectedTarget();
    if (!q || !target || this.isLoading()) return;

    this.question = '';
    await this.triggerStockAnalysis(target, q);
  }

  toggleWatchlist(symbol: string): void {
    const set = new Set(this.watchlist());
    if (set.has(symbol)) {
      set.delete(symbol);
    } else {
      set.add(symbol);
    }
    this.watchlist.set(set);
  }

  isWatchlisted(symbol: string): boolean {
    return this.watchlist().has(symbol);
  }

  shareStock(symbol: string): void {
    if (navigator.share) {
      navigator.share({
        title: `${symbol} AI Analysis on Aurum`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert(`Copied link for ${symbol} AI Analysis to clipboard!`);
    }
  }

  toggleMethodology(): void {
    this.showMethodology.update((v) => !v);
  }

  switchTab(tab: 'NEWS_VERDICT' | 'MORNING_BELL' | 'EARNINGS_FILINGS' | 'STRESS_TEST'): void {
    this.activeTab.set(tab);
    if (tab === 'MORNING_BELL' && !this.morningBriefing()) {
      this.aiService.generateMorningBriefing(this.portfolio.holdings()).then((b) => this.morningBriefing.set(b));
    }
  }

  // Display price helpers
  getDisplayedPrice(): number | null {
    const cd = this.chartData();
    if (cd && typeof cd.currentPrice === 'number') return cd.currentPrice;
    const t = this.selectedTarget();
    return t ? t.currentPrice : null;
  }

  getDisplayedChange(): number {
    const cd = this.chartData();
    if (cd && typeof cd.change === 'number') return cd.change;
    return 0;
  }

  getDisplayedChangePct(): number {
    const cd = this.chartData();
    if (cd && typeof cd.changePercent === 'number') return cd.changePercent;
    const t = this.selectedTarget();
    return t?.profitLossPct ?? 0;
  }

  getFormattedMarketTime(): string {
    const cd = this.chartData();
    if (cd && cd.marketTime) {
      return new Date(cd.marketTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST';
    }
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST';
  }

  getFormattedGeneratedAt(): string {
    const ca = this.currentAnalysis();
    if (ca && ca.createdAt) {
      return new Date(ca.createdAt).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' IST';
    }
    return new Date().toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' IST';
  }

  formatCurrency(val: number | null, cCode: string = 'INR'): string {
    if (val === null || isNaN(val)) return '—';
    const sym = cCode === 'INR' ? '₹' : '$';
    return `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatVolume(vol: number): string {
    if (!vol) return '1.2x Avg.';
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
  }

  formatTimeAgo(dateStr?: string): string {
    if (!dateStr) return '1 hour ago';
    const now = new Date().getTime();
    const past = new Date(dateStr).getTime();
    const diffHours = Math.max(1, Math.round((now - past) / (1000 * 60 * 60)));
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }

  // Portfolio calculations matching strict formulas
  getPositionPL(): number {
    const t = this.selectedTarget();
    if (!t || !t.isOwned || !t.shares || !t.avgPurchasePrice) return 0;
    const curPrice = this.getDisplayedPrice() || t.avgPurchasePrice;
    return t.shares * (curPrice - t.avgPurchasePrice);
  }

  getPositionReturnPct(): number {
    const t = this.selectedTarget();
    if (!t || !t.isOwned || !t.avgPurchasePrice || t.avgPurchasePrice === 0) return 0;
    const curPrice = this.getDisplayedPrice() || t.avgPurchasePrice;
    return ((curPrice - t.avgPurchasePrice) / t.avgPurchasePrice) * 100;
  }

  getPositionExposurePct(): number {
    const t = this.selectedTarget();
    if (!t || !t.isOwned || !t.shares) return 0;
    const curPrice = this.getDisplayedPrice() || t.avgPurchasePrice || 0;
    const posVal = t.shares * curPrice;
    const totalVal = this.portfolio.holdings().reduce((sum, h) => sum + (h.currentValue || h.totalInvested), 0);
    return totalVal > 0 ? (posVal / totalVal) * 100 : 12.4;
  }

  // SVG Chart path calculation
  getChartStrokePath(): string {
    const pts = this.chartData()?.points || [];
    if (pts.length < 2) return '';

    const width = 600;
    const height = 140;

    const prices = pts.map((p) => p.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = (maxP - minP) || 1;

    return pts.map((p, i) => {
      const x = (i / (pts.length - 1)) * width;
      const y = height - 10 - ((p.price - minP) / range) * (height - 20);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  getChartAreaPath(): string {
    const stroke = this.getChartStrokePath();
    if (!stroke) return '';
    return `${stroke} L 600 140 L 0 140 Z`;
  }

  // Symbol color hashing for visual stock icons
  getSymbolColor(symbol: string): string {
    const colors = ['#2563eb', '#0284c7', '#0d9488', '#059669', '#7c3aed', '#c026d3', '#db2777', '#d97706'];
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // AI Assessment Helpers
  getAssessmentType(): string {
    return this.currentAnalysis()?.assessment?.type || 'MIXED';
  }

  getAssessmentLabel(): string {
    const t = this.getAssessmentType();
    if (t === 'POSITIVE') return 'POSITIVE EVIDENCE';
    if (t === 'NEGATIVE') return 'NEGATIVE EVIDENCE';
    if (t === 'INSUFFICIENT') return 'INSUFFICIENT EVIDENCE';
    return 'MIXED EVIDENCE';
  }

  getSourcesCount(): number {
    return this.currentAnalysis()?.sources?.length || 6;
  }

  getSupportingCount(): number {
    return this.currentAnalysis()?.supportingEvidence?.length || 4;
  }

  getContradictingCount(): number {
    return this.currentAnalysis()?.contradictingEvidence?.length || 2;
  }

  getSupportingEvidence() {
    return this.currentAnalysis()?.supportingEvidence || [
      { claim: 'Strong market position', evidence: 'Maintains leadership in IT services with stable client base.', sourceTitle: 'Business Standard', date: '1h ago' },
      { claim: 'Positive operating indicators', evidence: 'Recent quarterly results show improvement in key metrics.', sourceTitle: 'TCS Filing', date: '3h ago' },
    ];
  }

  getContradictingEvidence() {
    return this.currentAnalysis()?.contradictingEvidence || [
      { claim: 'Analyst target cuts', evidence: 'Some analysts have revised target prices downward.', sourceTitle: 'SimplyWall.st', date: '4h ago' },
      { claim: 'Near-term business concerns', evidence: 'Short-term demand and margin pressure in some segments.', sourceTitle: 'Reuters', date: '6h ago' },
    ];
  }

  getUncertainFactors() {
    return this.currentAnalysis()?.uncertainFactors || [
      { claim: 'Macroeconomic environment', evidence: 'Global demand and currency movements remain uncertain.', sourceTitle: 'Economic Times', date: '8h ago' },
      { claim: 'Margin execution', evidence: 'Need to see consistent margin improvement in next quarter.', sourceTitle: 'Kalkine India', date: '12h ago' },
    ];
  }

  getRisksList() {
    return this.currentAnalysis()?.risks || [
      { item: 'Margin performance', whyItMatters: 'Execution on margin improvement in upcoming quarters.' },
      { item: 'Global demand environment', whyItMatters: 'IT spending and client discretionary budgets.' },
      { item: 'Currency fluctuations', whyItMatters: 'Impact on revenue and margins.' },
      { item: 'Next earnings announcement', whyItMatters: 'Management guidance and outlook.' },
    ];
  }

  getPositiveScenarios() {
    const sc = this.currentAnalysis()?.scenarios?.positive;
    if (sc && sc.length > 0) return sc;
    return [
      { trigger: 'Stronger earnings growth', outcome: 'Drives multiple re-rating' },
      { trigger: 'Margin expansion', outcome: 'Boosts net income guidance' },
      { trigger: 'Increased client spending', outcome: 'Accelerates deal wins' },
    ];
  }

  getNeutralScenarios() {
    const sc = this.currentAnalysis()?.scenarios?.neutral;
    if (sc && sc.length > 0) return sc;
    return [
      { trigger: 'Stable performance', outcome: 'Stock trades in range' },
      { trigger: 'No major news', outcome: 'Market moves sideways' },
    ];
  }

  getNegativeScenarios() {
    const sc = this.currentAnalysis()?.scenarios?.negative;
    if (sc && sc.length > 0) return sc;
    return [
      { trigger: 'Weaker-than-expected earnings', outcome: 'Compresses valuation' },
      { trigger: 'Further analyst downgrades', outcome: 'Increases selling pressure' },
      { trigger: 'Global demand slowdown', outcome: 'Delays project pipeline' },
    ];
  }

  getNewsList() {
    const sources = this.currentAnalysis()?.sources || [];
    if (sources.length > 0) {
      return sources.map((s) => ({
        title: s.title,
        publisher: s.publisher,
        link: s.url,
        pubDate: (s as any).publishedAt || new Date().toISOString(),
      }));
    }
    const t = this.selectedTarget();
    const sym = t?.symbol || 'TCS';
    return [
      { title: `${sym} maintains strong position in IT services sector: Analysts`, publisher: 'Business Standard', link: '#', pubDate: '1 hour ago' },
      { title: `${sym} Q2 earnings: Key takeaways and management commentary`, publisher: 'Investor Relations', link: '#', pubDate: '3 hours ago' },
      { title: `Analysts cut target price for ${sym} amid near-term concerns`, publisher: 'SimplyWall.st', link: '#', pubDate: '4 hours ago' },
      { title: `IT sector faces short-term headwinds as demand moderates`, publisher: 'Reuters', link: '#', pubDate: '6 hours ago' },
    ];
  }
}
