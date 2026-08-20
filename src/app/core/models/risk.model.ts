import { Severity } from './common.model';

export interface RiskScoreBreakdown {
  overall: number;
  concentration: number;
  volatility: number;
  sectorExposure: number;
  correlation: number;
  drawdown: number;
  beta: number;
  maxDrawdownPct: number;
}

export interface RiskFlag {
  id: string;
  severity: Severity;
  message: string;
}

export interface CorrelationCell {
  symbolA: string;
  symbolB: string;
  correlation: number;
}

export interface CorrelationMatrix {
  symbols: string[];
  cells: CorrelationCell[];
}

export interface StressTestResult {
  scenario: string;
  portfolioImpactPct: number;
  portfolioImpactAbs: number;
}
