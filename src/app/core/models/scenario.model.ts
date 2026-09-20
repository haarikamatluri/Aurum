export interface ScenarioInput {
  symbol: string;
  priceChangePct: number;
  otherHoldings: 'unchanged' | 'proportional';
  marketCondition: 'custom' | 'correction' | 'crash' | 'sectorSelloff' | 'rally';
}

export interface ScenarioPreset {
  id: string;
  label: string;
  description: string;
  input: Partial<ScenarioInput>;
}

export interface ScenarioResult {
  estimatedPortfolioImpactPct: number;
  estimatedPortfolioImpactAbs: number;
  newPortfolioValue: number;
  affectedSymbolNewWeightPct: number;
  estimatedDrawdownPct: number;
  worstPositionSymbol: string;
  worstPositionImpactPct: number;
}
