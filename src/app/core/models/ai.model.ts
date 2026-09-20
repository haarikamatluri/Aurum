export type AiMode = 'market' | 'portfolio' | 'stock' | 'risk' | 'scenario';

export const AI_MODE_LABELS: Record<AiMode, string> = {
  market: 'Market Copilot',
  portfolio: 'Portfolio Analyst',
  stock: 'Stock Analyst',
  risk: 'Risk Analyst',
  scenario: 'Scenario Analyst',
};

export interface ChatRequest {
  conversationId?: string;
  message: string;
  mode: AiMode;
  symbol?: string;
}

/** A verifiable data point pulled directly from a source (no interpretation). */
export interface Fact {
  label: string;
  value: string;
}

/** A derived value computed from portfolio/market data. */
export interface Calculation {
  label: string;
  value: string;
  formula?: string;
}

/** Output of a predictive/statistical model, always probabilistic and labeled as an estimate. */
export interface ModelSignal {
  label: string;
  value: string;
  confidence?: 'Low' | 'Medium' | 'High';
}

export interface Source {
  label: string;
  detail: string;
}

export interface ChatAction {
  label: string;
  kind: 'navigate' | 'ask';
  payload: string;
}

/** Structured, embeddable UI content a chat message can carry. */
export interface StockCardData {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  portfolioWeightPct?: number;
  modelProbabilityPct?: number;
}

export interface PortfolioImpactCardData {
  impactAbs: number;
  impactPct: number;
  note: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  interpretation?: string;
  facts?: Fact[];
  calculations?: Calculation[];
  modelSignals?: ModelSignal[];
  sources?: Source[];
  stockCards?: StockCardData[];
  portfolioImpact?: PortfolioImpactCardData;
  actions?: ChatAction[];
  suggestedFollowUps?: string[];
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  mode: AiMode;
  createdAt: string;
  messages: ChatMessage[];
}

export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
}

export interface AiInsight {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  dismissed: boolean;
}
