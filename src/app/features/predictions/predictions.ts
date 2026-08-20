import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { forkJoin } from 'rxjs';
import { PortfolioService } from '../../core/services/portfolio.service';
import { PredictionService } from '../../core/services/prediction.service';
import { PredictionOutlook } from '../../core/models/prediction.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../core/models/common.model';
import { PredictionCard } from '../../shared/ui/prediction-card/prediction-card';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { Icon } from '../../shared/ui/icon/icon';

const HORIZONS = [5, 10, 30];

@Component({
  selector: 'app-predictions-page',
  standalone: true,
  imports: [PredictionCard, Skeleton, ErrorState, Icon],
  templateUrl: './predictions.html',
  styleUrl: './predictions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PredictionsPage {
  private readonly portfolioService = inject(PortfolioService);
  private readonly predictionService = inject(PredictionService);

  protected readonly horizons = HORIZONS;
  protected readonly horizon = signal(5);
  protected readonly resource = signal<Resource<PredictionOutlook[]>>(resourceLoading());

  constructor() {
    effect(() => {
      // Track only `horizon`; load() reads+writes `resource`, which must stay untracked
      // here or the write would re-trigger this same effect (infinite loop).
      const horizon = this.horizon();
      untracked(() => this.load(horizon));
    });
  }

  load(horizon: number = this.horizon()): void {
    this.resource.set(resourceLoading(this.resource().data));
    this.portfolioService.getPositions().subscribe({
      next: (positions) => {
        const symbols = positions.slice(0, 8).map((p) => p.symbol);
        forkJoin(symbols.map((s) => this.predictionService.getOutlook(s, horizon))).subscribe({
          next: (outlooks) => this.resource.set(resourceSuccess(outlooks)),
          error: () => this.resource.set(resourceError('Unable to load model estimates.')),
        });
      },
      error: () => this.resource.set(resourceError('Unable to load your portfolio.')),
    });
  }
}
