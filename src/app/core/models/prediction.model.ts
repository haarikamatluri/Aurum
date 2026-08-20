export interface PredictionOutlook {
  symbol: string;
  horizonDays: number;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
  expectedVolatility: 'Low' | 'Moderate' | 'High';
  confidence: 'Low' | 'Medium' | 'High';
  modelName: string;
  generatedAt: string;
  driverSummary: string[];
}
