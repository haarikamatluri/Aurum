import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon/icon';
import { AiChat } from '../../shared/ui/ai-chat/ai-chat';
import { UiStateService } from '../../core/services/ui-state.service';

/** Global, always-available AI Analyst slide-over — opened from the topbar sparkles icon on any page. */
@Component({
  selector: 'app-ai-panel',
  standalone: true,
  imports: [Icon, AiChat, RouterLink],
  template: `
    @if (ui.aiPanelOpen()) {
      <div class="panel-scrim" (click)="ui.toggleAiPanel()"></div>
      <aside class="panel" role="dialog" aria-label="AI Analyst panel">
        <div class="panel-head">
          <span class="panel-head-title"><app-icon name="sparkles" [size]="16" /> AI Analyst</span>
          <div class="panel-head-actions">
            <a routerLink="/ai-analyst" class="btn btn-sm btn-outline" (click)="ui.toggleAiPanel()">Full view</a>
            <button type="button" class="btn btn-icon btn-ghost" (click)="ui.toggleAiPanel()" aria-label="Close AI panel">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
        </div>
        <div class="panel-body">
          <app-ai-chat [compact]="true" [conversationId]="convId()" (conversationIdChange)="onConvChange($event)" />
        </div>
      </aside>
    }
  `,
  styleUrl: './ai-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiPanel {
  protected readonly ui = inject(UiStateService);
  protected readonly convId = signal<string | null>(null);

  onConvChange(id: string): void {
    this.convId.set(id || null);
  }
}
