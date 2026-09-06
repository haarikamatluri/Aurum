import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  AiAnalystService,
  AiAnalysis,
  AiChatMessage,
  AiVerdict,
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
  { id: 'pop-reliance', symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd', exchange: 'NSE', market: 'IN', currency: 'INR', currentPrice: null, isOwned: false },
  { id: 'pop-tatamotors', symbol: 'TATAMOTORS', companyName: 'Tata Motors Ltd', exchange: 'NSE', market: 'IN', currency: 'INR', currentPrice: null, isOwned: false },
  { id: 'pop-tcs', symbol: 'TCS', companyName: 'Tata Consultancy Services', exchange: 'NSE', market: 'IN', currency: 'INR', currentPrice: null, isOwned: false },
  { id: 'pop-hdfcbank', symbol: 'HDFCBANK', companyName: 'HDFC Bank Ltd', exchange: 'NSE', market: 'IN', currency: 'INR', currentPrice: null, isOwned: false },
];

@Component({
  selector: 'app-ai-analyst',
  standalone: true,
  imports: [FormsModule, RouterLink, CurrencyPipe, DecimalPipe],
  template: `
    <div class="ai-page">
      <!-- Sidebar: stock search & selector -->
      <aside class="stock-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-title-row">
            <h2>AI Analyst</h2>
            @if (aiService.hasApiKey()) {
              <span class="ai-status-tag active" title="Powered by Google Gemini Live">🟢 Gemini Live</span>
            } @else {
              <a routerLink="/money/settings" class="ai-status-tag setup" title="Add Gemini API Key in Settings">⚡ Add API Key</a>
            }
          </div>
          <p>Analyze any stock with predictive market news.</p>
        </div>

        <!-- Stock Live Search Box -->
        <div class="sidebar-search-box">
          <div class="search-input-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" class="search-icon">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              class="stock-search-input"
              placeholder="Search any stock (e.g. NVDA, RELIANCE)..."
              [(ngModel)]="searchQuery"
              (input)="onSearchInput()"
              id="ai-stock-search-input"
              autocomplete="off"
            />
            @if (searchQuery) {
              <button type="button" class="btn-clear-search" (click)="clearSearch()">×</button>
            }
          </div>
        </div>

        <!-- Sidebar Body: Search Results OR Category Views -->
        <div class="sidebar-scroll-area">
          @if (searchQuery.trim().length > 0) {
            <!-- Live Search Results -->
            <div class="section-group">
              <div class="section-label">Search Results ({{ searchResults().length }})</div>
              <div class="stock-list">
                @for (item of searchResults(); track item.symbol) {
                  <button
                    type="button"
                    class="stock-btn"
                    [class.active]="selectedTarget()?.symbol === item.symbol"
                    (click)="selectSearchResult(item)"
                  >
                    <div class="stock-btn-left">
                      <span class="stock-symbol">{{ item.market === 'IN' ? '🇮🇳 ' : '🇺🇸 ' }}{{ item.symbol }}</span>
                      <span class="stock-name">{{ item.companyName }}</span>
                    </div>
                    <span class="badge-research">Analyze</span>
                  </button>
                }

                <!-- Allow direct analysis of whatever custom ticker the user typed -->
                <button
                  type="button"
                  class="stock-btn custom-ticker-btn"
                  (click)="analyzeCustomTicker(searchQuery)"
                >
                  <div class="stock-btn-left">
                    <span class="stock-symbol">🔍 Analyze "{{ searchQuery.trim().toUpperCase() }}"</span>
                    <span class="stock-name">Evaluate latest market news & buy verdict</span>
                  </div>
                </button>
              </div>
            </div>
          } @else {
            <!-- 1. Portfolio Holdings Section -->
            @if (portfolioHoldings().length > 0) {
              <div class="section-group">
                <div class="section-label">My Portfolio Holdings ({{ portfolioHoldings().length }})</div>
                <div class="stock-list">
                  @for (h of portfolioHoldings(); track h.id) {
                    <button
                      type="button"
                      class="stock-btn"
                      [class.active]="selectedTarget()?.symbol === h.symbol && selectedTarget()?.isOwned"
                      (click)="selectHolding(h)"
                    >
                      <div class="stock-btn-left">
                        <span class="stock-symbol">{{ h.market === 'IN' ? '🇮🇳 ' : '🇺🇸 ' }}{{ h.symbol }}</span>
                        <span class="stock-name">{{ h.companyName }}</span>
                      </div>
                      @if (h.profitLossPct !== null) {
                        <span class="stock-pct" [class.positive]="h.profitLossPct >= 0" [class.negative]="h.profitLossPct < 0">
                          {{ h.profitLossPct >= 0 ? '+' : '' }}{{ h.profitLossPct.toFixed(1) }}%
                        </span>
                      }
                    </button>
                  }
                </div>
              </div>
            }

            <!-- 2. Popular Stocks to Research / Predict Buy or Do Not Buy -->
            <div class="section-group">
              <div class="section-label">Research Any Stock (Pre-Buy)</div>
              <div class="stock-list">
                @for (item of popularStocks; track item.symbol) {
                  <button
                    type="button"
                    class="stock-btn"
                    [class.active]="selectedTarget()?.symbol === item.symbol && !selectedTarget()?.isOwned"
                    (click)="selectTarget(item)"
                  >
                    <div class="stock-btn-left">
                      <span class="stock-symbol">{{ item.market === 'IN' ? '🇮🇳 ' : '🇺🇸 ' }}{{ item.symbol }}</span>
                      <span class="stock-name">{{ item.companyName }}</span>
                    </div>
                    <span class="badge-research">Pre-Buy</span>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </aside>

      <!-- Main content area -->
      <main class="chat-area">
        <!-- Multi-Capability Navigation Bar -->
        <div class="ai-feature-nav">
          <button
            type="button"
            class="ai-nav-tab"
            [class.active]="activeTab() === 'NEWS_VERDICT'"
            (click)="switchTab('NEWS_VERDICT')"
          >
            <span class="tab-icon">📰</span>
            <span>Market News Verdict</span>
          </button>
          <button
            type="button"
            class="ai-nav-tab"
            [class.active]="activeTab() === 'MORNING_BELL'"
            (click)="switchTab('MORNING_BELL')"
          >
            <span class="tab-icon">🔔</span>
            <span>Morning Bell Briefing</span>
          </button>
          <button
            type="button"
            class="ai-nav-tab"
            [class.active]="activeTab() === 'EARNINGS_FILINGS'"
            (click)="switchTab('EARNINGS_FILINGS')"
          >
            <span class="tab-icon">📑</span>
            <span>Earnings & Filings</span>
          </button>
          <button
            type="button"
            class="ai-nav-tab"
            [class.active]="activeTab() === 'STRESS_TEST'"
            (click)="switchTab('STRESS_TEST')"
          >
            <span class="tab-icon">⚡</span>
            <span>What-If Stress Test</span>
          </button>
        </div>

        <!-- TAB 1: Market News Verdict & Predictive Chat -->
        @if (activeTab() === 'NEWS_VERDICT') {
          @if (selectedTarget()) {
            <!-- Stock context header -->
            <div class="context-bar">
              <div class="context-info">
                <span class="ctx-symbol">{{ selectedTarget()!.market === 'IN' ? '🇮🇳 ' : '🇺🇸 ' }}{{ selectedTarget()!.symbol }}</span>
                <span class="ctx-name">{{ selectedTarget()!.companyName }}</span>
                @if (!selectedTarget()!.isOwned) {
                  <span class="badge-prebuy" title="Pre-investment research: AI evaluates market news before you buy">
                    🔍 Pre-Buy Analysis
                  </span>
                } @else {
                  <span class="badge-holding" title="Active holding in your portfolio">
                    💼 Owned Holding
                  </span>
                }
              </div>

              <div class="ctx-position">
                @if (selectedTarget()!.isOwned) {
                  <span>{{ selectedTarget()!.shares }} shares</span>
                  <span>·</span>
                  <span>Avg {{ selectedTarget()!.avgPurchasePrice | currency:selectedTarget()!.currency:'symbol':'1.2-2' }}</span>
                  @if (selectedTarget()!.profitLossPct !== null) {
                    <span>·</span>
                    <span [class.ctx-gain]="selectedTarget()!.profitLossPct! >= 0" [class.ctx-loss]="selectedTarget()!.profitLossPct! < 0">
                      {{ selectedTarget()!.profitLossPct! >= 0 ? '+' : '' }}{{ selectedTarget()!.profitLossPct!.toFixed(2) }}%
                    </span>
                  }
                } @else {
                  <a
                    routerLink="/money"
                    [queryParams]="{ addSymbol: selectedTarget()!.symbol }"
                    class="btn-add-portfolio"
                    title="Add {{ selectedTarget()!.symbol }} to portfolio"
                  >
                    + Add to Portfolio
                  </a>
                }

                @if (messages().length > 0) {
                  <button type="button" class="btn-clear-chat" (click)="clearChat()" title="Clear conversation history for this stock">
                    Clear Chat
                  </button>
                }
              </div>
            </div>

            <!-- Chat messages -->
            <div class="chat-messages" #messagesContainer>
              @if (messages().length === 0) {
                <!-- Welcome state -->
                <div class="chat-welcome">
                  <div class="welcome-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="36" height="36">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <h3>Should you buy {{ selectedTarget()!.symbol }}?</h3>
                  <p class="welcome-desc">
                    Ask Gemini AI to evaluate <strong>latest breaking market news</strong>, weigh positive catalysts against negative risk factors, and get a clear <strong>BUY</strong>, <strong>HOLD</strong>, or <strong>DO NOT BUY</strong> decision.
                  </p>

                  <div class="quick-prompt-title">Suggested Inquiries for {{ selectedTarget()!.symbol }}:</div>
                  <div class="suggested-questions">
                    @for (q of suggestedQuestions(); track q) {
                      <button type="button" class="suggested-q" (click)="askQuestion(q)">{{ q }}</button>
                    }
                  </div>
                </div>
              } @else {
                @for (msg of messages(); track msg.id) {
                  <div class="msg" [class.user-msg]="msg.role === 'user'" [class.ai-msg]="msg.role === 'assistant'">
                    @if (msg.role === 'user') {
                      <div class="msg-bubble user-bubble">{{ msg.content }}</div>
                    } @else {
                      @if (isAnalysis(msg.content)) {
                        <div class="analysis-card">

                          <!-- 1. Prominent Buy / Hold / Do-Not-Buy Decision Banner -->
                          <div class="verdict-card" [class]="'verdict-' + (msg.content.verdict || 'hold').toLowerCase().replace('_', '-')">
                            <div class="verdict-top-row">
                              <div class="verdict-pill">
                                @if (msg.content.verdict === 'BUY') {
                                  <span class="v-icon">🟢</span>
                                  <span class="v-text">DECISION VERDICT: BUY / ACCUMULATE</span>
                                } @else if (msg.content.verdict === 'DO_NOT_BUY') {
                                  <span class="v-icon">🔴</span>
                                  <span class="v-text">DECISION VERDICT: DO NOT BUY / AVOID</span>
                                } @else {
                                  <span class="v-icon">🟡</span>
                                  <span class="v-text">DECISION VERDICT: HOLD / WAIT</span>
                                }
                              </div>

                              <div class="verdict-meta-badges">
                                @if (msg.content.isRealtime) {
                                  <span class="realtime-badge">✨ Gemini Live</span>
                                }
                                <span class="confidence-badge">Confidence: {{ msg.content.confidence }}%</span>
                              </div>
                            </div>

                            <p class="verdict-rationale">{{ msg.content.verdictReasoning }}</p>

                            <div class="market-prediction-box">
                              <span class="pred-label">📊 News Prediction:</span>
                              <span class="pred-text">{{ msg.content.marketPrediction }}</span>
                            </div>
                          </div>

                          <!-- 2. Breaking News Catalysts -->
                          @if (msg.content.newsCatalysts && msg.content.newsCatalysts.length > 0) {
                            <div class="analysis-section">
                              <h4>Breaking Market News & Catalysts Evaluated</h4>
                              <div class="catalysts-grid">
                                @for (item of msg.content.newsCatalysts; track item.headline) {
                                  <div class="catalyst-item" [class.cat-pos]="item.impact === 'POSITIVE'" [class.cat-neg]="item.impact === 'NEGATIVE'">
                                    <div class="cat-top">
                                      <span class="cat-impact-tag" [class.cat-pos]="item.impact === 'POSITIVE'" [class.cat-neg]="item.impact === 'NEGATIVE'">
                                        {{ item.impact === 'POSITIVE' ? '▲ POSITIVE NEWS' : item.impact === 'NEGATIVE' ? '▼ NEGATIVE NEWS' : '◼ NEUTRAL' }}
                                      </span>
                                      @if (item.publisher) {
                                        <span class="cat-source">{{ item.publisher }}</span>
                                      }
                                    </div>
                                    <p class="cat-headline">{{ item.headline }}</p>
                                    @if (item.predictedReaction) {
                                      <div class="cat-reaction">
                                        <span class="r-label">Market Reaction:</span> {{ item.predictedReaction }}
                                      </div>
                                    }
                                    @if (item.url) {
                                      <a [href]="item.url" target="_blank" rel="noopener noreferrer" class="cat-link">Read full story &rarr;</a>
                                    }
                                  </div>
                                }
                              </div>
                            </div>
                          }

                          <!-- 3. Balance Sheet of Catalysts -->
                          <div class="factors-comparison-grid">
                            <div class="factor-column col-positive">
                              <h5>
                                <span class="bullet-icon">✓</span>
                                Why to Buy / Positive Catalysts
                              </h5>
                              <ul>
                                @for (pos of msg.content.positiveFactors; track pos) {
                                  <li>{{ pos }}</li>
                                }
                              </ul>
                            </div>

                            <div class="factor-column col-negative">
                              <h5>
                                <span class="bullet-icon">✕</span>
                                Why Not to Buy / Negative Risk Factors
                              </h5>
                              <ul>
                                @for (neg of msg.content.negativeFactors; track neg) {
                                  <li>{{ neg }}</li>
                                }
                              </ul>
                            </div>
                          </div>

                          <!-- 4. Key Risks -->
                          @if (msg.content.keyRisks) {
                            <div class="analysis-section key-risks-box">
                              <h4>⚠️ Key Downside Risks to Monitor</h4>
                              <p>{{ msg.content.keyRisks }}</p>
                            </div>
                          }

                          <!-- 5. Strategic Summary -->
                          <div class="analysis-section">
                            <h4>Comprehensive Market Outlook</h4>
                            <p class="summary-text">{{ msg.content.summary }}</p>
                          </div>

                          <div class="disclaimer-text">{{ msg.content.disclaimer }}</div>
                        </div>
                      } @else {
                        <div class="msg-bubble ai-bubble">{{ msg.content }}</div>
                      }
                    }
                  </div>
                }
              }

              @if (isLoading()) {
                <div class="msg ai-msg">
                  <div class="typing-indicator-box">
                    <div class="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                    <span class="loading-label">Gemini is fetching breaking market news and evaluating buy/do-not-buy decision...</span>
                  </div>
                </div>
              }
            </div>

            <!-- Input form -->
            <form class="chat-input-area" (ngSubmit)="submit()">
              <input
                type="text"
                class="chat-input"
                [placeholder]="'Ask if you should buy ' + selectedTarget()!.symbol + ' based on latest news...'"
                [(ngModel)]="question"
                name="question"
                [disabled]="isLoading()"
                id="ai-question-input"
                autocomplete="off"
              />
              <button type="submit" class="send-btn" [disabled]="!question.trim() || isLoading()" aria-label="Send">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </form>
          } @else {
            <div class="no-selection">
              <div class="no-selection-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="36" height="36">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h3>Select or search any stock to begin</h3>
              <p>Use the search bar on the left to analyze any US or Indian stock with real-time market news.</p>
            </div>
          }
        }

        <!-- TAB 2: Morning Bell Briefing -->
        @if (activeTab() === 'MORNING_BELL') {
          <div class="tab-scroll-container">
            <div class="tab-header-banner">
              <div>
                <span class="tag-pill">Institutional Pre-Market Intelligence</span>
                <h2>Morning Bell Executive Briefing</h2>
                <p class="sub-text">Overnight cues, global futures, and active catalyst impacts mapped to your portfolio.</p>
              </div>
              <button class="btn-refresh" (click)="loadMorningBriefing()" [disabled]="briefingLoading()">
                {{ briefingLoading() ? 'Refreshing...' : '↻ Refresh Global Cues' }}
              </button>
            </div>

            @if (briefingLoading()) {
              <div class="ai-loading-box">
                <div class="spinner-gold"></div>
                <p>Synthesizing GIFT Nifty, S&P 500 futures, and treasury yields...</p>
              </div>
            } @else if (morningBriefing()) {
              <div class="tab-content-grid">
                <!-- Global Cues Grid -->
                <div class="global-cues-grid">
                  <div class="cue-card">
                    <span class="cue-name">S&P 500 Futures</span>
                    <strong class="cue-val val-green">{{ morningBriefing()?.globalCues?.sp500Futures }}</strong>
                  </div>
                  <div class="cue-card">
                    <span class="cue-name">GIFT Nifty</span>
                    <strong class="cue-val val-green">{{ morningBriefing()?.globalCues?.giftNifty }}</strong>
                  </div>
                  <div class="cue-card">
                    <span class="cue-name">Brent Crude Oil</span>
                    <strong class="cue-val">{{ morningBriefing()?.globalCues?.crudeOil }}</strong>
                  </div>
                  <div class="cue-card">
                    <span class="cue-name">US 10-Yr Yield</span>
                    <strong class="cue-val">{{ morningBriefing()?.globalCues?.us10yYield }}</strong>
                  </div>
                </div>

                <!-- Macro Theme -->
                <div class="macro-theme-box">
                  <div class="theme-top">
                    <span class="directive-badge">Core Macro Directive</span>
                    <span class="sentiment-badge" [class.bull]="morningBriefing()?.globalCues?.marketSentiment === 'BULLISH'">
                      {{ morningBriefing()?.globalCues?.marketSentiment }} BIAS
                    </span>
                  </div>
                  <p class="theme-content">{{ morningBriefing()?.keyTheme }}</p>
                </div>

                <!-- Holdings Catalysts -->
                <div class="catalysts-section">
                  <h3>Overnight Catalysts On Your Holdings</h3>
                  <div class="holdings-catalysts-grid">
                    @for (item of (morningBriefing()?.holdingsImpact || []); track (item.symbol + '_' + $index)) {
                      <div class="holding-cat-card" [class.up-card]="item.expectedMovement === 'UP'" [class.down-card]="item.expectedMovement === 'DOWN'">
                        <div class="cat-top-row">
                          <span class="cat-sym">{{ item.symbol }}</span>
                          <span class="move-pill" [class.move-up]="item.expectedMovement === 'UP'" [class.move-down]="item.expectedMovement === 'DOWN'">
                            {{ item.expectedMovement === 'UP' ? '▲ Positive Reaction' : item.expectedMovement === 'DOWN' ? '▼ Cautious' : '◼ Rangebound' }}
                          </span>
                        </div>
                        <p class="cat-headline-txt">{{ item.catalyst }}</p>
                        <small class="cat-reason-txt">{{ item.reason }}</small>
                      </div>
                    }
                  </div>
                </div>

                <!-- Tactical Action Plan -->
                <div class="action-plan-box">
                  <h3>Daily Tactical Action Directives</h3>
                  <ul>
                    @for (act of (morningBriefing()?.actionPlan || []); track (act + '_' + $index)) {
                      <li>{{ act }}</li>
                    }
                  </ul>
                </div>
              </div>
            }
          </div>
        }

        <!-- TAB 3: Corporate Earnings & SEC/SEBI Filings -->
        @if (activeTab() === 'EARNINGS_FILINGS') {
          <div class="tab-scroll-container">
            <div class="tab-header-banner">
              <div>
                <span class="tag-pill">Institutional Disclosures</span>
                <h2>Corporate Earnings & Regulatory Filings</h2>
                <p class="sub-text">10-Q / 10-K and quarterly financial statements, revenue/EPS consensus, and forward guidance.</p>
              </div>

              <div class="filing-selector-group">
                <select [ngModel]="selectedTarget()?.symbol" (ngModelChange)="onEarningsSymbolSelect($event)" class="symbol-dropdown">
                  @for (h of portfolioHoldings(); track h.symbol) {
                    <option [value]="h.symbol">{{ h.symbol }} — {{ h.companyName }}</option>
                  }
                  @for (p of popularStocks; track p.symbol) {
                    <option [value]="p.symbol">{{ p.symbol }} — {{ p.companyName }}</option>
                  }
                </select>
                <button class="btn-refresh" (click)="loadEarningsSummary()" [disabled]="earningsLoading()">
                  {{ earningsLoading() ? 'Analyzing...' : 'Analyze Filings' }}
                </button>
              </div>
            </div>

            @if (earningsLoading()) {
              <div class="ai-loading-box">
                <div class="spinner-gold"></div>
                <p>Auditing quarterly financial statements, consensus beat/miss, and executive guidance...</p>
              </div>
            } @else if (earningsSummary()) {
              <div class="tab-content-grid">
                <!-- KPI Strip -->
                <div class="earnings-strip">
                  <div class="kpi-card">
                    <span class="kpi-label">Quarterly Revenue</span>
                    <div class="kpi-val-wrap">
                      <strong>{{ earningsSummary()?.revenue?.reported }}</strong>
                      <span class="status-pill" [class.miss-pill]="earningsSummary()?.revenue?.status === 'MISS'">
                        {{ earningsSummary()?.revenue?.status }}
                      </span>
                    </div>
                    <small>Consensus: {{ earningsSummary()?.revenue?.consensus }}</small>
                  </div>

                  <div class="kpi-card">
                    <span class="kpi-label">Earnings Per Share (EPS)</span>
                    <div class="kpi-val-wrap">
                      <strong>{{ earningsSummary()?.eps?.reported }}</strong>
                      <span class="status-pill" [class.miss-pill]="earningsSummary()?.eps?.status === 'MISS'">
                        {{ earningsSummary()?.eps?.status }}
                      </span>
                    </div>
                    <small>Consensus: {{ earningsSummary()?.eps?.consensus }}</small>
                  </div>

                  <div class="kpi-card">
                    <span class="kpi-label">Operating Margin</span>
                    <div class="kpi-val-wrap">
                      <strong>{{ earningsSummary()?.operatingMargin }}</strong>
                    </div>
                    <small>Operating Leverage Metric</small>
                  </div>

                  <div class="kpi-card">
                    <span class="kpi-label">Guidance Tone</span>
                    <div class="kpi-val-wrap">
                      <span class="tone-badge" [class.opt]="earningsSummary()?.guidanceTone === 'OPTIMISTIC'" [class.caut]="earningsSummary()?.guidanceTone === 'CAUTIOUS'">
                        {{ earningsSummary()?.guidanceTone }}
                      </span>
                    </div>
                    <small>Executive Pipeline Visibility</small>
                  </div>
                </div>

                <!-- Executive Commentary -->
                <div class="mgmt-commentary-box">
                  <h4>Management & Executive Commentary</h4>
                  <p>{{ earningsSummary()?.managementCommentary }}</p>
                </div>

                <!-- Highlights & Headwinds -->
                <div class="two-column-cards">
                  <div class="col-card">
                    <h4 class="green-head">Key Operational Highlights</h4>
                    <ul>
                      @for (hi of earningsSummary()?.keyHighlights; track hi) {
                        <li>{{ hi }}</li>
                      }
                    </ul>
                  </div>

                  <div class="col-card">
                    <h4 class="red-head">Headwinds & Key Risks</h4>
                    <ul>
                      @for (rk of earningsSummary()?.risksOrHeadwinds; track rk) {
                        <li>{{ rk }}</li>
                      }
                    </ul>
                  </div>
                </div>

                <!-- Bottom Line Verdict -->
                <div class="bottom-verdict-box">
                  <span class="verdict-tag">Institutional Research Verdict</span>
                  <p>{{ earningsSummary()?.bottomLineVerdict }}</p>
                </div>
              </div>
            }
          </div>
        }

        <!-- TAB 4: What-If Stress Testing -->
        @if (activeTab() === 'STRESS_TEST') {
          <div class="tab-scroll-container">
            <div class="tab-header-banner">
              <div>
                <span class="tag-pill">Macro Shock Simulation</span>
                <h2>Portfolio "What-If" Stress Testing</h2>
                <p class="sub-text">Simulate structural macroeconomic disruptions to evaluate holding-level resilience and projected capital drawdowns.</p>
              </div>
            </div>

            <!-- Scenario Selection Bar -->
            <div class="scenario-buttons-row">
              @for (sc of scenarios; track sc.id) {
                <button
                  type="button"
                  class="scenario-btn"
                  [class.selected]="selectedScenarioId() === sc.id"
                  (click)="runStressTest(sc.id)"
                >
                  <span class="sc-icon">{{ sc.icon }}</span>
                  <div class="sc-text">
                    <strong>{{ sc.name }}</strong>
                    <small>{{ sc.description }}</small>
                  </div>
                </button>
              }
            </div>

            @if (stressTestResult()) {
              <div class="tab-content-grid">
                <!-- Top Scorecard -->
                <div class="stress-scorecard">
                  <div class="scorecard-left">
                    <span class="card-tag">Projected Portfolio Impact</span>
                    <div class="impact-numbers-row">
                      <span class="impact-pct" [class.red-alert]="stressTestResult()?.vulnerabilityLevel === 'HIGH' || stressTestResult()?.vulnerabilityLevel === 'CRITICAL'">
                        {{ stressTestResult()?.estimatedPortfolioImpactPct }}%
                      </span>
                      <span class="impact-amount">
                        ({{ stressTestResult()!.estimatedPortfolioValueLoss >= 0 ? '+' : '' }}{{ stressTestResult()?.estimatedPortfolioValueLoss | number:'1.2-2' }})
                      </span>
                    </div>
                    <p class="summary-txt">{{ stressTestResult()?.executiveSummary }}</p>
                  </div>

                  <div class="scorecard-right">
                    <span class="risk-lbl">Portfolio Sensitivity</span>
                    <div class="vuln-pill" [class]="'vuln-' + (stressTestResult()?.vulnerabilityLevel || 'low').toLowerCase()">
                      {{ stressTestResult()?.vulnerabilityLevel }} RISK
                    </div>
                  </div>
                </div>

                <!-- Holding by Holding Vulnerability Table -->
                <div class="stress-table-card">
                  <div class="table-heading">Individual Holding Vulnerability Breakdown</div>
                  <div class="table-responsive">
                    <table class="stress-table">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Capital Value</th>
                          <th>Projected Change</th>
                          <th>Simulated P&L</th>
                          <th>Sensitivity</th>
                          <th>Mechanism Rationale</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (h of stressTestResult()?.holdingsImpact; track h.symbol) {
                          <tr>
                            <td><strong>{{ h.symbol }}</strong></td>
                            <td>{{ h.currentValue | number:'1.2-2' }}</td>
                            <td [class.val-red]="h.projectedChangePct < 0" [class.val-green]="h.projectedChangePct > 0">
                              {{ h.projectedChangePct >= 0 ? '+' : '' }}{{ h.projectedChangePct | number:'1.1-1' }}%
                            </td>
                            <td [class.val-red]="h.projectedDollarChange < 0" [class.val-green]="h.projectedDollarChange > 0">
                              {{ h.projectedDollarChange >= 0 ? '+' : '' }}{{ h.projectedDollarChange | number:'1.2-2' }}
                            </td>
                            <td>
                              <span class="vuln-badge" [class]="'v-' + h.vulnerability.toLowerCase()">
                                {{ h.vulnerability }}
                              </span>
                            </td>
                            <td class="rationale-cell">{{ h.rationale }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Mitigation Advice -->
                <div class="mitigation-box">
                  <h4>Institutional Hedging & Risk Directives</h4>
                  <ul>
                    @for (m of stressTestResult()?.mitigationAdvice; track m) {
                      <li>{{ m }}</li>
                    }
                  </ul>
                </div>
              </div>
            }
          </div>
        }
      </main>
    </div>
  `,
  styleUrl: './ai-analyst.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAnalystPage implements OnInit {
  protected readonly portfolio = inject(PortfolioService);
  protected readonly aiService = inject(AiAnalystService);
  private readonly route = inject(ActivatedRoute);

  protected readonly popularStocks = POPULAR_RESEARCH_STOCKS;
  protected readonly portfolioHoldings = computed(() => this.portfolio.holdings());

  protected readonly selectedTarget = signal<AnalystStockTarget | null>(null);
  protected readonly messages = signal<AiChatMessage[]>([]);
  protected readonly isLoading = signal(false);
  protected question = '';

  // Feature Tabs
  protected readonly activeTab = signal<'NEWS_VERDICT' | 'MORNING_BELL' | 'EARNINGS_FILINGS' | 'STRESS_TEST'>('NEWS_VERDICT');

  // Morning Bell Briefing state
  protected readonly morningBriefing = signal<MorningBriefing | null>(this.aiService.getFallbackMorningBriefing());
  protected readonly briefingLoading = signal<boolean>(false);

  // Corporate Earnings & Filings state
  protected readonly earningsSummary = signal<EarningsReportSummary | null>(null);
  protected readonly earningsLoading = signal<boolean>(false);

  // What-If Stress Testing state
  protected readonly scenarios = STRESS_TEST_SCENARIOS;
  protected readonly selectedScenarioId = signal<string>('crude_oil_spike');
  protected readonly stressTestResult = signal<StressTestResult | null>(null);

  protected searchQuery = '';
  protected readonly searchResults = signal<StockSearchResult[]>([]);

  protected readonly suggestedQuestions = computed(() => {
    const t = this.selectedTarget();
    if (!t) return [];
    return this.aiService.getSuggestedQuestions(t.symbol, t.companyName, t.isOwned);
  });

  ngOnInit(): void {
    const symbolParam = this.route.snapshot.queryParamMap.get('symbol');
    if (symbolParam) {
      const cleanSym = symbolParam.toUpperCase();
      const existingHolding = this.portfolio.getHoldingBySymbol(cleanSym);
      if (existingHolding) {
        this.selectHolding(existingHolding);
      } else {
        this.analyzeCustomTicker(cleanSym);
      }
    } else if (this.portfolioHoldings().length > 0) {
      this.selectHolding(this.portfolioHoldings()[0]);
    } else {
      this.selectTarget(this.popularStocks[0]);
    }
  }

  onSearchInput(): void {
    const q = this.searchQuery.trim();
    if (!q) {
      this.searchResults.set([]);
      return;
    }
    // Search both local curated stocks and remote ticker catalog
    const local = this.portfolio.searchStocks(q);
    this.searchResults.set(local);

    this.portfolio.searchStocksRemote(q).then((remote) => {
      if (remote.length > 0 && this.searchQuery.trim() === q) {
        // Merge without duplicate symbols
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
    // Check if user happens to own this target in their portfolio
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
      companyName: `${sym} Equity`,
      exchange: isIndia ? 'NSE' : 'US Market',
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
    const saved = this.aiService.getMessages(target.symbol);
    this.messages.set(saved);
  }

  clearChat(): void {
    const t = this.selectedTarget();
    if (!t) return;
    this.aiService.clearMessages(t.symbol);
    this.messages.set([]);
  }

  askQuestion(q: string): void {
    this.question = q;
    this.submit();
  }

  async submit(): Promise<void> {
    const q = this.question.trim();
    const target = this.selectedTarget();
    if (!q || !target || this.isLoading()) return;

    this.question = '';

    const userMsg: AiChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: q,
      createdAt: new Date().toISOString(),
    };
    this.messages.update((ms) => [...ms, userMsg]);
    this.aiService.saveMessage(target.symbol, userMsg);
    this.isLoading.set(true);

    try {
      const analysis = await this.aiService.analyzeStock({
        symbol: target.symbol,
        companyName: target.companyName,
        market: target.market,
        question: q,
        isOwned: target.isOwned,
        portfolioContext: target.isOwned && target.shares ? {
          shares: target.shares,
          avgCost: target.avgPurchasePrice || 0,
          currentPrice: target.currentPrice,
          profitLossPct: target.profitLossPct ?? null,
        } : null,
      });

      const aiMsg: AiChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: analysis,
        createdAt: new Date().toISOString(),
      };
      this.messages.update((ms) => [...ms, aiMsg]);
      this.aiService.saveMessage(target.symbol, aiMsg);
    } catch {
      const errMsg: AiChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        content: 'AI Analyst was unable to complete the analysis. Please check your network or configure a Google Gemini API Key in Settings.',
        createdAt: new Date().toISOString(),
      };
      this.messages.update((ms) => [...ms, errMsg]);
    } finally {
      this.isLoading.set(false);
    }
  }

  isAnalysis(content: string | AiAnalysis): content is AiAnalysis {
    return typeof content === 'object' && ('sentiment' in content || 'verdict' in content);
  }

  directionLabel(d: string): string {
    if (d === 'POSITIVE_BIAS') return '↑ Positive Bullish Bias';
    if (d === 'NEGATIVE_BIAS') return '↓ Negative Bearish Bias';
    return '→ Neutral / Range-bound';
  }

  switchTab(tab: 'NEWS_VERDICT' | 'MORNING_BELL' | 'EARNINGS_FILINGS' | 'STRESS_TEST'): void {
    this.activeTab.set(tab);
    if (tab === 'MORNING_BELL' && !this.morningBriefing()) {
      this.loadMorningBriefing();
    } else if (tab === 'EARNINGS_FILINGS' && !this.earningsSummary()) {
      this.loadEarningsSummary();
    } else if (tab === 'STRESS_TEST' && !this.stressTestResult()) {
      this.runStressTest(this.selectedScenarioId());
    }
  }

  async loadMorningBriefing(): Promise<void> {
    this.briefingLoading.set(true);
    try {
      const holdings = this.portfolio.holdings();
      const briefing = await this.aiService.generateMorningBriefing(holdings);
      this.morningBriefing.set(briefing);
    } finally {
      this.briefingLoading.set(false);
    }
  }

  async loadEarningsSummary(): Promise<void> {
    const target = this.selectedTarget();
    if (!target) return;
    this.earningsLoading.set(true);
    try {
      const summary = await this.aiService.summarizeEarningsAndFilings(target.symbol, target.companyName);
      this.earningsSummary.set(summary);
    } finally {
      this.earningsLoading.set(false);
    }
  }

  onEarningsSymbolSelect(symbol: string): void {
    const sym = symbol.toUpperCase();
    const owned = this.portfolio.getHoldingBySymbol(sym);
    if (owned) {
      this.selectHolding(owned);
    } else {
      const found = this.popularStocks.find((p) => p.symbol === sym);
      if (found) this.selectTarget(found);
    }
    this.loadEarningsSummary();
  }

  runStressTest(scenarioId: string): void {
    this.selectedScenarioId.set(scenarioId);
    const holdings = this.portfolio.holdings();
    const result = this.aiService.runPortfolioStressTest(scenarioId, holdings);
    this.stressTestResult.set(result);
  }
}
