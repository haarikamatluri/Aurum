import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ChatMessage } from '../../../core/models/ai.model';
import { Icon } from '../icon/icon';
import { AiTag } from '../ai-tag/ai-tag';
import { StockMiniCard } from '../stock-mini-card/stock-mini-card';
import { SignedCurrencyPipe } from '../../pipes/signed-currency.pipe';
import { SignedPercentPipe } from '../../pipes/signed-percent.pipe';

/** Renders a single chat bubble — plain text for user turns, fully structured for AI turns. */
@Component({
  selector: 'app-ai-message',
  standalone: true,
  imports: [Icon, AiTag, StockMiniCard, SignedCurrencyPipe, SignedPercentPipe],
  template: `
    <div class="msg" [class.user]="message().role === 'user'">
      @if (message().role === 'assistant') {
        <div class="avatar assistant"><app-icon name="sparkles" [size]="14" /></div>
      }

      <div class="bubble">
        <p class="msg-text">{{ message().text }}</p>

        @if (message().interpretation) {
          <div class="block interpretation">
            <app-ai-tag kind="interpretation" />
            <p>{{ message().interpretation }}</p>
          </div>
        }

        @if (message().facts?.length || message().calculations?.length || message().modelSignals?.length) {
          <div class="data-rows">
            @for (f of message().facts; track f.label) {
              <div class="data-row">
                <app-ai-tag kind="fact" />
                <span class="data-label">{{ f.label }}</span>
                <span class="data-value num">{{ f.value }}</span>
              </div>
            }
            @for (c of message().calculations; track c.label) {
              <div class="data-row">
                <app-ai-tag kind="calculation" />
                <span class="data-label">{{ c.label }}</span>
                <span class="data-value num">{{ c.value }}</span>
              </div>
            }
            @for (m of message().modelSignals; track m.label) {
              <div class="data-row">
                <app-ai-tag kind="model" />
                <span class="data-label">{{ m.label }}</span>
                <span class="data-value num">{{ m.value }}</span>
              </div>
            }
          </div>
        }

        @if (message().stockCards?.length) {
          <div class="card-row">
            @for (card of message().stockCards; track card.symbol) {
              <app-stock-mini-card [data]="card" />
            }
          </div>
        }

        @if (message().portfolioImpact; as impact) {
          <div class="impact-card">
            <span class="impact-label">Portfolio impact</span>
            <span class="impact-value" [class.text-positive]="impact.impactAbs >= 0" [class.text-negative]="impact.impactAbs < 0">
              {{ impact.impactAbs | signedCurrency }} ({{ impact.impactPct | signedPercent }})
            </span>
            <span class="impact-note">{{ impact.note }}</span>
          </div>
        }

        @if (message().actions?.length) {
          <div class="action-row">
            @for (action of message().actions; track action.label) {
              <button type="button" class="btn btn-sm btn-outline" (click)="handleAction(action)">
                {{ action.label }} <app-icon name="arrow-right" [size]="12" />
              </button>
            }
          </div>
        }

        @if (message().sources?.length) {
          <div class="sources">
            <button type="button" class="sources-toggle" (click)="sourcesOpen.set(!sourcesOpen())">
              <app-icon name="external-link" [size]="11" /> {{ sourcesOpen() ? 'Hide sources' : 'View sources & data' }}
            </button>
            @if (sourcesOpen()) {
              <ul class="sources-list">
                @for (s of message().sources; track s.label) {
                  <li><strong>{{ s.label }}</strong> — {{ s.detail }}</li>
                }
              </ul>
            }
          </div>
        }

        @if (message().role === 'assistant' && !message().isStreaming) {
          <div class="msg-actions">
            <button type="button" class="icon-btn" (click)="copy()" title="Copy" aria-label="Copy message">
              <app-icon name="copy" [size]="13" />
            </button>
            <button type="button" class="icon-btn" (click)="regenerate.emit()" title="Regenerate" aria-label="Regenerate response">
              <app-icon name="rotate-ccw" [size]="13" />
            </button>
          </div>
        }

        @if (message().suggestedFollowUps?.length) {
          <div class="followups">
            @for (q of message().suggestedFollowUps; track q) {
              <button type="button" class="followup-chip" (click)="followUpClick.emit(q)">{{ q }}</button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './ai-message.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiMessage {
  readonly message = input.required<ChatMessage>();
  readonly followUpClick = output<string>();
  readonly regenerate = output<void>();

  private readonly router = inject(Router);
  protected readonly sourcesOpen = signal(false);

  copy(): void {
    navigator.clipboard?.writeText(this.message().text).catch(() => void 0);
  }

  handleAction(action: { kind: 'navigate' | 'ask'; payload: string }): void {
    if (action.kind === 'navigate') {
      this.router.navigateByUrl(action.payload);
    } else {
      this.followUpClick.emit(action.payload);
    }
  }
}
