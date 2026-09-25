import {
  Component,
  ChangeDetectionStrategy,
  output,
  inject,
  signal,
  computed,
  OnInit,
  input,
  HostBinding
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutomationService, MLInferenceResult, StrategyEvaluationResult } from '../../../core/services/automation.service';
import { TradingService } from '../../../core/services/trading.service';

@Component({
  selector: 'app-automation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './automation-modal.scss',
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal-container">

        <!-- Header -->
        <div class="modal-header">
          <div class="header-titles">
            <div class="badge-tag">Phase 4 Engine · ML & Strategy Automation</div>
            <h2>Autonomous Strategy & Gateway Controller</h2>
            <p>Real-time data quality, deterministic strategy engine, model registry, and fail-closed safety.</p>
          </div>
          <button type="button" class="close-btn" (click)="closeModal.emit()" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Global Status Bar -->
        <div class="status-banner" [class.banner-active]="automationService.isAutomationActive()" [class.banner-halted]="isHalted()">
          <div class="status-info">
            <span class="status-indicator"></span>
            <div>
              <strong>
                @if (isHalted()) {
                  🚨 EMERGENCY KILL SWITCH ENGAGED — ALL TRADING & ORDERS HALTED
                } @else if (automationService.isAutomationActive()) {
                  ⚡ AUTOMATED STRATEGY TRADING ACTIVE (PAPER SIMULATION)
                } @else {
                  🛡️ AUTOMATION CURRENTLY DISABLED (FAIL-CLOSED SAFETY MODE)
                }
              </strong>
              <small>
                Gateway: {{ automationService.gatewayState()?.activeProvider || 'NSE_INSTITUTIONAL' }} ({{ automationService.gatewayState()?.primaryStatus || 'CONNECTED' }})
              </small>
            </div>
          </div>

          <div class="banner-actions">
            @if (automationService.isAutomationActive()) {
              <button type="button" class="btn btn-warning" (click)="handleDisableAutomation()">Pause Automation</button>
            }
            @if (isHalted()) {
              <button type="button" class="btn btn-success" (click)="handleResetKillSwitch()">
                🛡️ Disengage Kill Switch (Resume Trading)
              </button>
            } @else {
              <button type="button" class="btn btn-danger" (click)="handleKillSwitch()">
                🚨 Emergency Kill Switch
              </button>
            }
          </div>
        </div>

        <!-- Subnav Tabs -->
        <div class="modal-subnav">
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'CONTROL'" (click)="activeTab.set('CONTROL')">
            ⚙️ Strategy Control
          </button>
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'GATEWAY'" (click)="activeTab.set('GATEWAY')">
            📡 Live Data Gateway
          </button>
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'ML_REGISTRY'" (click)="activeTab.set('ML_REGISTRY')">
            🧠 ML Model Registry
          </button>
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'PAPER_SIM'" (click)="activeTab.set('PAPER_SIM')">
            📝 Paper Trading & Audit
          </button>
        </div>

        <!-- TAB 1: AUTOMATION & STRATEGY CONTROL -->
        @if (activeTab() === 'CONTROL') {
          <div class="tab-pane">
            <div class="section-card">
              <h3>Explicit User Consent & Risk Controls</h3>
              <p class="section-desc">Strategy automation requires explicit user consent and pre-trade risk parameter configuration before enabling.</p>

              <div class="consent-box">
                <label class="consent-checkbox-label">
                  <input type="checkbox" [(ngModel)]="userConsentGiven" />
                  <span>I explicitly consent to allow Aurum Strategy Engine to execute automated paper trades based on deterministic rule sets.</span>
                </label>
              </div>

              <div class="risk-inputs-grid">
                <div class="form-group">
                  <label>Max Single-Order Position Cap</label>
                  <input type="number" [(ngModel)]="maxPositionCap" placeholder="50" />
                  <small>Max shares per automated order tick</small>
                </div>
                <div class="form-group">
                  <label>Max Daily Loss Limit (INR)</label>
                  <input type="number" [(ngModel)]="maxDailyLossCap" placeholder="25000" />
                  <small>Halt trading if daily drawdown exceeds threshold</small>
                </div>
                <div class="form-group">
                  <label>Active Strategy</label>
                  <select [(ngModel)]="selectedStrategyId">
                    @for (strat of automationService.strategies(); track strat.id) {
                      <option [value]="strat.id">{{ strat.name }} ({{ strat.version }})</option>
                    }
                  </select>
                </div>
              </div>

              <div class="action-footer">
                @if (automationService.isAutomationActive()) {
                  <button type="button" class="btn btn-secondary" (click)="handleDisableAutomation()">Disable Automation</button>
                } @else {
                  <button
                    type="button"
                    class="btn btn-primary-accent"
                    [disabled]="!userConsentGiven || automationService.isKillSwitchActive()"
                    (click)="handleEnableAutomation()"
                  >
                    Enable Automated Strategy Trading
                  </button>
                }
              </div>
            </div>

            <!-- Active Strategy Rules -->
            <div class="section-card">
              <h3>Strategy Architecture & Rule Set</h3>
              <div class="strategy-details">
                @for (strat of automationService.strategies(); track strat.id) {
                  @if (strat.id === selectedStrategyId()) {
                    <div class="strat-header">
                      <h4>{{ strat.name }} <span class="version-tag">{{ strat.version }}</span></h4>
                      <p>{{ strat.description }}</p>
                    </div>
                    <div class="rules-list">
                      <strong>Deterministic Logic Chain:</strong>
                      <ul>
                        @for (rule of strat.rules; track rule) {
                          <li><span class="rule-icon">✓</span> {{ rule }}</li>
                        }
                      </ul>
                    </div>
                  }
                }
              </div>
            </div>
          </div>
        }

        <!-- TAB 2: LIVE MARKET GATEWAY & DATA QUALITY -->
        @if (activeTab() === 'GATEWAY') {
          <div class="tab-pane">
            <div class="section-card">
              <div class="card-header-flex">
                <h3>Live Market Gateway Telemetry</h3>
                <span class="provider-badge" [class.badge-ok]="automationService.gatewayState()?.primaryStatus === 'CONNECTED'">
                  Active: {{ automationService.gatewayState()?.activeProvider }}
                </span>
              </div>

              <div class="gateway-metrics-grid">
                <div class="metric-box">
                  <span class="lbl">Primary Stream</span>
                  <strong class="val-green">{{ automationService.gatewayState()?.primaryProvider }}</strong>
                  <small>Status: {{ automationService.gatewayState()?.primaryStatus }}</small>
                </div>
                <div class="metric-box">
                  <span class="lbl">Secondary Backup</span>
                  <strong class="val-amber">{{ automationService.gatewayState()?.secondaryProvider }}</strong>
                  <small>Status: {{ automationService.gatewayState()?.secondaryStatus }}</small>
                </div>
                <div class="metric-box">
                  <span class="lbl">Ticks Processed</span>
                  <strong>{{ automationService.gatewayState()?.totalTicksReceived | number }}</strong>
                  <small>Normalized Market Events</small>
                </div>
                <div class="metric-box">
                  <span class="lbl">Data Quality</span>
                  <strong class="val-green">100% Verified</strong>
                  <small>Stale: {{ automationService.gatewayState()?.staleEventsCount }} | Dupes: 0</small>
                </div>
              </div>

              <div class="failover-control-box">
                <h4>Provider Failover Switcher</h4>
                <p>Manually simulate or switch active feed between primary institutional exchange and backup provider.</p>
                <div class="failover-btns">
                  <button
                    type="button"
                    class="btn btn-sm"
                    [class.btn-active]="automationService.gatewayState()?.activeProvider === 'NSE_INSTITUTIONAL_FEED'"
                    (click)="handleFailover('NSE_INSTITUTIONAL_FEED')"
                  >
                    Use Primary (NSE Feed)
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    [class.btn-active]="automationService.gatewayState()?.activeProvider === 'ALPHA_VANTAGE_STREAM_BACKUP'"
                    (click)="handleFailover('ALPHA_VANTAGE_STREAM_BACKUP')"
                  >
                    Failover to Backup (AlphaVantage)
                  </button>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- TAB 3: ML MODEL REGISTRY -->
        @if (activeTab() === 'ML_REGISTRY') {
          <div class="tab-pane">
            <div class="section-card">
              <h3>Institutional Model Registry</h3>
              <div class="table-scroll-wrap">
                <table class="holdings-preview-table">
                  <thead>
                    <tr>
                      <th>Model ID</th>
                      <th>Version</th>
                      <th>Training Date</th>
                      <th>Accuracy</th>
                      <th>Sharpe Ratio</th>
                      <th>Win Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (model of automationService.models(); track model.modelId) {
                      <tr>
                        <td><strong>{{ model.modelId }}</strong></td>
                        <td><code>{{ model.version }}</code></td>
                        <td><small>{{ model.trainingDate }}</small></td>
                        <td><strong class="text-green">{{ model.metrics.accuracy * 100 | number:'1.1-1' }}%</strong></td>
                        <td>{{ model.metrics.sharpeRatio }}</td>
                        <td>{{ model.metrics.winRate * 100 | number:'1.0-0' }}%</td>
                        <td><span class="status-pill st-complete">{{ model.status }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Live ML Inference Predictor Sandbox -->
            <div class="section-card">
              <h3>Real-Time Inference Sandbox</h3>
              <div class="predict-sandbox">
                <div class="sandbox-inputs">
                  <input type="text" [(ngModel)]="sandboxSymbol" placeholder="Ticker (e.g. TCS, NVDA)" />
                  <button type="button" class="btn btn-primary-accent" [disabled]="isTestingML()" (click)="handleRunInference()">
                    @if (isTestingML()) { Running Inference... } @else { Run ML Predict }
                  </button>
                </div>

                @if (mlResult()) {
                  <div class="inference-result-box">
                    <div class="inf-header">
                      <span>Model: <strong>{{ mlResult()!.modelId }} ({{ mlResult()!.modelVersion }})</strong></span>
                      <span class="latency-tag">Latency: {{ mlResult()!.latencyMs }}ms</span>
                    </div>
                    <div class="inf-prediction-row">
                      <div class="pred-pill" [class.pred-bull]="mlResult()!.prediction === 'BULLISH'" [class.pred-bear]="mlResult()!.prediction === 'BEARISH'">
                        {{ mlResult()!.prediction }}
                      </div>
                      <div class="pred-meta">
                        <span>Confidence: <strong>{{ mlResult()!.confidence * 100 | number:'1.0-0' }}%</strong></span>
                        <span>Target Price: <strong>₹{{ mlResult()!.targetPrice | number:'1.2-2' }}</strong></span>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- TAB 4: PAPER TRADING & AUDIT TRAIL -->
        @if (activeTab() === 'PAPER_SIM') {
          <div class="tab-pane">
            <div class="section-card">
              <h3>Paper Portfolio Performance</h3>
              <div class="paper-portfolio-summary">
                <div class="pp-card">
                  <span class="lbl">Paper Cash USD</span>
                  <strong>&#36;{{ automationService.paperPortfolio()?.cashUSD | number:'1.2-2' }}</strong>
                </div>
                <div class="pp-card">
                  <span class="lbl">Paper Cash INR</span>
                  <strong>₹{{ automationService.paperPortfolio()?.cashINR | number:'1.2-2' }}</strong>
                </div>
                <div class="pp-card">
                  <span class="lbl">Simulated Positions</span>
                  <strong>{{ automationService.paperPortfolio()?.positions?.length || 0 }} Active</strong>
                </div>
              </div>
            </div>

            <div class="section-card">
              <h3>Traceable Audit Log & Automated Executions</h3>
              <div class="table-scroll-wrap">
                <table class="holdings-preview-table">
                  <thead>
                    <tr>
                      <th>Audit ID</th>
                      <th>Event Type</th>
                      <th>Symbol</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (log of automationService.paperAuditTrail(); track log.id) {
                      <tr>
                        <td><code>{{ log.id.slice(0, 14) }}</code></td>
                        <td><span class="audit-event-pill">{{ log.eventType }}</span></td>
                        <td><strong>{{ log.symbol }}</strong></td>
                        <td><span class="status-pill st-complete">{{ log.status }}</span></td>
                        <td><small>{{ log.timestamp | date:'mediumTime' }}</small></td>
                        <td><small>{{ log.details }}</small></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }

      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutomationModalComponent implements OnInit {
  isEmbedded = input<boolean>(false);
  @HostBinding('class.embedded-mode') get embedded() { return this.isEmbedded(); }

  protected readonly automationService = inject(AutomationService);
  protected readonly tradingService = inject(TradingService);

  readonly closeModal = output<void>();

  readonly activeTab = signal<'CONTROL' | 'GATEWAY' | 'ML_REGISTRY' | 'PAPER_SIM'>('CONTROL');
  readonly userConsentGiven = signal<boolean>(false);
  readonly maxPositionCap = signal<number>(50);
  readonly maxDailyLossCap = signal<number>(25000);
  readonly selectedStrategyId = signal<string>('STRAT_MOMENTUM_ALPHA_V1');

  readonly sandboxSymbol = signal<string>('TCS');
  readonly isTestingML = signal<boolean>(false);
  readonly mlResult = signal<MLInferenceResult | null>(null);

  readonly isHalted = computed(() => {
    return this.automationService.isKillSwitchActive() || this.tradingService.killSwitchActive();
  });

  ngOnInit(): void {
    this.automationService.refreshAllData();
    this.tradingService.checkKillSwitch();
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.isEmbedded()) return;
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal.emit();
    }
  }

  async handleEnableAutomation(): Promise<void> {
    try {
      await this.automationService.toggleAutomation(
        true,
        this.userConsentGiven(),
        {
          maxPositionCap: this.maxPositionCap(),
          maxDailyLossCap: this.maxDailyLossCap()
        },
        this.selectedStrategyId()
      );
    } catch (err: any) {
      alert(err.message || 'Failed to enable automation.');
    }
  }

  async handleDisableAutomation(): Promise<void> {
    await this.automationService.toggleAutomation(false, false);
  }

  async handleKillSwitch(): Promise<void> {
    if (confirm('ENGAGE EMERGENCY RISK KILL SWITCH?\nThis will immediately halt all strategy automation and fail-close the engine.')) {
      await this.automationService.triggerAutomationKillSwitch('User Engaged Global Automation Kill Switch', true);
      await this.tradingService.toggleKillSwitch(true, 'User Engaged Global Automation Kill Switch');
      await this.automationService.refreshAllData();
      await this.tradingService.checkKillSwitch();
    }
  }

  async handleResetKillSwitch(): Promise<void> {
    await this.tradingService.toggleKillSwitch(false);
    await this.automationService.triggerAutomationKillSwitch('User Disengaged Kill Switch', false);
    await this.automationService.refreshAllData();
    await this.tradingService.checkKillSwitch();
  }

  async handleFailover(provider: string): Promise<void> {
    await this.automationService.triggerFailover(provider);
  }

  async handleRunInference(): Promise<void> {
    this.isTestingML.set(true);
    const result = await this.automationService.predictML(this.sandboxSymbol());
    this.mlResult.set(result);
    this.isTestingML.set(false);
  }
}
