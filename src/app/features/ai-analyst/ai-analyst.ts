import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { AiAnalystService, AiAnalysis, AiChatMessage } from '../../core/services/ai-analyst.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { Holding } from '../../core/models/portfolio.model';

@Component({
  selector: 'app-ai-analyst',
  standalone: true,
  imports: [FormsModule, RouterLink, CurrencyPipe],
  template: `
    <div class="ai-page">
      <!-- Sidebar: stock selector -->
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
          <p>Ask about any stock you own.</p>
        </div>

        @if (portfolio.holdings().length > 0) {
          <nav class="stock-list">
            @for (h of portfolio.holdings(); track h.id) {
              <button
                type="button"
                class="stock-btn"
                [class.active]="selectedHolding()?.id === h.id"
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
          </nav>
        } @else {
          <div class="no-stocks">
            <p>Add stocks to your portfolio to use AI Analyst.</p>
            <a routerLink="/money" class="btn-go">Go to Portfolio</a>
          </div>
        }
      </aside>

      <!-- Main chat area -->
      <main class="chat-area">
        @if (selectedHolding()) {
          <!-- Stock context header -->
          <div class="context-bar">
            <div class="context-info">
              <span class="ctx-symbol">{{ selectedHolding()!.market === 'IN' ? '🇮🇳 ' : '🇺🇸 ' }}{{ selectedHolding()!.symbol }}</span>
              <span class="ctx-name">{{ selectedHolding()!.companyName }}</span>
            </div>
            <div class="ctx-position">
              <span>{{ selectedHolding()!.shares }} shares</span>
              <span>·</span>
              <span>Avg cost {{ selectedHolding()!.avgPurchasePrice | currency:selectedHolding()!.currency:'symbol':'1.2-2' }}</span>
              @if (selectedHolding()!.profitLossPct !== null) {
                <span>·</span>
                <span [class.ctx-gain]="selectedHolding()!.profitLossPct! >= 0" [class.ctx-loss]="selectedHolding()!.profitLossPct! < 0">
                  {{ selectedHolding()!.profitLossPct! >= 0 ? '+' : '' }}{{ selectedHolding()!.profitLossPct!.toFixed(2) }}%
                </span>
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <h3>What would you like to know about {{ selectedHolding()!.symbol }}?</h3>
                <p>
                  @if (aiService.hasApiKey()) {
                    Ask for real-time market analysis, latest earnings developments, or risk factors powered by Gemini AI.
                  } @else {
                    Ask about performance, risks, or market catalysts. (Add your Gemini API Key in Settings for live data).
                  }
                </p>

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
                        <!-- Sentiment -->
                        <div class="analysis-header">
                          <div class="sentiment-badge" [class]="'sentiment-' + msg.content.sentiment.toLowerCase()">
                            {{ sentimentIcon(msg.content.sentiment) }} {{ sentimentLabel(msg.content.sentiment) }}
                          </div>
                          @if (msg.content.isRealtime) {
                            <span class="realtime-badge">✨ Gemini 2.0 Live</span>
                          }
                          <div class="confidence-bar">
                            <span class="confidence-label">Confidence</span>
                            <div class="bar-track">
                              <div class="bar-fill" [style.width.%]="msg.content.confidence"></div>
                            </div>
                            <span class="confidence-pct">{{ msg.content.confidence }}%</span>
                          </div>
                        </div>

                        <div class="analysis-section">
                          <h4>Why?</h4>
                          <p>{{ msg.content.whySummary }}</p>
                        </div>

                        @if (msg.content.positiveFactors.length > 0) {
                          <div class="analysis-section">
                            <h4 class="positive-header">Positive Catalysts</h4>
                            <ul class="factor-list positive-list">
                              @for (f of msg.content.positiveFactors; track f) {
                                <li>{{ f }}</li>
                              }
                            </ul>
                          </div>
                        }

                        @if (msg.content.negativeFactors.length > 0) {
                          <div class="analysis-section">
                            <h4 class="negative-header">Risk Factors</h4>
                            <ul class="factor-list negative-list">
                              @for (f of msg.content.negativeFactors; track f) {
                                <li>{{ f }}</li>
                              }
                            </ul>
                          </div>
                        }

                        <div class="analysis-section direction-section">
                          <h4>Potential Direction</h4>
                          <span class="direction-badge" [class]="'direction-' + msg.content.potentialDirection.toLowerCase()">
                            {{ directionLabel(msg.content.potentialDirection) }}
                          </span>
                        </div>

                        <div class="analysis-section">
                          <h4>Key Risks</h4>
                          <p>{{ msg.content.keyRisks }}</p>
                        </div>

                        <div class="analysis-section">
                          <h4>Summary</h4>
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
                <div class="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            }
          </div>

          <!-- Input -->
          <form class="chat-input-area" (ngSubmit)="submit()">
            <input
              type="text"
              class="chat-input"
              [placeholder]="aiService.hasApiKey() ? 'Ask Gemini AI Analyst about ' + selectedHolding()!.symbol + '...' : 'Ask AI Analyst... (Add Gemini key in Settings for live news)'"
              [(ngModel)]="question"
              name="question"
              [disabled]="isLoading()"
              id="ai-question-input"
              autocomplete="off"
            >
            <button type="submit" class="send-btn" [disabled]="!question.trim() || isLoading()" aria-label="Send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        } @else {
          <!-- No stock selected -->
          <div class="no-selection">
            <div class="no-selection-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="36" height="36">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h3>Select a stock to get started</h3>
            <p>Choose a stock from your portfolio on the left to ask the AI Analyst.</p>
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

  protected readonly selectedHolding = signal<Holding | null>(null);
  protected readonly messages = signal<AiChatMessage[]>([]);
  protected readonly isLoading = signal(false);
  protected question = '';

  protected readonly suggestedQuestions = computed(() => {
    const h = this.selectedHolding();
    if (!h) return [];
    return this.aiService.getSuggestedQuestions(h.symbol, h.companyName);
  });

  ngOnInit(): void {
    const symbol = this.route.snapshot.queryParamMap.get('symbol');
    if (symbol) {
      const h = this.portfolio.getHoldingBySymbol(symbol);
      if (h) this.selectHolding(h);
    } else if (this.portfolio.holdings().length > 0) {
      this.selectHolding(this.portfolio.holdings()[0]);
    }
  }

  selectHolding(h: Holding): void {
    this.selectedHolding.set(h);
    // Load persisted chat history for this stock
    const saved = this.aiService.getMessages(h.symbol);
    this.messages.set(saved);
  }

  clearChat(): void {
    const h = this.selectedHolding();
    if (!h) return;
    this.aiService.clearMessages(h.symbol);
    this.messages.set([]);
  }

  askQuestion(q: string): void {
    this.question = q;
    this.submit();
  }

  async submit(): Promise<void> {
    const q = this.question.trim();
    const holding = this.selectedHolding();
    if (!q || !holding || this.isLoading()) return;

    this.question = '';

    const userMsg: AiChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: q,
      createdAt: new Date().toISOString(),
    };
    this.messages.update((ms) => [...ms, userMsg]);
    this.aiService.saveMessage(holding.symbol, userMsg);
    this.isLoading.set(true);

    try {
      const analysis = await this.aiService.analyzeStock({
        symbol: holding.symbol,
        companyName: holding.companyName,
        question: q,
        portfolioContext: {
          shares: holding.shares,
          avgCost: holding.avgPurchasePrice,
          currentPrice: holding.currentPrice,
          profitLossPct: holding.profitLossPct,
        },
      });

      const aiMsg: AiChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: analysis,
        createdAt: new Date().toISOString(),
      };
      this.messages.update((ms) => [...ms, aiMsg]);
      this.aiService.saveMessage(holding.symbol, aiMsg);
    } catch {
      const errMsg: AiChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        content: 'AI Analyst is temporarily unavailable. Please verify your Gemini API Key in Settings.',
        createdAt: new Date().toISOString(),
      };
      this.messages.update((ms) => [...ms, errMsg]);
    } finally {
      this.isLoading.set(false);
    }
  }

  isAnalysis(content: string | AiAnalysis): content is AiAnalysis {
    return typeof content === 'object' && 'sentiment' in content;
  }

  sentimentIcon(s: string): string {
    if (s === 'POSITIVE') return '🟢';
    if (s === 'NEGATIVE') return '🔴';
    return '🟡';
  }

  sentimentLabel(s: string): string {
    if (s === 'POSITIVE') return 'Positive';
    if (s === 'NEGATIVE') return 'Negative';
    return 'Neutral';
  }

  directionLabel(d: string): string {
    if (d === 'POSITIVE_BIAS') return '↑ Positive Bias';
    if (d === 'NEGATIVE_BIAS') return '↓ Negative Bias';
    return '→ Neutral';
  }
}
