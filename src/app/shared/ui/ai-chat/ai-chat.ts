import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AI_MODE_LABELS, AiMode } from '../../../core/models/ai.model';
import { AiAnalystService, SUGGESTED_QUESTIONS } from '../../../core/services/ai-analyst.service';
import { Icon } from '../icon/icon';
import { AiMessage } from './ai-message';

const MODES: AiMode[] = ['portfolio', 'market', 'stock', 'risk', 'scenario'];

/**
 * Core AI Analyst chat surface — shared by the full /ai-analyst page and the dashboard
 * slide-over panel (via the `compact` input, which trims chrome for a narrower layout).
 */
@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [FormsModule, Icon, AiMessage],
  template: `
    <div class="ai-chat" [class.compact]="compact()">
      <div class="chat-toolbar">
        <div class="mode-select">
          @for (m of modes; track m) {
            <button type="button" class="mode-pill" [class.active]="mode() === m" (click)="mode.set(m)">
              {{ modeLabels[m] }}
            </button>
          }
        </div>
        <button type="button" class="btn btn-sm btn-outline" (click)="startNewChat()">
          <app-icon name="plus" [size]="13" /> New Chat
        </button>
      </div>

      <div class="chat-scroll" #scrollArea>
        @if (!messages().length) {
          <div class="welcome">
            <div class="welcome-icon"><app-icon name="sparkles" [size]="26" /></div>
            <h2>AI Analyst</h2>
            <p>Your personal market intelligence assistant — ask about your portfolio, a stock, risk, or the market.</p>

            <div class="prompt-preview" (click)="draft.set(quickPrompt); send()">
              {{ quickPrompt }} <app-icon name="arrow-right" [size]="14" />
            </div>

            <div class="suggestions">
              <span class="suggestions-label">Suggested questions</span>
              <div class="chip-grid">
                @for (q of suggestedQuestions(); track q) {
                  <button type="button" class="suggestion-chip" (click)="send(q)">{{ q }}</button>
                }
              </div>
            </div>
          </div>
        } @else {
          <div class="message-list">
            @for (msg of messages(); track msg.id) {
              <app-ai-message [message]="msg" (followUpClick)="send($event)" (regenerate)="regenerateLast()" />
            }
            @if (sending()) {
              <div class="typing-row">
                <div class="typing-avatar"><app-icon name="sparkles" [size]="13" /></div>
                <div class="typing-dots"><span></span><span></span><span></span></div>
              </div>
            }
          </div>
        }
      </div>

      <div class="composer">
        <input
          class="input composer-input"
          type="text"
          placeholder="Ask anything about your portfolio or market..."
          [(ngModel)]="draft"
          (keydown.enter)="send()"
          [attr.aria-label]="'Ask the AI analyst'"
        />
        <button type="button" class="btn btn-primary btn-icon" (click)="send()" [disabled]="!draft().trim() || sending()" aria-label="Send message">
          <app-icon name="send" [size]="15" />
        </button>
      </div>
    </div>
  `,
  styleUrl: './ai-chat.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiChat {
  private readonly aiService = inject(AiAnalystService);

  readonly compact = input<boolean>(false);
  readonly conversationId = input<string | null>(null);
  readonly conversationIdChange = output<string>();
  readonly contextSymbol = input<string | undefined>(undefined);

  protected readonly modes = MODES;
  protected readonly modeLabels = AI_MODE_LABELS;
  protected readonly mode = signal<AiMode>('portfolio');
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly quickPrompt = "What's happening in the market today?";

  private readonly scrollArea = viewChild<ElementRef<HTMLDivElement>>('scrollArea');

  protected readonly suggestedQuestions = computed(() => SUGGESTED_QUESTIONS[this.mode()]);

  protected readonly messages = computed(() => {
    const id = this.conversationId();
    if (!id) return [];
    return this.aiService.conversations().find((c) => c.id === id)?.messages ?? [];
  });

  constructor() {
    effect(() => {
      // Re-run whenever messages length changes to keep the view pinned to the latest turn.
      this.messages();
      this.sending();
      queueMicrotask(() => this.scrollToBottom());
    });
  }

  private scrollToBottom(): void {
    const el = this.scrollArea()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  startNewChat(): void {
    this.conversationIdChange.emit('');
    this.draft.set('');
  }

  send(text?: string): void {
    const value = (text ?? this.draft()).trim();
    if (!value) return;
    this.draft.set('');

    let convId = this.conversationId();
    if (!convId) {
      const conv = this.aiService.startConversation(this.mode());
      convId = conv.id;
      this.conversationIdChange.emit(convId);
    }

    this.sending.set(true);
    this.aiService.sendMessage(convId, value, this.mode(), this.contextSymbol()).subscribe(() => this.sending.set(false));
  }

  regenerateLast(): void {
    const msgs = this.messages();
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (lastUser) this.send(lastUser.text);
  }
}
