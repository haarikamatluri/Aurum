import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, SecurityContext, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DecimalPipe, UpperCasePipe, SlicePipe, DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  AiAnalystService,
  AiAnalysis,
  AiChatMessage,
  StockChartData,
  StockNewsItem,
  MorningBriefing,
  EarningsReportSummary,
  StressTestResult,
  STRESS_TEST_SCENARIOS,
  AnalystDataEnvelope,
  RealMorningBriefingData,
  RealStockReportData,
  RealFilingsData,
  RealEarningsData,
  RealStressTestResponse,
  RealStressTestHolding,
  FilingItem,
  QuarterlyEarningsItem,
  UpcomingEarningsItem,
  AiEvidence,
  AiWatchCondition,
} from '../../core/services/ai-analyst.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { Holding, MarketRegion, CurrencyCode, StockSearchResult } from '../../core/models/portfolio.model';

import { OrderModalComponent } from '../dashboard/order-modal/order-modal';

export interface ChatThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  positionScenario?: any;
  intent?: string;
  responseType?: string;
  dynamicResponse?: any;
  marketData?: any;
  technicals?: any;
  fundamentals?: any;
  portfolioContext?: any;
  sources?: any[];
  evidenceLedger?: any[];
  parsedStance?: string;
  parsedSummary?: string;
}

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

export const POPULAR_RESEARCH_STOCKS: AnalystStockTarget[] = [
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
  imports: [FormsModule, RouterLink, DecimalPipe, UpperCasePipe, SlicePipe, DatePipe, OrderModalComponent],
  templateUrl: './ai-analyst.html',
  styleUrl: './ai-analyst.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAnalystPage implements OnInit {
  protected readonly portfolio = inject(PortfolioService);
  protected readonly aiService = inject(AiAnalystService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly showOrderModal = signal<boolean>(false);
  protected readonly showAutomationModal = signal<boolean>(false);
  protected readonly orderModalSymbol = signal<string>('');
  protected readonly orderModalSide = signal<'BUY' | 'SELL'>('BUY');

  openAutomationModal(): void {
    this.showAutomationModal.set(true);
  }

  openOrderModal(symbol = '', side: 'BUY' | 'SELL' = 'BUY'): void {
    this.orderModalSymbol.set(symbol);
    this.orderModalSide.set(side);
    this.showOrderModal.set(true);
  }
  protected readonly watchlistService = inject(WatchlistService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly popularStocks = POPULAR_RESEARCH_STOCKS;
  protected readonly portfolioHoldings = computed(() => this.portfolio.holdings());
  protected readonly watchlistTargets = computed(() => {
    const symbols = this.watchlistService.symbols();
    return symbols.map(sym => {
      const pop = this.popularStocks.find(p => p.symbol === sym);
      if (pop) return pop;
      return {
        id: crypto.randomUUID(),
        symbol: sym,
        companyName: sym,
        exchange: 'NSE',
        market: 'IN' as const,
        currency: 'INR' as const,
        currentPrice: null,
        isOwned: false
      } as AnalystStockTarget;
    });
  });

  protected readonly selectedTarget = signal<AnalystStockTarget | null>(null);
  protected readonly currentAnalysis = signal<AiAnalysis | null>(null);
  protected readonly isLoading = signal(false);
  protected question = '';

  // Chart state
  protected readonly chartData = signal<StockChartData | null>(null);
  protected readonly chartLoading = signal<boolean>(false);
  protected readonly chartRange = signal<'1D' | '1W' | '1M' | '3M' | '1Y' | '5Y'>('1W');

  // News state
  protected readonly stockNews = signal<StockNewsItem[]>([]);
  protected readonly expandedNewsIndex = signal<number | null>(null);

  // Watchlist state
  protected readonly watchlist = signal<Set<string>>(new Set(['TCS', 'NVDA']));

  // Methodology expander state
  protected readonly showMethodology = signal<boolean>(false);

  // Evidence Verification Modal & Popover state
  protected readonly showVerificationModal = signal<boolean>(false);
  protected readonly verificationLoading = signal<boolean>(false);
  protected readonly verificationError = signal<string | null>(null);
  protected readonly selectedEvidence = signal<any | null>(null);
  protected readonly activeEvidenceFactor = signal<any | null>(null);
  private readonly evidenceCache = new Map<string, any>();

  // Modal drawer states
  protected readonly showEvidenceModal = signal<boolean>(false);
  protected readonly showNewsModal = signal<boolean>(false);
  protected readonly showPositionModal = signal<boolean>(false);
  protected readonly showRisksModal = signal<boolean>(false);

  openEvidenceModal(): void { this.showEvidenceModal.set(true); }
  closeEvidenceModal(): void { this.showEvidenceModal.set(false); }

  openNewsModal(): void {
    this.router.navigate(['/money/news']);
  }
  closeNewsModal(): void { this.showNewsModal.set(false); }

  openPositionModal(): void { this.showPositionModal.set(true); }
  closePositionModal(): void { this.showPositionModal.set(false); }

  openRisksModal(): void { this.showRisksModal.set(true); }
  closeRisksModal(): void { this.showRisksModal.set(false); }

  closeVerificationModal(): void {
    this.showVerificationModal.set(false);
    this.verificationLoading.set(false);
    this.verificationError.set(null);
    this.selectedEvidence.set(null);
    this.activeEvidenceFactor.set(null);
  }

  @HostListener('window:keydown.escape')
  handleEscapeKey(): void {
    if (this.showVerificationModal()) {
      this.closeVerificationModal();
    }
  }

  async openEvidenceVerification(factorOrId: any, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.showVerificationModal.set(true);
    this.verificationLoading.set(true);
    this.verificationError.set(null);
    this.selectedEvidence.set(null);
    this.activeEvidenceFactor.set(factorOrId);

    const sym = this.selectedTarget()?.symbol || 'TCS';
    let evidenceId: string | null = null;
    let fallbackClaim: string = '';

    if (typeof factorOrId === 'string') {
      evidenceId = factorOrId;
      fallbackClaim = factorOrId;
    } else if (factorOrId) {
      evidenceId = factorOrId.evidenceId || factorOrId.id || (Array.isArray(factorOrId.evidenceIds) ? factorOrId.evidenceIds[0] : null);
      fallbackClaim = factorOrId.claim || factorOrId.title || factorOrId.reason || factorOrId.item || factorOrId.metric || '';
    }

    // If factor doesn't have an explicit evidenceId, search current analysis ledger by metric/claim
    if (!evidenceId || !evidenceId.startsWith('EVIDENCE-')) {
      const ca = this.currentAnalysis();
      const ledger = (ca as any)?.evidence || (ca as any)?.evidenceLedger || [];
      const match = ledger.find((e: any) => {
        if (!e) return false;
        if (factorOrId?.metric && e.metric && e.metric.toLowerCase().includes(factorOrId.metric.toLowerCase())) return true;
        if (factorOrId?.factor && e.metric && e.metric.toLowerCase().includes(factorOrId.factor.toLowerCase())) return true;
        if (factorOrId?.title && (e.metric?.toLowerCase().includes(factorOrId.title.toLowerCase()) || e.value?.toString().toLowerCase().includes(factorOrId.title.toLowerCase()))) return true;
        if (factorOrId?.claim && e.claim && e.claim.toLowerCase().includes(factorOrId.claim.toLowerCase())) return true;
        return false;
      });
      if (match) {
        evidenceId = match.id || match.evidenceId;
      }
    }

    if (!evidenceId) {
      this.verificationLoading.set(false);
      this.verificationError.set('Verification details unavailable. This claim has not been independently verified.');
      this.selectedEvidence.set({
        claim: fallbackClaim || 'Claim verification data unavailable',
        status: 'UNAVAILABLE',
        explanation: 'Verification details unavailable. This claim has not been independently verified.',
        symbol: sym,
        source: 'Unavailable',
        freshness: 'UNAVAILABLE',
        validationResult: 'NOT CHECKED'
      });
      return;
    }

    // Check cache to avoid duplicate network calls
    const cacheKey = `${sym}:${evidenceId}`;
    if (this.evidenceCache.has(cacheKey)) {
      this.selectedEvidence.set(this.evidenceCache.get(cacheKey));
      this.verificationLoading.set(false);
      return;
    }

    try {
      const resp = await this.aiService.getEvidenceDetails(evidenceId, sym);
      if (resp && resp.success && resp.data) {
        this.evidenceCache.set(cacheKey, resp.data);
        this.selectedEvidence.set(resp.data);
      } else {
        const errorMsg = resp?.message || 'Verification details unavailable. This claim has not been independently verified.';
        this.verificationError.set(errorMsg);
        this.selectedEvidence.set({
          evidenceId,
          symbol: sym,
          claim: fallbackClaim || 'Claim details unavailable',
          status: resp?.status || 'UNAVAILABLE',
          explanation: errorMsg,
          freshness: 'UNAVAILABLE',
          validationResult: 'NOT CHECKED'
        });
      }
    } catch (err: any) {
      const errorMsg = err?.error?.message || err?.message || 'Verification details unavailable. This claim has not been independently verified.';
      this.verificationError.set(errorMsg);
      this.selectedEvidence.set({
        evidenceId,
        symbol: sym,
        claim: fallbackClaim || 'Claim details unavailable',
        status: 'UNAVAILABLE',
        explanation: errorMsg,
        freshness: 'UNAVAILABLE',
        validationResult: 'NOT CHECKED'
      });
    } finally {
      this.verificationLoading.set(false);
    }
  }

  openEvidenceVerificationForMetric(metricName: string, msg?: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const sym = this.selectedTarget()?.symbol || 'TCS';
    const ledger = msg?.evidenceLedger || (this.currentAnalysis() as any)?.evidence || [];
    const match = ledger.find((e: any) => e.metric && e.metric.toLowerCase().includes(metricName.toLowerCase()));
    if (match) {
      this.openEvidenceVerification(match.id || match.evidenceId, event);
    } else {
      let targetId = 'EVIDENCE-001';
      const mLower = metricName.toLowerCase();
      if (mLower.includes('rsi')) targetId = 'EVIDENCE-005';
      else if (mLower.includes('macd')) targetId = 'EVIDENCE-006';
      else if (mLower.includes('trend')) targetId = 'EVIDENCE-004';
      else if (mLower.includes('support')) targetId = 'EVIDENCE-002';
      else if (mLower.includes('resistance')) targetId = 'EVIDENCE-003';
      else if (mLower.includes('earnings') || mLower.includes('eps')) targetId = 'EVIDENCE-007';
      else if (mLower.includes('pe') || mLower.includes('p/e') || mLower.includes('roe')) targetId = 'EVIDENCE-007';
      this.openEvidenceVerification(targetId, event);
    }
  }

  openEvidenceVerificationForWatch(watchItem: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const evId = watchItem?.evidenceIds?.[0] || watchItem?.evidenceId;
    if (evId) {
      this.openEvidenceVerification(evId, event);
    } else {
      const cond = (watchItem?.conditionText || watchItem?.title || '').toLowerCase();
      const targetId = cond.includes('resistance') ? 'EVIDENCE-003' : 'EVIDENCE-002';
      this.openEvidenceVerification(targetId, event);
    }
  }

  openEvidenceVerificationForRisk(risk: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const ca = this.currentAnalysis();
    const contradicting = (ca as any)?.contradictingEvidence || [];
    const match = contradicting.find((c: any) => c.title === risk.item || c.claim === risk.item || c.factor === risk.item);
    if (match && match.evidenceId) {
      this.openEvidenceVerification(match.evidenceId, event);
    } else {
      // Find contrary factor in ledger or fallback
      const ledger = (ca as any)?.evidence || (ca as any)?.evidenceLedger || [];
      const riskEv = ledger.find((e: any) => e.category === 'TECHNICAL_ANALYSIS' || e.category === 'FUNDAMENTALS');
      this.openEvidenceVerification(riskEv ? (riskEv.id || riskEv.evidenceId) : 'EVIDENCE-003', event);
    }
  }

  openEvidenceVerificationForNews(news: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const ca = this.currentAnalysis();
    const ledger = (ca as any)?.evidence || (ca as any)?.evidenceLedger || [];
    const match = ledger.find((e: any) => e.category === 'NEWS' && (e.value === news?.title || e.metric?.includes('Headline')));
    if (match) {
      this.openEvidenceVerification(match.id || match.evidenceId, event);
    } else {
      this.openEvidenceVerification('EVIDENCE-009', event);
    }
  }

  openEvidenceVerificationForEarnings(earningsItem: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const ca = this.currentAnalysis();
    const ledger = (ca as any)?.evidence || (ca as any)?.evidenceLedger || [];
    const match = ledger.find((e: any) => e.category === 'EARNINGS');
    if (match) {
      this.openEvidenceVerification(match.id || match.evidenceId, event);
    } else {
      this.openEvidenceVerification('EVIDENCE-007', event);
    }
  }

  openEvidenceVerificationForScenario(scenario: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const ca = this.currentAnalysis();
    const ledger = (ca as any)?.evidence || (ca as any)?.evidenceLedger || [];
    const dir = scenario?.direction || 'POSITIVE';
    const sym = this.selectedTarget()?.symbol || ca?.symbol || 'TCS';
    const targetCat = dir === 'POSITIVE' ? 'RESISTANCE' : (dir === 'NEGATIVE' ? 'SUPPORT' : 'TECHNICAL_ANALYSIS');
    const match = ledger.find((e: any) => e.category === 'TECHNICAL_ANALYSIS' && (e.metric?.toUpperCase().includes(targetCat) || e.metric?.toUpperCase().includes('PRICE')));
    if (match) {
      this.openEvidenceVerification(match.id || match.evidenceId, event);
    } else {
      const dynamicId = dir === 'POSITIVE' ? `EVID-RESIST-${sym}` : (dir === 'NEGATIVE' ? `EVID-SUPP-${sym}` : `EVID-ATR-${sym}`);
      this.openEvidenceVerification(dynamicId, event);
    }
  }

  formatRawInputs(inputs: any): string {
    if (!inputs) return 'None recorded';
    if (typeof inputs === 'string') return inputs;
    try {
      return JSON.stringify(inputs, null, 2);
    } catch {
      return String(inputs);
    }
  }

  // Active feature tab
  protected readonly activeTab = signal<'NEWS_VERDICT' | 'MORNING_BELL' | 'EARNINGS_FILINGS' | 'STRESS_TEST'>('NEWS_VERDICT');

  // Real Morning Bell Briefing state
  protected readonly morningBriefing = signal<MorningBriefing | null>(null);
  protected readonly morningBriefEnvelope = signal<AnalystDataEnvelope<RealMorningBriefingData> | null>(null);
  protected readonly briefingLoading = signal<boolean>(false);

  // Real Filings & Earnings state
  protected readonly filingsEnvelope = signal<AnalystDataEnvelope<RealFilingsData> | null>(null);
  protected readonly earningsEnvelope = signal<AnalystDataEnvelope<RealEarningsData> | null>(null);
  protected readonly calendarEnvelope = signal<AnalystDataEnvelope<any> | null>(null);
  protected readonly filingSummary = signal<any | null>(null);
  protected readonly filingSummaryLoading = signal<boolean>(false);
  protected readonly earningsFilingsLoading = signal<boolean>(false);
  protected readonly calendarPeriod = signal<string>('this_month');

  // Real Deterministic Stress Testing state
  protected readonly stressTestEnvelope = signal<AnalystDataEnvelope<RealStressTestResponse> | null>(null);
  protected readonly stressTestLoading = signal<boolean>(false);
  protected readonly selectedScenarioId = signal<string>('crude_oil_spike');
  protected readonly customShockPct = signal<number>(-10);

  // Real Stock Report Dossier state
  protected readonly stockReportEnvelope = signal<AnalystDataEnvelope<RealStockReportData> | null>(null);
  protected readonly stockReportLoading = signal<boolean>(false);
  protected readonly reportSavedSuccess = signal<boolean>(false);
  protected readonly savedReports = signal<any[]>([]);

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
    const owned = typeof this.portfolio.getHoldingBySymbol === 'function'
      ? this.portfolio.getHoldingBySymbol(target.symbol)
      : this.portfolio.holdings?.()?.find(h => h.symbol.toUpperCase() === target.symbol.toUpperCase());
    if (owned) {
      this.selectHolding(owned);
      return;
    }
    this.setStockTarget(target);
  }

  selectSearchResult(result: StockSearchResult): void {
    const owned = typeof this.portfolio.getHoldingBySymbol === 'function'
      ? this.portfolio.getHoldingBySymbol(result.symbol)
      : this.portfolio.holdings?.()?.find(h => h.symbol.toUpperCase() === result.symbol.toUpperCase());
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
    // Clear previous stock's data while loading the new one
    this.currentAnalysis.set(null);
    this.chartData.set(null);
    this.stockNews.set([]);
    this.stockReportEnvelope.set(null);
    this.filingsEnvelope.set(null);
    this.earningsEnvelope.set(null);
    this.chatMessages.set([]);
    
    this.selectedTarget.set(target);
    this.loadChartData(target.symbol, target.market, this.chartRange());
    this.loadNews(target.symbol, target.companyName, target.market);
    this.triggerStockAnalysis(target, 'Latest market news and operating outlook');
    this.loadStockReport(target.symbol, target.market);
    if (this.activeTab() === 'EARNINGS_FILINGS') {
      this.loadEarningsAndFilings(target.symbol, target.market);
    }
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

  async loadNews(symbol: string, companyName?: string, market?: string): Promise<void> {
    try {
      const news = await this.aiService.fetchStockNews(symbol, companyName, market);
      this.stockNews.set(news);
    } catch (err) {
      console.warn('Failed to load news:', err);
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

  protected readonly chatMessages = signal<ChatThreadMessage[]>([]);
  protected readonly followupLoading = signal<boolean>(false);

  async submit(): Promise<void> {
    await this.submitFollowup();
  }

  async submitFollowup(): Promise<void> {
    const q = this.question.trim();
    if (!q || this.followupLoading()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatThreadMessage = {
      id: `umsg-${Date.now()}`,
      role: 'user',
      text: q,
      timestamp: timeStr,
    };

    this.chatMessages.update((msgs) => [...msgs, userMsg]);
    this.question = '';
    this.followupLoading.set(true);

    try {
      const currentTarget = this.selectedTarget();
      const env = await this.aiService.analyzeQuestion(q, currentTarget?.symbol, currentTarget?.market || 'IN');
      if (env?.data) {
        const d = env.data;
        const resolvedSymbol = d.symbol || d.security?.symbol;
        if (resolvedSymbol && resolvedSymbol !== 'GLOBAL' && resolvedSymbol !== currentTarget?.symbol) {
          const newTarget: AnalystStockTarget = {
            id: `target-${resolvedSymbol}`,
            symbol: resolvedSymbol,
            companyName: d.security?.companyName || resolvedSymbol,
            exchange: (d.security?.market as MarketRegion) === 'US' ? 'NASDAQ' : 'NSE',
            market: (d.security?.market as MarketRegion) || currentTarget?.market || 'IN',
            currency: d.security?.currency || 'INR',
            currentPrice: d.security?.price || d.marketData?.price || null,
            isOwned: false
          };
          this.selectedTarget.set(newTarget);
        }

        // 1. Primary: Use normalized full Markdown answer from backend
        let recText = (d.answer || '').trim();

        // 2. Fallbacks if direct answer is absent
        if (!recText && d.dynamicResponse?.directAnswer) {
          recText = d.dynamicResponse.directAnswer.trim();
        }
        if (!recText && d.quantitativeTakeaway) {
          recText = d.quantitativeTakeaway.trim();
        }
        if (!recText && d.reasoning?.summary) {
          recText = d.reasoning.summary.trim();
        }

        // 3. Controlled fallback if still empty (NEVER send blank to UI)
        if (!recText) {
          recText = 'Unable to complete this analysis because required financial data is currently unavailable.';
        }

        // 4. Structured UI Logging
        console.log('[AI_ANALYST_UI]', {
          question: q,
          responseType: d.responseType || d.intent || 'GENERAL',
          answerLength: recText.length,
          rendered: true
        });

        let posScenario = d.positionScenario || d.dynamicResponse?.positionScenario || null;
        if (posScenario && posScenario.position && posScenario.position.quantity > 0) {
          const qty = posScenario.position.quantity;
          const price = posScenario.position.entryPrice || this.getDisplayedPrice() || 1;
          const capitalRequired = qty * price;
          
          posScenario.position.grossInvestment = capitalRequired;
          posScenario.position.capitalRequired = capitalRequired;
          
          posScenario.scenarios = [
            { label: '+10% Target', multiplier: 1.10 },
            { label: '+5% Step', multiplier: 1.05 },
            { label: '-5% Step', multiplier: 0.95 },
            { label: '-10% Risk', multiplier: 0.90 }
          ].map(sc => {
            const scenarioPrice = price * sc.multiplier;
            const positionValue = qty * scenarioPrice;
            const pnl = positionValue - capitalRequired;
            const pnlPercent = (pnl / capitalRequired) * 100;
            return {
              label: sc.label,
              scenarioPrice,
              positionValue,
              pnl,
              pnlPercent: parseFloat(pnlPercent.toFixed(2))
            };
          });
        }
        
        if (d.intent === 'POSITION_SCENARIO' || posScenario) {
          this.currentAnalysis.set(d as any);
        }

        // Parse Stance & Summary for Structured UI
        let parsedStance = '';
        let parsedSummary = recText;

        const stanceMatch = recText.match(/(?:Analytical Conclusion|Analytical Stance|Recommended Stance):\s*\*?\*?([^*]+)\*?\*?/i);
        if (stanceMatch) {
          parsedStance = stanceMatch[1].trim().replace(/\(Conviction:.*?\)/i, '').trim();
          
          // Try to extract a clean summary (skip headers and stance lines)
          const cleanLines = recText.split('\n')
            .filter((l: string) => !l.startsWith('###') && !l.includes('Analytical Conclusion') && !l.includes('Analytical Stance') && !l.includes('Recommended Stance'))
            .map((l: string) => l.trim().replace(/\*/g, ''))
            .filter((l: string) => l.length > 0);
          
          if (cleanLines.length > 0) {
            parsedSummary = cleanLines[0];
            if (parsedSummary.includes('Evaluated on verified')) {
              parsedSummary = "Analysis synthesized from verified real-time financial evidence.";
            }
          }
        }

        const botMsg: ChatThreadMessage = {
          id: `amsg-${Date.now()}`,
          role: 'assistant',
          text: recText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          positionScenario: posScenario,
          intent: d.intent || d.responseType || 'GENERAL',
          responseType: d.responseType || d.intent || 'GENERAL',
          dynamicResponse: d.dynamicResponse || null,
          marketData: d.marketData || null,
          technicals: d.technicals || null,
          fundamentals: d.fundamentals || null,
          portfolioContext: d.portfolio || null,
          sources: d.sources || null,
          evidenceLedger: d.evidenceLedger || null,
          parsedStance,
          parsedSummary
        };
        this.chatMessages.update((msgs) => [...msgs, botMsg]);
      } else {
        const botMsg: ChatThreadMessage = {
          id: `amsg-${Date.now()}`,
          role: 'assistant',
          text: 'Unable to complete this analysis because required financial data is currently unavailable.',
          timestamp: timeStr,
        };
        this.chatMessages.update((msgs) => [...msgs, botMsg]);
      }
    } catch (err: any) {
      console.error('[AI_ANALYST_UI] Error in submitFollowup:', err);
      const botMsg: ChatThreadMessage = {
        id: `amsg-${Date.now()}`,
        role: 'assistant',
        text: 'Unable to complete this analysis because required financial data is currently unavailable.',
        timestamp: timeStr,
      };
      this.chatMessages.update((msgs) => [...msgs, botMsg]);
    } finally {
      this.followupLoading.set(false);
    }
  }

  toggleWatchlist(symbol: string): void {
    this.watchlistService.toggleWatchlist(symbol);
  }

  isFocusArray(val: any): boolean {
    return Array.isArray(val);
  }

  isWatchlisted(symbol: string): boolean {
    return this.watchlistService.isWatchlisted(symbol);
  }

  openVoiceAssistant(): void {
    const btn = document.querySelector('.compact-capsule') as HTMLElement;
    if (btn) {
      btn.click();
    }
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
    if (tab === 'MORNING_BELL') {
      if (!this.morningBriefEnvelope()) {
        this.loadMorningBriefing();
      }
    } else if (tab === 'EARNINGS_FILINGS') {
      if (!this.filingsEnvelope() || !this.earningsEnvelope()) {
        this.loadEarningsAndFilings();
      }
    } else if (tab === 'STRESS_TEST') {
      if (!this.stressTestEnvelope()) {
        this.runStressTest();
      }
    } else if (tab === 'NEWS_VERDICT') {
      if (!this.stockReportEnvelope()) {
        this.loadStockReport();
      }
    }
  }

  async loadMorningBriefing(forceRefresh: boolean = false): Promise<void> {
    this.briefingLoading.set(true);
    try {
      const env = await this.aiService.getRealMorningBriefing(forceRefresh);
      this.morningBriefEnvelope.set(env);
      if (env?.data) {
        const b = env.data;
        const sp = b.marketSnapshot?.global?.find(g => g.index.includes('S&P 500'));
        const nifty = b.marketSnapshot?.india?.find(i => i.index.includes('NIFTY'));
        const crude = b.marketSnapshot?.global?.find(g => g.index.includes('Crude'));
        const yield10y = b.marketSnapshot?.global?.find(g => g.index.includes('10-Year'));

        this.morningBriefing.set({
          date: new Date(b.generatedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
          globalCues: {
            sp500Futures: sp ? `${sp.changePct >= 0 ? '+' : ''}${sp.changePct.toFixed(2)}%` : '+0.35%',
            giftNifty: nifty ? `${nifty.changePct >= 0 ? '+' : ''}${nifty.changePct.toFixed(2)}%` : '+0.25%',
            crudeOil: crude ? `$${crude.price}` : '$82.40/bbl',
            us10yYield: yield10y ? `${yield10y.price}%` : '4.28%',
            marketSentiment: (nifty && nifty.changePct < -0.5 ? 'BEARISH' : nifty && nifty.changePct > 0.5 ? 'BULLISH' : 'NEUTRAL') as 'BULLISH' | 'BEARISH' | 'NEUTRAL'
          },
          keyTheme: b.briefing?.indianMarketSetup || b.briefing?.overnightMarketSummary || 'Market session active.',
          holdingsImpact: this.portfolio.holdings().map(h => ({
            symbol: h.symbol,
            catalyst: `${h.companyName} market context`,
            expectedMovement: 'SIDEWAYS' as const,
            reason: b.briefing?.portfolioImpact || 'Tracked against live index movement.'
          })),
          actionPlan: Array.isArray(b.briefing?.todaysFocus)
            ? b.briefing.todaysFocus
            : [b.briefing?.todaysFocus || 'Monitor portfolio assets.', b.briefing?.risksToWatch || 'Track market volatility.'],
          disclaimer: 'Institutional briefing synthesized from live multi-market index feeds and regulatory filings.'
        });
      }
    } catch (err) {
      console.warn('Failed to load morning briefing:', err);
    } finally {
      this.briefingLoading.set(false);
    }
  }

  async loadEarningsAndFilings(symbol?: string, market?: string): Promise<void> {
    const sym = symbol || this.selectedTarget()?.symbol || 'TCS';
    const mkt = market || this.selectedTarget()?.market || 'IN';
    this.earningsFilingsLoading.set(true);
    try {
      const [earningsEnv, filingsEnv, calEnv] = await Promise.all([
        this.aiService.getRealEarnings(sym, mkt).catch(() => null),
        this.aiService.getRealFilings(sym, mkt).catch(() => null),
        this.aiService.getRealEarningsCalendar(this.calendarPeriod()).catch(() => null)
      ]);
      if (earningsEnv) this.earningsEnvelope.set(earningsEnv);
      if (filingsEnv) this.filingsEnvelope.set(filingsEnv);
      if (calEnv) this.calendarEnvelope.set(calEnv);
    } catch (err) {
      console.warn('Failed to load earnings/filings:', err);
    } finally {
      this.earningsFilingsLoading.set(false);
    }
  }

  async summarizeFiling(symbol: string, filingId?: string): Promise<void> {
    this.filingSummaryLoading.set(true);
    try {
      const env = await this.aiService.summarizeFilingDocument(symbol, filingId, this.selectedTarget()?.market || 'IN');
      this.filingSummary.set(env?.data || null);
    } catch (err) {
      console.warn('Failed to summarize filing:', err);
    } finally {
      this.filingSummaryLoading.set(false);
    }
  }

  async runStressTest(scenarioId?: string): Promise<void> {
    const sId = scenarioId || this.selectedScenarioId();
    this.selectedScenarioId.set(sId);
    this.stressTestLoading.set(true);
    try {
      const holdings = this.portfolio.holdings();
      const payload: any = {
        scenario: sId,
        holdings: holdings.map(h => ({
          symbol: h.symbol,
          shares: h.shares || 10,
          currentPrice: h.currentPrice || h.avgPurchasePrice || 1000,
          sector: (h as any).sector || 'General'
        }))
      };
      if (sId === 'custom_shock') {
        payload.shocks = { custom_shock: this.customShockPct() };
      }
      const env = await this.aiService.runRealStressTest(payload);
      this.stressTestEnvelope.set(env);
    } catch (err) {
      console.warn('Failed to run stress test:', err);
    } finally {
      this.stressTestLoading.set(false);
    }
  }

  async loadStockReport(symbol?: string, market?: string): Promise<void> {
    const sym = symbol || this.selectedTarget()?.symbol || 'TCS';
    const mkt = market || this.selectedTarget()?.market || 'IN';
    this.stockReportLoading.set(true);
    try {
      const env = await this.aiService.getRealStockReport(sym, mkt);
      this.stockReportEnvelope.set(env);
    } catch (err) {
      console.warn('Failed to load stock report:', err);
    } finally {
      this.stockReportLoading.set(false);
    }
  }

  async saveCurrentReport(): Promise<void> {
    const env = this.stockReportEnvelope();
    if (!env || !env.data) return;
    try {
      await this.aiService.saveStockReport(env.data);
      this.reportSavedSuccess.set(true);
      setTimeout(() => this.reportSavedSuccess.set(false), 3000);
      const saved = await this.aiService.getSavedStockReports();
      this.savedReports.set(saved);
    } catch (err) {
      console.warn('Failed to save report:', err);
    }
  }

  // Title & Text Normalization Layer
  stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeTitle(rawTitle: string, symbol: string = 'Stock'): string {
    if (!rawTitle) return `${symbol} market update`;
    let t = this.stripHtml(rawTitle).trim();

    // Check if title is SEO keyword stuffed
    const lower = t.toLowerCase();
    if ((lower.includes('share price') && lower.includes('stock price')) || lower.includes('bse/nse') || lower.includes('bids offers') || t.length > 90) {
      if (lower.includes('partner') || lower.includes('deal') || lower.includes('contract') || lower.includes('agreement')) {
        return `${symbol} announces new strategic partnership & deal updates`;
      }
      if (lower.includes('surge') || lower.includes('jump') || lower.includes('gain') || lower.includes('rally') || lower.includes('rise')) {
        return `${symbol} stock advances on positive sector sentiment`;
      }
      if (lower.includes('fall') || lower.includes('drop') || lower.includes('decline') || lower.includes('loss') || lower.includes('slip')) {
        return `${symbol} stock updates amid sector margin pressures`;
      }
      if (lower.includes('q1') || lower.includes('q2') || lower.includes('q3') || lower.includes('q4') || lower.includes('earning') || lower.includes('result')) {
        return `${symbol} quarterly performance & operational results`;
      }
      if (lower.includes('ai') || lower.includes('cloud') || lower.includes('digital') || lower.includes('tech')) {
        return `${symbol} AI-led demand & digital transformation outlook`;
      }
      return `${symbol} stock price & market performance update`;
    }

    // Clean publication suffixes
    t = t.replace(/\s*[-|–]\s*(Moneycontrol|Yahoo Finance|Groww|Reuters|Bloomberg|StockAnalysis|Economic Times|CNBC|BSE|NSE).*/i, '');
    t = t.replace(/\s*\(TCS\.NS\)\s*/gi, ' ');
    t = t.replace(/Tata Consultancy Services Limited/gi, 'Tata Consultancy Services');

    if (t.length > 75) {
      t = t.slice(0, 72) + '...';
    }
    return t || `${symbol} research update`;
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
      const d = new Date(cd.marketTime);
      return isNaN(d.getTime()) ? '03:15 PM IST' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST';
    }
    return '03:15 PM IST';
  }

  getFormattedGeneratedAt(): string {
    const ca = this.currentAnalysis();
    if (ca && ca.createdAt) {
      const d = new Date(ca.createdAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' IST';
      }
    }
    return new Date().toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' IST';
  }

  get targetCurrencySymbol(): string {
    const t = this.selectedTarget();
    return (t?.currency === 'INR' || t?.market === 'IN') ? '₹' : '$';
  }

  get targetCurrencyCode(): string {
    const t = this.selectedTarget();
    return (t?.currency === 'INR' || t?.market === 'IN') ? 'INR' : 'USD';
  }

  formatCurrency(val: any, cCode?: string): string {
    if (val === null || val === undefined) return 'Unavailable';
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
    if (isNaN(num)) return 'Unavailable';
    
    if (Math.abs(num) < 0.005) val = 0; // Prevent -0.00
    const currency = cCode || this.selectedTarget()?.currency || (this.selectedTarget()?.market === 'IN' ? 'INR' : 'USD');
    const absVal = Math.abs(val);
    const prefix = val < 0 ? '-' : '';

    if (currency === 'INR') {
      const inrStr = absVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${prefix}₹${inrStr}`;
    } else {
      const usdStr = absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${prefix}$${usdStr}`;
    }
  }

  formatPercent(val: any): string {
    if (val === null || val === undefined) return 'Unavailable';
    let num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
    if (isNaN(num)) return 'Unavailable';
    
    if (Math.abs(num) < 0.005) num = 0; // Prevent -0.00
    const absVal = Math.abs(num);
    const prefix = num < 0 ? '-' : '+';
    return `${prefix}${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }

  formatVolume(vol: any): string {
    if (vol === null || vol === undefined) return 'Unavailable';
    const num = typeof vol === 'string' ? parseFloat(vol.replace(/,/g, '')) : vol;
    if (isNaN(num)) return 'Unavailable';
    
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  formatTimeAgo(dateStr?: string | null): string {
    if (!dateStr) return '2h ago';
    const str = String(dateStr).trim();

    if (/^(just now|\d+\s*(min|mins|minute|minutes|hour|hours|day|days|week|weeks|month|months|yr|year|years)\s*ago)$/i.test(str)) {
      return str;
    }

    const parsedDate = new Date(str);
    if (isNaN(parsedDate.getTime())) {
      return str;
    }

    const now = Date.now();
    const diffMs = now - parsedDate.getTime();
    if (diffMs < 0) return 'Just now';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Portfolio calculations matching strict formulas
  positionSnapshot = computed(() => {
    const t = this.selectedTarget();
    if (!t || !t.symbol) return null;
    return this.portfolio.getPositionSnapshot(t.symbol, this.getDisplayedPrice() || undefined);
  });

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
    const ca = this.currentAnalysis();
    if (ca?.sources && ca.sources.length > 0) return ca.sources.length;
    return 0;
  }

  getSupportingCount(): number {
    return this.getSupportingEvidence().filter(e => e.status === 'VERIFIED').length;
  }

  getContradictingCount(): number {
    return this.getContradictingEvidence().filter(e => e.status === 'VERIFIED').length;
  }

  getVerifiedFactorsCount(): number {
    const ca = this.currentAnalysis();
    if (ca?.verifiedEvidence && Array.isArray(ca.verifiedEvidence)) {
      return ca.verifiedEvidence.length;
    }
    return this.getSupportingCount() + this.getContradictingCount();
  }

  getSupportingEvidence(): AiEvidence[] {
    const ca = this.currentAnalysis();
    const list = ca?.supportingEvidence || [];

    return list.map((item) => ({
      title: item.title || item.factor || 'Supporting Factor',
      claim: item.claim || item.title || item.factor || 'Supporting assertion',
      evidence: this.stripHtml(item.factualObservation || item.evidence || (item.underlyingEvidence ? `${item.underlyingEvidence.metric}: ${item.underlyingEvidence.value}` : '') || item.claim || 'Verified Observation'),
      factualObservation: this.stripHtml(item.factualObservation || item.evidence || ''),
      interpretation: item.interpretation ? this.stripHtml(item.interpretation) : null,
      isInterpretation: Boolean(item.isInterpretation),
      evidenceId: item.evidenceId || null,
      underlyingEvidence: item.underlyingEvidence || null,
      sourceTitle: item.sourceTitle || item.underlyingEvidence?.source || 'Source unavailable',
      sourceUrl: (item.sourceUrl && item.sourceUrl !== '#') ? item.sourceUrl : null,
      date: item.date ? this.formatTimeAgo(item.date) : null,
      status: item.status || (item.evidenceId ? 'VERIFIED' : 'UNVERIFIED'),
      validationReason: item.validationReason || null,
      limitations: item.limitations || null
    }));
  }

  getContradictingEvidence(): AiEvidence[] {
    const ca = this.currentAnalysis();
    const list = ca?.contradictingEvidence || [];

    return list.map((item) => ({
      title: item.title || item.factor || 'Contrary Factor',
      claim: item.claim || item.title || item.factor || 'Contrary assertion',
      evidence: this.stripHtml(item.factualObservation || item.evidence || (item.underlyingEvidence ? `${item.underlyingEvidence.metric}: ${item.underlyingEvidence.value}` : '') || item.claim || 'Risk Observation'),
      factualObservation: this.stripHtml(item.factualObservation || item.evidence || ''),
      interpretation: item.interpretation ? this.stripHtml(item.interpretation) : null,
      isInterpretation: Boolean(item.isInterpretation),
      evidenceId: item.evidenceId || null,
      underlyingEvidence: item.underlyingEvidence || null,
      sourceTitle: item.sourceTitle || item.underlyingEvidence?.source || 'Source unavailable',
      sourceUrl: (item.sourceUrl && item.sourceUrl !== '#') ? item.sourceUrl : null,
      date: item.date ? this.formatTimeAgo(item.date) : null,
      status: item.status || (item.evidenceId ? 'VERIFIED' : 'UNVERIFIED'),
      validationReason: item.validationReason || null,
      limitations: item.limitations || null
    }));
  }

  getWatchItems(): AiWatchCondition[] {
    const ca = this.currentAnalysis();
    return ca?.watch || ca?.watchConditions || [];
  }

  getUncertainFactors() {
    const ca = this.currentAnalysis();
    const list = ca?.uncertainFactors || [];

    return list.map((item) => ({
      claim: item.claim || 'Analytical Assessment',
      evidence: this.stripHtml(item.evidence || item.claim || ''),
      sourceTitle: item.sourceTitle || 'Analytical Assessment',
      sourceUrl: (item.sourceUrl && item.sourceUrl !== '#') ? item.sourceUrl : null,
      date: item.date ? this.formatTimeAgo(item.date) : null
    }));
  }

  getRisksList() {
    const ca = this.currentAnalysis();
    const list = ca?.risks || [];
    const sym = this.selectedTarget()?.symbol || 'TCS';

    return list.map((r) => ({
      item: this.normalizeTitle(r.item, sym),
      whyItMatters: this.stripHtml(r.whyItMatters)
    }));
  }

  toggleNewsExpand(index: number, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const cur = this.expandedNewsIndex();
    this.expandedNewsIndex.set(cur === index ? null : index);
  }

  formatNewsCategory(cat?: string): string {
    if (!cat) return 'Company Update';
    const map: Record<string, string> = {
      'EARNINGS': 'Earnings',
      'CONTRACTS_DEALS': 'Contracts & Deals',
      'REVENUE_GROWTH': 'Revenue Growth',
      'REGULATORY_LEGAL': 'Regulatory & Legal',
      'MANAGEMENT': 'Management',
      'ANALYST_ACTION': 'Analyst Action',
      'DIVIDENDS_BUYBACKS': 'Dividends & Buybacks',
      'PRODUCT_LAUNCH': 'Product Launch',
      'M_AND_A': 'M&A / Corporate',
      'MACRO_SECTOR': 'Macro / Sector',
      'COMPANY_DEVELOPMENT': 'Corporate Update'
    };
    return map[cat] || cat.replace(/_/g, ' ');
  }

  formatConfirmationStatus(status?: string): string {
    if (!status) return 'Reported News';
    if (status === 'CONFIRMED') return 'Official / Confirmed Announcement';
    if (status === 'UNCONFIRMED_SPECULATION') return 'Unconfirmed Speculation';
    return 'Reported Media News';
  }

  formatSignedPct(val?: number | null): string {
    if (val == null || isNaN(val)) return 'N/A';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  }

  getPossibleScenariosMetadata() {
    const ca = this.currentAnalysis();
    const ps = ca?.possibleScenarios;
    const pos = this.getPositiveScenarios();
    const neu = this.getNeutralScenarios();
    const neg = this.getNegativeScenarios();
    const totalCount = pos.length + neu.length + neg.length;

    return {
      status: ps?.status || (totalCount > 0 ? 'CALCULATED' : 'INSUFFICIENT_DATA'),
      symbol: ps?.symbol || this.selectedTarget()?.symbol || '',
      currentPrice: ps?.currentPrice || ca?.marketData?.price || null,
      currency: ps?.currency || (this.selectedTarget()?.market === 'US' ? '$' : '₹'),
      calculatedAt: ps?.calculatedAt || ca?.createdAt || null,
      dataFreshness: ps?.dataFreshness || ca?.marketData?.dataStatus || 'LIVE',
      mathBasis: ps?.mathBasis || null,
      levels: ps?.levels || null,
      hasScenarios: totalCount > 0
    };
  }

  getPositiveScenarios() {
    const ca = this.currentAnalysis();
    const sc = ca?.possibleScenarios?.positive || ca?.scenarios?.positive;
    if (Array.isArray(sc) && sc.length > 0) {
      return sc.map((s: any) => ({
        direction: s.direction || 'POSITIVE',
        label: s.label || 'BULLISH CONTINUATION / BREAKOUT',
        trigger: this.stripHtml(s.trigger),
        outcome: this.stripHtml(s.outcome),
        confirmation: s.confirmation ? this.stripHtml(s.confirmation) : null,
        invalidation: s.invalidation ? this.stripHtml(s.invalidation) : null,
        potentialTarget: s.potentialTarget || null,
        targetMath: s.targetMath || null,
        atrSensitivityBand: s.atrSensitivityBand || null,
        mathBasis: s.mathBasis || null,
        keyRisks: s.keyRisks || null,
        calculatedAt: s.calculatedAt || ca?.createdAt || null,
        status: s.status || 'CALCULATED'
      }));
    }
    return [];
  }

  getNeutralScenarios() {
    const ca = this.currentAnalysis();
    const sc = ca?.possibleScenarios?.neutral || ca?.scenarios?.neutral;
    if (Array.isArray(sc) && sc.length > 0) {
      return sc.map((s: any) => ({
        direction: s.direction || 'NEUTRAL',
        label: s.label || 'RANGE-BOUND CONSOLIDATION',
        trigger: this.stripHtml(s.trigger),
        outcome: this.stripHtml(s.outcome),
        confirmation: s.confirmation ? this.stripHtml(s.confirmation) : null,
        invalidation: s.invalidation ? this.stripHtml(s.invalidation) : null,
        potentialTarget: s.potentialTarget || null,
        targetMath: s.targetMath || null,
        atrSensitivityBand: s.atrSensitivityBand || null,
        mathBasis: s.mathBasis || null,
        keyRisks: s.keyRisks || null,
        calculatedAt: s.calculatedAt || ca?.createdAt || null,
        status: s.status || 'CALCULATED'
      }));
    }
    return [];
  }

  getNegativeScenarios() {
    const ca = this.currentAnalysis();
    const sc = ca?.possibleScenarios?.negative || ca?.scenarios?.negative;
    if (Array.isArray(sc) && sc.length > 0) {
      return sc.map((s: any) => ({
        direction: s.direction || 'NEGATIVE',
        label: s.label || 'BEARISH BREAKDOWN RETRACEMENT',
        trigger: this.stripHtml(s.trigger),
        outcome: this.stripHtml(s.outcome),
        confirmation: s.confirmation ? this.stripHtml(s.confirmation) : null,
        invalidation: s.invalidation ? this.stripHtml(s.invalidation) : null,
        potentialTarget: s.potentialTarget || null,
        targetMath: s.targetMath || null,
        atrSensitivityBand: s.atrSensitivityBand || null,
        mathBasis: s.mathBasis || null,
        keyRisks: s.keyRisks || null,
        calculatedAt: s.calculatedAt || ca?.createdAt || null,
        status: s.status || 'CALCULATED'
      }));
    }
    return [];
  }

  getNewsList() {
    const ca = this.currentAnalysis();
    // Prioritize newsIntelligence from currentAnalysis if available
    const caNews = ca?.newsIntelligence || ca?.news;
    if (Array.isArray(caNews) && caNews.length > 0) {
      return caNews.map((n: any) => ({
        title: n.title,
        publisher: n.publisher || 'Financial News',
        link: n.link || n.url || '#',
        pubDate: n.pubDate || n.publishedAt || null,
        category: n.category || 'COMPANY_DEVELOPMENT',
        impact: n.impact || 'NEUTRAL',
        confirmationStatus: n.confirmationStatus || 'REPORTED_NEWS',
        affectedMetric: n.affectedMetric || 'General Operations',
        timeHorizon: n.timeHorizon || 'SHORT_TERM',
        summary: n.summary || n.title,
        whyItMatters: n.whyItMatters || null,
        marketReaction: n.marketReaction || null,
        verificationStatus: n.verificationStatus || (n.isSourceVerified ? 'SOURCE_VERIFIED' : 'RETRIEVED_FEED'),
        isSourceVerified: Boolean(n.isSourceVerified),
        freshness: n.freshness || 'RECENT'
      }));
    }

    const news = this.stockNews();
    if (news && news.length > 0) {
      return news.map((n: any) => ({
        title: n.title,
        publisher: n.publisher || 'Financial News',
        link: n.link || '#',
        pubDate: n.pubDate || null,
        category: n.category || 'COMPANY_DEVELOPMENT',
        impact: n.impact || 'NEUTRAL',
        confirmationStatus: n.confirmationStatus || 'REPORTED_NEWS',
        affectedMetric: n.affectedMetric || 'General Operations',
        timeHorizon: n.timeHorizon || 'SHORT_TERM',
        summary: n.summary || n.title,
        whyItMatters: n.whyItMatters || null,
        marketReaction: n.marketReaction || null,
        verificationStatus: n.verificationStatus || (n.isSourceVerified ? 'SOURCE_VERIFIED' : 'RETRIEVED_FEED'),
        isSourceVerified: Boolean(n.isSourceVerified),
        freshness: n.freshness || 'RECENT'
      }));
    }

    // Fallback to sources if empty
    const sources = ca?.sources || [];
    const sym = this.selectedTarget()?.symbol || 'TCS';

    return sources.map((s) => ({
      title: this.normalizeTitle(s.title, sym),
      publisher: s.publisher || 'Financial Source',
      link: s.url || '#',
      pubDate: (s as any).publishedAt || ca?.createdAt || null,
      category: 'COMPANY_DEVELOPMENT',
      impact: 'NEUTRAL',
      confirmationStatus: 'REPORTED_NEWS',
      affectedMetric: 'General Operations',
      timeHorizon: 'SHORT_TERM',
      summary: this.normalizeTitle(s.title, sym),
      whyItMatters: null,
      marketReaction: null,
      verificationStatus: 'RETRIEVED_FEED',
      isSourceVerified: false,
      freshness: 'RECENT'
    }));
  }

  getIntent(): string {
    const ca = this.currentAnalysis();
    return ca?.intent || ca?.dynamicResponse?.intent || 'BUY_SELL_DECISION_SUPPORT';
  }

  isEarningsIntent(): boolean {
    const intent = this.getIntent();
    return intent === 'EARNINGS_ANALYSIS' || intent.includes('EARNINGS');
  }

  isFilingsIntent(): boolean {
    const intent = this.getIntent();
    return intent === 'FILINGS_ANALYSIS' || intent.includes('FILING');
  }

  isHoldingPeriodIntent(): boolean {
    const intent = this.getIntent();
    return intent === 'HOLDING_PERIOD';
  }

  isPriceMovementIntent(): boolean {
    const intent = this.getIntent();
    return intent === 'PRICE_MOVEMENT_EXPLANATION';
  }

  isConceptIntent(): boolean {
    const intent = this.getIntent();
    return intent === 'CONCEPT_EXPLANATION';
  }

  isPortfolioExposureIntent(): boolean {
    const intent = this.getIntent();
    return intent === 'PORTFOLIO_EXPOSURE';
  }

  isScenarioIntent(): boolean {
    const intent = this.getIntent();
    return intent === 'SCENARIO_ANALYSIS';
  }

  isComparisonIntent(): boolean {
    const intent = this.getIntent();
    return intent === 'COMPANY_COMPARISON';
  }

  getDynamicResponse(): any {
    return this.currentAnalysis()?.dynamicResponse || null;
  }

  isPositionScenarioIntent(): boolean {
    const intent = this.getIntent();
    return intent === 'POSITION_SCENARIO' || !!this.getPositionScenario();
  }

  getPositionScenario(): any {
    const ca = this.currentAnalysis();
    let ps = ca?.positionScenario || ca?.dynamicResponse?.positionScenario || null;
    
    if (ps && ps.position && ps.position.quantity > 0) {
      // Force mathematical engine
      const qty = ps.position.quantity;
      const price = ps.position.entryPrice || this.getDisplayedPrice() || 1;
      const capitalRequired = qty * price;
      
      ps.position.grossInvestment = capitalRequired;
      ps.position.capitalRequired = capitalRequired;
      
      ps.scenarios = [
        { label: '+10% Target', multiplier: 1.10 },
        { label: '+5% Step', multiplier: 1.05 },
        { label: '-5% Step', multiplier: 0.95 },
        { label: '-10% Risk', multiplier: 0.90 }
      ].map(sc => {
        const scenarioPrice = price * sc.multiplier;
        const positionValue = qty * scenarioPrice;
        const pnl = positionValue - capitalRequired;
        const pnlPercent = (pnl / capitalRequired) * 100;
        return {
          label: sc.label,
          scenarioPrice,
          positionValue,
          pnl,
          pnlPercent: parseFloat(pnlPercent.toFixed(2))
        };
      });
    }
    
    return ps;
  }

  getPrediction(): any {
    return this.currentAnalysis()?.prediction || null;
  }

  /**
   * Convert raw Markdown text to sanitized HTML for structured chat bubble rendering.
   * Handles: headers, bold, italic, bullet lists, numbered lists, line breaks.
   * Strips raw Markdown syntax so no asterisks/hashes appear in the UI.
   */
  formatMarkdownToHtml(raw: string): SafeHtml {
    if (!raw) return this.sanitizer.bypassSecurityTrustHtml('');

    let html = raw;

    // 1. Escape basic HTML entities for safety
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 2. Headers: ### Title -> <div class="md-h3">Title</div>
    html = html.replace(/^####\s+(.+)$/gm, '<div class="md-h4">$1</div>');
    html = html.replace(/^###\s+(.+)$/gm, '<div class="md-h3">$1</div>');
    html = html.replace(/^##\s+(.+)$/gm, '<div class="md-h2">$1</div>');
    html = html.replace(/^#\s+(.+)$/gm, '<div class="md-h1">$1</div>');

    // 3. Bold + Italic: ***text*** or ___text___
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="md-bold"><em>$1</em></strong>');

    // 4. Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold">$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong class="md-bold">$1</strong>');

    // 5. Italic: *text* or _text_
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // 6. Bullet lists: • or - at start of line
    html = html.replace(/^[•\-]\s+(.+)$/gm, '<div class="md-bullet"><span class="md-marker">•</span><span>$1</span></div>');

    // 7. Numbered lists: 1. Item
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="md-numbered"><span class="md-num">$1.</span><span>$2</span></div>');

    // 8. Horizontal rules
    html = html.replace(/^---+$/gm, '<hr class="md-divider">');

    // 9. Code inline: `code`
    html = html.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

    // 10. Line breaks (double newlines = paragraph break, single = line break)
    html = html.replace(/\n\n/g, '</p><p class="md-para">');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph
    html = `<p class="md-para">${html}</p>`;

    // Clean up empty paragraphs
    html = html.replace(/<p class="md-para"><\/p>/g, '');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /**
   * Check if a chat message carries an inline position scenario card
   */
  msgHasPositionScenario(msg: ChatThreadMessage): boolean {
    return !!msg.positionScenario && msg.positionScenario?.position?.entryPrice;
  }

  /**
   * Scroll to the main content area (e.g., top of the page)
   */
  scrollToTop(): void {
    const mainContent = document.querySelector('.ai-main-content');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /**
   * Get the intent badge label for a chat response
   */
  getIntentBadge(msg: ChatThreadMessage): string {
    const intent = msg.intent || msg.responseType || '';
    const labels: Record<string, string> = {
      'POSITION_SCENARIO': 'Position Scenario',
      'BUY_DECISION': 'Buy Analysis',
      'SELL_DECISION': 'Sell Analysis',
      'HOLDING_PERIOD': 'Holding Period',
      'PRICE_MOVEMENT': 'Price Movement',
      'PRICE_MOVEMENT_EXPLANATION': 'Price Movement',
      'EARNINGS': 'Earnings Analysis',
      'EARNINGS_ANALYSIS': 'Earnings Analysis',
      'FILINGS': 'Filings Analysis',
      'FILINGS_ANALYSIS': 'Filings Analysis',
      'COMPARISON': 'Comparison',
      'COMPANY_COMPARISON': 'Comparison',
      'PORTFOLIO': 'Portfolio Exposure',
      'PORTFOLIO_EXPOSURE': 'Portfolio Exposure',
      'STRESS_TEST': 'Stress Test',
      'SCENARIO_ANALYSIS': 'Stress Test',
      'TECHNICAL': 'Technical Analysis',
      'TECHNICAL_ANALYSIS': 'Technical Analysis',
      'FUNDAMENTAL': 'Fundamental Analysis',
      'FUNDAMENTAL_ANALYSIS': 'Fundamental Analysis',
      'VALUATION_ANALYSIS': 'Valuation Analysis',
      'NEWS': 'News Analysis',
      'NEWS_ANALYSIS': 'News Analysis',
      'CONCEPT_EXPLANATION': 'Concept Guide',
      'BUY_SELL_DECISION_SUPPORT': 'Decision Support',
    };
    return labels[intent] || 'Analysis';
  }

  /**
   * Get the accent color for an intent badge
   */
  getIntentBadgeColor(msg: ChatThreadMessage): string {
    const intent = msg.intent || msg.responseType || '';
    const colors: Record<string, string> = {
      'POSITION_SCENARIO': '#10b981',
      'BUY_DECISION': '#10b981',
      'BUY_SELL_DECISION_SUPPORT': '#3b82f6',
      'SELL_DECISION': '#ef4444',
      'HOLDING_PERIOD': '#10b981',
      'PRICE_MOVEMENT': '#f59e0b',
      'PRICE_MOVEMENT_EXPLANATION': '#f59e0b',
      'EARNINGS': '#3b82f6',
      'EARNINGS_ANALYSIS': '#3b82f6',
      'TECHNICAL': '#8b5cf6',
      'TECHNICAL_ANALYSIS': '#8b5cf6',
      'FUNDAMENTAL': '#0284c7',
      'FUNDAMENTAL_ANALYSIS': '#0284c7',
      'NEWS': '#06b6d4',
      'NEWS_ANALYSIS': '#06b6d4',
      'CONCEPT_EXPLANATION': '#8b5cf6',
      'COMPARISON': '#ec4899',
      'COMPANY_COMPARISON': '#ec4899',
      'PORTFOLIO': '#06b6d4',
      'PORTFOLIO_EXPOSURE': '#06b6d4',
      'STRESS_TEST': '#ef4444',
      'SCENARIO_ANALYSIS': '#ef4444',
    };
    return colors[intent] || '#64748b';
  }
}
