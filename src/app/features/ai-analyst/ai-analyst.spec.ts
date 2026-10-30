import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiAnalystPage, POPULAR_RESEARCH_STOCKS } from './ai-analyst';
import { AiAnalystService, AiAnalysis } from '../../core/services/ai-analyst.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { WatchlistService } from '../../core/services/watchlist.service';

describe('AiAnalystPage — Evidence Integrity & UI Rendering (Cases O, P, J)', () => {
  let component: AiAnalystPage;
  let aiServiceMock: any;
  let portfolioMock: any;
  let watchlistMock: any;

  const mockAnalysisTcs: AiAnalysis = {
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services',
    question: 'Analyze TCS',
    assessment: {
      type: 'POSITIVE',
      evidenceStrength: 'STRONG',
      summary: 'Verified multi-factor bullish thesis.'
    },
    quickTake: {
      whatHappened: 'TCS is trading at ₹3,450.25 (+1.04% today).',
      why: 'Oversold RSI momentum bounce near tactical support.',
      portfolioImpact: 'Active holding tracking movements.',
      bottomLine: 'Thesis supported by verified indicators.'
    },
    supportingEvidence: [
      {
        title: 'Oversold RSI Momentum',
        claim: 'Oversold RSI Momentum',
        evidence: '14-day RSI is 28.5 (oversold territory)',
        factualObservation: '14-day RSI is 28.5 (oversold territory)',
        interpretation: 'Signals tactical mean-reversion bounce potential',
        isInterpretation: true,
        evidenceId: 'EVIDENCE-001',
        sourceTitle: 'Daily OHLCV Chart Calculation',
        sourceUrl: null,
        date: '2026-10-22T05:00:00Z',
        status: 'VERIFIED'
      }
    ],
    contradictingEvidence: [
      {
        title: 'Overhead Resistance Barrier',
        claim: 'Overhead Resistance Barrier',
        evidence: 'Price approaches 60-day resistance at ₹3,600',
        factualObservation: 'Price approaches 60-day resistance at ₹3,600',
        interpretation: 'Tactical profit taking expected near resistance',
        isInterpretation: true,
        evidenceId: 'EVIDENCE-002',
        sourceTitle: '60-Day Swing Pivot Cluster',
        sourceUrl: null,
        date: '2026-10-22T05:00:00Z',
        status: 'VERIFIED'
      }
    ],
    watch: [
      {
        id: 'WATCH-001',
        symbol: 'TCS',
        title: 'Tactical Price Support Breach',
        metric: 'price',
        operator: 'below',
        threshold: 3350,
        unit: 'INR',
        timeframe: 'daily',
        reason: 'Daily close below support voids structure',
        evidenceIds: ['EVIDENCE-003'],
        source: 'Technical Pivot',
        lastEvaluatedAt: '2026-10-22T05:00:00Z',
        currentValue: 3450.25,
        status: 'ACTIVE_UNTRIGGERED',
        isTriggered: false,
        conditionText: 'Price drops below INR 3350'
      }
    ],
    watchConditions: [],
    verifiedEvidence: [
      { id: 'EVIDENCE-001', status: 'VERIFIED' },
      { id: 'EVIDENCE-002', status: 'VERIFIED' }
    ],
    sources: [],
    disclaimer: 'Verified evidence-based intelligence.',
    createdAt: new Date().toISOString()
  };

  beforeEach(async () => {
    aiServiceMock = {
      analyzeStock: vi.fn().mockResolvedValue(mockAnalysisTcs),
      fetchStockChart: vi.fn().mockResolvedValue({
        symbol: 'TCS',
        ticker: 'TCS.NS',
        currency: 'INR',
        currentPrice: 3450.25,
        previousClose: 3414.75,
        change: 35.5,
        changePercent: 1.04,
        points: [{ timestamp: '2026-10-22T00:00:00Z', price: 3450.25 }]
      }),
      fetchStockNews: vi.fn().mockResolvedValue([]),
      getRealStockReport: vi.fn().mockResolvedValue({ data: {} }),
      getRealEarnings: vi.fn().mockResolvedValue(null),
      getRealFilings: vi.fn().mockResolvedValue(null),
      getRealEarningsCalendar: vi.fn().mockResolvedValue(null),
      getEvidenceDetails: vi.fn().mockImplementation((evId: string, sym: string) => {
        if (evId === 'EVIDENCE-NONEXISTENT') {
          return Promise.resolve({
            success: false,
            status: 'UNAVAILABLE',
            message: 'Verification details unavailable. This claim has not been independently verified.'
          });
        }
        return Promise.resolve({
          success: true,
          data: {
            evidenceId: evId,
            symbol: sym,
            claim: `Verified claim for ${evId}`,
            status: 'VERIFIED',
            source: 'Calculated from Daily OHLCV Candles',
            calculationMethod: 'RSI(14) with Wilder Smoothing',
            calculatedResult: '56.1',
            validationMethod: 'Compare locally calculated value with independent calculation',
            validationResult: 'PASS',
            freshness: 'FRESH',
            rawInputs: { period: 14 },
            verificationTrail: [
              { step: 1, title: 'Original Analysis Context', detail: 'Analyze ' + sym },
              { step: 2, title: 'Instrument Binding', detail: sym },
              { step: 3, title: 'Data Provider Requested', detail: 'Market Gateway' },
              { step: 4, title: 'Actual API / Source Used', detail: 'OHLCV Feed' },
              { step: 5, title: 'Raw Response Fields Used', detail: 'close prices' },
              { step: 6, title: 'Data Normalization', detail: 'Observed within window' },
              { step: 7, title: 'Calculation Applied', detail: 'RSI(14)' },
              { step: 8, title: 'Independent Validation', detail: 'PASS' },
              { step: 9, title: 'Final Verification Decision', detail: 'VERIFIED' },
              { step: 10, title: 'Evidence Ledger Record Returned', detail: evId }
            ]
          }
        });
      })
    };

    portfolioMock = {
      holdings: signal([]),
      activeMarket: signal('IN'),
      getPositionSnapshot: vi.fn().mockReturnValue(null),
      getHoldingBySymbol: vi.fn().mockReturnValue(undefined)
    };

    watchlistMock = {
      symbols: signal(['TCS', 'NVDA']),
      isWatchlisted: vi.fn().mockReturnValue(true),
      toggleWatchlist: vi.fn()
    };

    const injector = Injector.create({
      providers: [
        { provide: AiAnalystService, useValue: aiServiceMock },
        { provide: PortfolioService, useValue: portfolioMock },
        { provide: WatchlistService, useValue: watchlistMock },
        { provide: DomSanitizer, useValue: { sanitize: (_c: any, v: any) => v } },
        { provide: ActivatedRoute, useValue: { queryParams: { subscribe: vi.fn() } } },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    });

    runInInjectionContext(injector, () => {
      component = new AiAnalystPage();
    });
  });

  it('should initialize and load stock analysis', () => {
    expect(component).toBeTruthy();
  });

  // Case P: Switching between securities does not leak evidence from previously selected security
  it('CASE P: Switching between securities does not leak evidence from previously selected security', async () => {
    // 1. Select TCS and load analysis
    const tcsTarget = POPULAR_RESEARCH_STOCKS.find(s => s.symbol === 'TCS')!;
    await component.selectTarget(tcsTarget);

    expect(component['selectedTarget']()?.symbol).toBe('TCS');
    expect(component['currentAnalysis']()?.symbol).toBe('TCS');
    expect(component.getSupportingEvidence().length).toBe(1);
    expect(component.getSupportingEvidence()[0].evidence).toContain('14-day RSI is 28.5');

    // 2. Mock a delayed or pending request for NVDA
    let resolveNvda: any;
    aiServiceMock.analyzeStock.mockReturnValue(new Promise(res => { resolveNvda = res; }));

    // 3. Select NVDA
    const nvdaTarget = POPULAR_RESEARCH_STOCKS.find(s => s.symbol === 'NVDA')!;
    component.selectTarget(nvdaTarget);

    // Immediately after selection, currentAnalysis MUST be null (clean reset)
    expect(component['selectedTarget']()?.symbol).toBe('NVDA');
    expect(component['currentAnalysis']()).toBeNull();
    // Supporting evidence must NOT leak previous TCS evidence!
    expect(component.getSupportingEvidence()).toEqual([]);
    expect(component.getContradictingEvidence()).toEqual([]);
    expect(component.getWatchItems()).toEqual([]);

    // 4. Resolve NVDA
    const mockAnalysisNvda: AiAnalysis = {
      symbol: 'NVDA',
      companyName: 'NVIDIA Corporation',
      question: 'Analyze NVDA',
      supportingEvidence: [{
        title: 'Data Center Revenue Beat',
        claim: 'Data Center Revenue Beat',
        evidence: 'Q2 revenue grew 122% YoY to $30.0B',
        factualObservation: 'Q2 revenue grew 122% YoY to $30.0B',
        status: 'VERIFIED',
        sourceTitle: 'SEC Form 10-Q',
        sourceUrl: 'https://sec.gov',
        date: '2026-10-22T05:00:00Z'
      }],
      contradictingEvidence: [],
      watch: [],
      sources: [],
      disclaimer: 'Verified intelligence.',
      createdAt: new Date().toISOString()
    };
    resolveNvda(mockAnalysisNvda);
    await new Promise(r => setTimeout(r, 0));

    expect(component['currentAnalysis']()?.symbol).toBe('NVDA');
    expect(component.getSupportingEvidence()[0].evidence).toContain('Q2 revenue grew 122% YoY');
  });

  // Case O: A frontend request failure does not leave misleading stale results on the screen
  it('CASE O: A frontend request failure does not leave misleading stale results on the screen', async () => {
    // 1. Initial successful analysis for TCS
    const tcsTarget = POPULAR_RESEARCH_STOCKS.find(s => s.symbol === 'TCS')!;
    await component.selectTarget(tcsTarget);
    expect(component['currentAnalysis']()?.symbol).toBe('TCS');

    // 2. Next request fails with HTTP 500 network error
    aiServiceMock.analyzeStock.mockRejectedValue(new Error('Backend network timeout 504'));

    const nvdaTarget = POPULAR_RESEARCH_STOCKS.find(s => s.symbol === 'NVDA')!;
    await component.selectTarget(nvdaTarget);

    // After failure, currentAnalysis MUST remain null (never showing TCS results under NVDA header)
    expect(component['selectedTarget']()?.symbol).toBe('NVDA');
    expect(component['currentAnalysis']()).toBeNull();
    expect(component.getSupportingEvidence()).toEqual([]);
    expect(component.getContradictingEvidence()).toEqual([]);
    expect(component.getWatchItems()).toEqual([]);
  });

  // Case J: Watch items represent real monitoring conditions
  it('CASE J (Frontend): Watch items render real monitoring rules with condition text and trigger status', async () => {
    const tcsTarget = POPULAR_RESEARCH_STOCKS.find(s => s.symbol === 'TCS')!;
    await component.selectTarget(tcsTarget);

    const watchItems = component.getWatchItems();
    expect(watchItems.length).toBe(1);
    expect(watchItems[0].title).toBe('Tactical Price Support Breach');
    expect(watchItems[0].conditionText).toBe('Price drops below INR 3350');
    expect(watchItems[0].status).toBe('ACTIVE_UNTRIGGERED');
    expect(watchItems[0].isTriggered).toBe(false);
  });

  // VERIFICATION TESTS: Clickable VERIFIED badges and audit trail
  it('should open verification modal and load factor evidence when badge is clicked', async () => {
    const tcsTarget = POPULAR_RESEARCH_STOCKS.find(s => s.symbol === 'TCS')!;
    await component.selectTarget(tcsTarget);

    const supItem = component.getSupportingEvidence()[0];
    const clickEvent = { stopPropagation: vi.fn(), preventDefault: vi.fn() } as any;

    await component.openEvidenceVerification(supItem, clickEvent);

    expect(clickEvent.stopPropagation).toHaveBeenCalled();
    expect(component['showVerificationModal']()).toBe(true);
    expect(component['verificationLoading']()).toBe(false);
    expect(component['selectedEvidence']()).toBeTruthy();
    expect(component['selectedEvidence']().evidenceId).toBe('EVIDENCE-001');
    expect(component['selectedEvidence']().status).toBe('VERIFIED');
    expect(component['selectedEvidence']().validationResult).toBe('PASS');
    expect(component['selectedEvidence']().verificationTrail.length).toBe(10);
    expect(aiServiceMock.getEvidenceDetails).toHaveBeenCalledWith('EVIDENCE-001', 'TCS');
  });

  it('should avoid duplicate network calls by caching loaded evidence records', async () => {
    const tcsTarget = POPULAR_RESEARCH_STOCKS.find(s => s.symbol === 'TCS')!;
    await component.selectTarget(tcsTarget);

    aiServiceMock.getEvidenceDetails.mockClear();

    // First click: fetches from service
    await component.openEvidenceVerification('EVIDENCE-005');
    expect(aiServiceMock.getEvidenceDetails).toHaveBeenCalledTimes(1);

    // Second click on same evidence: serves from cache
    await component.openEvidenceVerification('EVIDENCE-005');
    expect(aiServiceMock.getEvidenceDetails).toHaveBeenCalledTimes(1);
    expect(component['selectedEvidence']()?.evidenceId).toBe('EVIDENCE-005');
  });

  it('should display honest unavailable message when evidence ID does not exist', async () => {
    const tcsTarget = POPULAR_RESEARCH_STOCKS.find(s => s.symbol === 'TCS')!;
    await component.selectTarget(tcsTarget);

    await component.openEvidenceVerification('EVIDENCE-NONEXISTENT');

    expect(component['showVerificationModal']()).toBe(true);
    expect(component['selectedEvidence']()?.status).toBe('UNAVAILABLE');
    expect(component['selectedEvidence']()?.explanation).toBe(
      'Verification details unavailable. This claim has not been independently verified.'
    );
  });

  it('should close verification modal when closeVerificationModal is called', () => {
    component['showVerificationModal'].set(true);
    component.closeVerificationModal();
    expect(component['showVerificationModal']()).toBe(false);
    expect(component['selectedEvidence']()).toBeNull();
  });

  it('should close verification modal on Escape key press', () => {
    component['showVerificationModal'].set(true);
    component.handleEscapeKey();
    expect(component['showVerificationModal']()).toBe(false);
  });
});
