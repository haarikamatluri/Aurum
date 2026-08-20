import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PortfolioSummaryWidget } from './components/portfolio-summary/portfolio-summary';
import { AiBriefing } from './components/ai-briefing/ai-briefing';
import { MarketPulse } from './components/market-pulse/market-pulse';
import { PerformanceSection } from './components/performance-section/performance-section';
import { AllocationPanel } from './components/allocation-panel/allocation-panel';
import { Contributors } from './components/contributors/contributors';
import { RiskMonitor } from './components/risk-monitor/risk-monitor';
import { MoversWidget } from './components/movers-widget/movers-widget';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    PortfolioSummaryWidget,
    AiBriefing,
    MarketPulse,
    PerformanceSection,
    AllocationPanel,
    Contributors,
    RiskMonitor,
    MoversWidget,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {}
