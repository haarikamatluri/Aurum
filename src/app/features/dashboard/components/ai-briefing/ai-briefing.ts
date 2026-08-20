import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/ui/icon/icon';
import { AiTag } from '../../../../shared/ui/ai-tag/ai-tag';
import { UiStateService } from '../../../../core/services/ui-state.service';

/**
 * Prominent "what happened / why / what to watch" AI summary. Mock content today; will
 * bind to POST /api/ai/chat (mode=portfolio) once the orchestrator exists.
 */
@Component({
  selector: 'app-ai-briefing',
  standalone: true,
  imports: [RouterLink, Icon, AiTag],
  template: `
    <div class="card card-pad briefing">
      <div class="briefing-head">
        <span class="panel-title"><app-icon name="sparkles" [size]="16" /> AI Portfolio Briefing</span>
        <span class="badge badge-accent">3 items need attention</span>
      </div>

      <div class="briefing-row">
        <app-ai-tag kind="fact" />
        <p>Your portfolio is outperforming the S&amp;P 500 by <strong class="text-positive">+0.31%</strong> today.</p>
      </div>
      <div class="briefing-row">
        <app-ai-tag kind="fact" />
        <p>Technology stocks are driving most of today's movement. <strong>NVDA</strong> and <strong>MSFT</strong> are your largest positive contributors.</p>
      </div>
      <div class="briefing-row">
        <app-ai-tag kind="interpretation" />
        <p>Technology exposure has increased to <strong class="text-warning">54%</strong>, above your 42% target allocation — this is worth monitoring as a concentration risk.</p>
      </div>

      <div class="briefing-actions">
        <a routerLink="/ai-analyst" class="link-cta">View Full Analysis <app-icon name="arrow-right" [size]="13" /></a>
        <button type="button" class="btn btn-sm btn-primary" (click)="askAi()">
          <app-icon name="sparkles" [size]="13" /> Ask AI
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .briefing { display: flex; flex-direction: column; gap: var(--space-3); background: linear-gradient(180deg, var(--accent-bg), transparent 60%), var(--surface); border-color: var(--accent-border); }
      .briefing-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-1); }
      .briefing-row { display: flex; align-items: flex-start; gap: var(--space-3); }
      .briefing-row p { font-size: 13px; line-height: 1.6; color: var(--text-secondary); }
      .briefing-row strong { color: var(--text-primary); }
      .briefing-actions { display: flex; align-items: center; justify-content: space-between; margin-top: var(--space-2); padding-top: var(--space-3); border-top: 1px solid var(--border); }
      .link-cta { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: var(--accent); }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiBriefing {
  private readonly ui = inject(UiStateService);

  askAi(): void {
    this.ui.aiPanelOpen.set(true);
  }
}
