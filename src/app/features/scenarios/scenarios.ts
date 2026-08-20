import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ScenarioService } from '../../core/services/scenario.service';
import { StockService } from '../../core/services/stock.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { ScenarioInput, ScenarioResult } from '../../core/models/scenario.model';
import { Icon } from '../../shared/ui/icon/icon';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';

@Component({
  selector: 'app-scenarios-page',
  standalone: true,
  imports: [ReactiveFormsModule, Icon, Skeleton],
  templateUrl: './scenarios.html',
  styleUrl: './scenarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScenariosPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly scenarioService = inject(ScenarioService);
  private readonly stockService = inject(StockService);
  private readonly portfolioService = inject(PortfolioService);

  protected readonly presets = this.scenarioService.getPresets();
  protected readonly heldSymbols = signal<string[]>([]);
  protected readonly result = signal<ScenarioResult | null>(null);
  protected readonly running = signal(false);
  protected readonly activePreset = signal<string>('custom');

  protected readonly form = this.fb.nonNullable.group({
    symbol: ['NVDA'],
    priceChangePct: [-15],
    otherHoldings: ['unchanged' as ScenarioInput['otherHoldings']],
    marketCondition: ['custom' as ScenarioInput['marketCondition']],
  });

  private sub: Subscription | null = null;

  ngOnInit(): void {
    this.portfolioService.getPositions().subscribe((positions) => {
      this.heldSymbols.set(positions.map((p) => p.symbol));
    });

    this.sub = this.form.valueChanges.subscribe(() => this.run());
    this.run();
  }

  applyPreset(presetId: string): void {
    const preset = this.presets.find((p) => p.id === presetId);
    if (!preset) return;
    this.activePreset.set(presetId);
    this.form.patchValue({ ...preset.input }, { emitEvent: false });
    this.run();
  }

  onManualChange(): void {
    this.activePreset.set('custom');
  }

  run(): void {
    const raw = this.form.getRawValue();
    this.running.set(true);
    this.scenarioService.runScenario(raw).subscribe((res) => {
      this.result.set(res);
      this.running.set(false);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
