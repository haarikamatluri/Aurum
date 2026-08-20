import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RiskService } from '../../core/services/risk.service';
import { CorrelationMatrix, RiskFlag, RiskScoreBreakdown, StressTestResult } from '../../core/models/risk.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../core/models/common.model';
import { RiskMeter } from '../../shared/ui/risk-meter/risk-meter';
import { Icon } from '../../shared/ui/icon/icon';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { forkJoin } from 'rxjs';

interface RiskData {
  score: RiskScoreBreakdown;
  flags: RiskFlag[];
  correlation: CorrelationMatrix;
  stress: StressTestResult[];
}

function correlationColor(v: number): string {
  // -1..1 -> negative (blue-ish) .. neutral (surface) .. positive (accent)
  if (v >= 0.75) return 'corr-9';
  if (v >= 0.5) return 'corr-7';
  if (v >= 0.25) return 'corr-5';
  if (v >= 0) return 'corr-3';
  if (v >= -0.25) return 'corr-n3';
  return 'corr-n5';
}

@Component({
  selector: 'app-risk-page',
  standalone: true,
  imports: [RiskMeter, Icon, Skeleton, ErrorState, TooltipDirective],
  templateUrl: './risk.html',
  styleUrl: './risk.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskPage implements OnInit {
  private readonly riskService = inject(RiskService);
  protected readonly resource = signal<Resource<RiskData>>(resourceLoading());

  protected readonly maxStressImpact = computed(() => {
    const stress = this.resource().data?.stress ?? [];
    return Math.max(...stress.map((s) => Math.abs(s.portfolioImpactPct)), 1);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.resource.set(resourceLoading(this.resource().data));
    forkJoin({
      score: this.riskService.getRiskScore(),
      flags: this.riskService.getRiskFlags(),
      correlation: this.riskService.getCorrelationMatrix(),
      stress: this.riskService.getStressTests(),
    }).subscribe({
      next: (data) => this.resource.set(resourceSuccess(data)),
      error: () => this.resource.set(resourceError('Unable to load risk analytics.')),
    });
  }

  cellFor(matrix: CorrelationMatrix, a: string, b: string): number {
    return matrix.cells.find((c) => c.symbolA === a && c.symbolB === b)?.correlation ?? 0;
  }

  cellClass(v: number): string {
    return correlationColor(v);
  }

  abs(n: number): number {
    return Math.abs(n);
  }
}
