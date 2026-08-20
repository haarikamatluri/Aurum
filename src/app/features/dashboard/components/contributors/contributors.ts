import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortfolioService } from '../../../../core/services/portfolio.service';
import { Contributor } from '../../../../core/models/portfolio.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../../../core/models/common.model';
import { ChangeBadge } from '../../../../shared/ui/change-badge/change-badge';
import { Skeleton } from '../../../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../../../shared/ui/error-state/error-state';
import { SignedCurrencyPipe } from '../../../../shared/pipes/signed-currency.pipe';

interface ContributorsData {
  top: Contributor[];
  bottom: Contributor[];
}

/** Top Contributors / Top Detractors, ranked by today's dollar contribution. Click-through to /stocks/:symbol. */
@Component({
  selector: 'app-contributors',
  standalone: true,
  imports: [RouterLink, ChangeBadge, Skeleton, ErrorState, SignedCurrencyPipe],
  template: `
    <div class="card card-pad">
      <div class="panel-header">
        <span class="panel-title">Portfolio Contributors</span>
        <span class="panel-subtitle">Today's dollar impact</span>
      </div>

      @switch (resource().status) {
        @case ('loading') {
          <div class="contrib-cols">
            @for (col of [1,2]; track col) {
              <div class="contrib-col">
                @for (i of [1,2,3]; track i) { <app-skeleton height="34px" /> }
              </div>
            }
          </div>
        }
        @case ('error') {
          <app-error-state [message]="resource().error!" (retry)="load()" />
        }
        @case ('success') {
          <div class="contrib-cols">
            <div class="contrib-col">
              <span class="col-label positive">Top Contributors</span>
              @for (c of resource().data!.top; track c.symbol) {
                <a [routerLink]="['/stocks', c.symbol]" class="contrib-row">
                  <span class="sym">{{ c.symbol }}</span>
                  <span class="amt num">{{ c.contributionAbs | signedCurrency: 0 }}</span>
                  <app-change-badge [value]="c.contributionPct" size="sm" />
                </a>
              }
            </div>
            <div class="contrib-col">
              <span class="col-label negative">Top Detractors</span>
              @for (c of resource().data!.bottom; track c.symbol) {
                <a [routerLink]="['/stocks', c.symbol]" class="contrib-row">
                  <span class="sym">{{ c.symbol }}</span>
                  <span class="amt num">{{ c.contributionAbs | signedCurrency: 0 }}</span>
                  <app-change-badge [value]="c.contributionPct" size="sm" />
                </a>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .contrib-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-5); }
      .contrib-col { display: flex; flex-direction: column; gap: 2px; }
      .col-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: var(--space-2); }
      .col-label.positive { color: var(--positive); }
      .col-label.negative { color: var(--negative); }
      .contrib-row {
        display: flex; align-items: center; gap: var(--space-2);
        padding: 8px 4px; border-radius: var(--radius-sm);
        transition: background var(--duration-fast) var(--ease-standard);
      }
      .contrib-row:hover { background: var(--surface-hover); }
      .sym { font-weight: 700; font-size: 12.5px; width: 48px; flex: none; }
      .amt { flex: 1; font-size: 12.5px; color: var(--text-secondary); }
      @media (max-width: 560px) {
        .contrib-cols { grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contributors implements OnInit {
  private readonly portfolioService = inject(PortfolioService);
  protected readonly resource = signal<Resource<ContributorsData>>(resourceLoading());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.resource.set(resourceLoading(this.resource().data));
    this.portfolioService.getContributors().subscribe({
      next: (data) => this.resource.set(resourceSuccess(data)),
      error: () => this.resource.set(resourceError('Unable to load contributors.')),
    });
  }
}
