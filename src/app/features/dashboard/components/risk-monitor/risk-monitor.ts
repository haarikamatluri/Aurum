import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RiskService } from '../../../../core/services/risk.service';
import { RiskFlag, RiskScoreBreakdown } from '../../../../core/models/risk.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../../../core/models/common.model';
import { RiskMeter } from '../../../../shared/ui/risk-meter/risk-meter';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Skeleton } from '../../../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../../../shared/ui/error-state/error-state';
import { forkJoin } from 'rxjs';

interface RiskDashboardData {
  score: RiskScoreBreakdown;
  flags: RiskFlag[];
}

/** Compact risk overview for the dashboard: key meters + top flags, links to /risk for full detail. */
@Component({
  selector: 'app-risk-monitor',
  standalone: true,
  imports: [RouterLink, RiskMeter, Icon, Skeleton, ErrorState],
  template: `
    <div class="card card-pad">
      <div class="panel-header">
        <span class="panel-title">Portfolio Risk</span>
        <a routerLink="/risk" class="link-cta">Full analysis <app-icon name="arrow-right" [size]="12" /></a>
      </div>

      @switch (resource().status) {
        @case ('loading') {
          <div class="meter-grid">
            @for (i of [1,2,3]; track i) { <app-skeleton height="42px" /> }
          </div>
        }
        @case ('error') {
          <app-error-state [message]="resource().error!" (retry)="load()" />
        }
        @case ('success') {
          <div class="meter-grid">
            <app-risk-meter label="Overall Risk" [value]="resource().data!.score.overall" hint="Composite of all risk factors below." />
            <app-risk-meter label="Concentration" [value]="resource().data!.score.concentration" hint="How much of your portfolio sits in a small number of positions." />
            <app-risk-meter label="Sector Exposure" [value]="resource().data!.score.sectorExposure" hint="Deviation from a diversified sector mix." />
          </div>

          <div class="flags">
            @for (f of resource().data!.flags.slice(0, 3); track f.id) {
              <div class="flag" [class]="'sev-' + f.severity">
                <app-icon [name]="f.severity === 'success' ? 'check-circle' : 'alert-triangle'" [size]="14" />
                <span>{{ f.message }}</span>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .link-cta { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: var(--accent); white-space: nowrap; }
      .meter-grid { display: flex; flex-direction: column; gap: var(--space-4); margin-bottom: var(--space-4); }
      .flags { display: flex; flex-direction: column; gap: var(--space-2); padding-top: var(--space-3); border-top: 1px solid var(--border); }
      .flag { display: flex; align-items: flex-start; gap: var(--space-2); font-size: 12px; line-height: 1.5; }
      .flag.sev-warning { color: var(--warning); }
      .flag.sev-critical { color: var(--negative); }
      .flag.sev-success { color: var(--positive); }
      .flag.sev-info { color: var(--text-secondary); }
      .flag span { color: var(--text-secondary); }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskMonitor implements OnInit {
  private readonly riskService = inject(RiskService);
  protected readonly resource = signal<Resource<RiskDashboardData>>(resourceLoading());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.resource.set(resourceLoading(this.resource().data));
    forkJoin({ score: this.riskService.getRiskScore(), flags: this.riskService.getRiskFlags() }).subscribe({
      next: (data) => this.resource.set(resourceSuccess(data)),
      error: () => this.resource.set(resourceError('Unable to load risk data.')),
    });
  }
}
