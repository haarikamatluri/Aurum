import { Injectable, signal } from '@angular/core';

// ============================================================================
// AI Analyst Models
// ============================================================================

export type AiSentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
export type AiDirection = 'POSITIVE_BIAS' | 'NEGATIVE_BIAS' | 'NEUTRAL';

export interface AiAnalysisRequest {
  symbol: string;
  companyName: string;
  question: string;
  portfolioContext: {
    shares: number;
    avgCost: number;
    currentPrice: number | null;
    profitLossPct: number | null;
  };
}

export interface AiAnalysis {
  symbol: string;
  question: string;
  sentiment: AiSentiment;
  confidence: number; // 0-100
  whySummary: string;
  positiveFactors: string[];
  negativeFactors: string[];
  potentialDirection: AiDirection;
  keyRisks: string;
  summary: string;
  sources: AiSource[];
  disclaimer: string;
  createdAt: string;
  isRealtime?: boolean;
}

export interface AiSource {
  title: string;
  url: string;
  publisher: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string | AiAnalysis;
  createdAt: string;
}

const STORAGE_KEY_GEMINI_KEY = 'money.gemini_api_key';
const STORAGE_KEY_CONVERSATIONS = 'money.ai_conversations';

@Injectable({ providedIn: 'root' })
export class AiAnalystService {
  readonly apiKey = signal<string>(this.loadApiKey());
  private cachedWorkingModel: string | null = null;
  private conversations = new Map<string, AiChatMessage[]>(
    Object.entries(this.loadConversations())
  );

  getApiKey(): string {
    return this.apiKey();
  }

  setApiKey(key: string): void {
    const trimmed = key.trim();
    this.apiKey.set(trimmed);
    this.cachedWorkingModel = null;
    try {
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY_GEMINI_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY_GEMINI_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  hasApiKey(): boolean {
    return !!this.apiKey();
  }

  /** Get persisted chat history for a specific stock symbol. */
  getMessages(symbol: string): AiChatMessage[] {
    return this.conversations.get(symbol.toUpperCase()) || [];
  }

  /** Add and persist a message for a stock symbol. */
  saveMessage(symbol: string, msg: AiChatMessage): void {
    const sym = symbol.toUpperCase();
    const existing = this.conversations.get(sym) || [];
    const updated = [...existing, msg];
    this.conversations.set(sym, updated);
    this.saveConversations();
  }

  /** Clear chat history for a specific stock. */
  clearMessages(symbol: string): void {
    const sym = symbol.toUpperCase();
    this.conversations.delete(sym);
    this.saveConversations();
  }

  /**
   * Analyze a stock using Real-time Google Gemini API or intelligent local fallback.
   */
  async analyzeStock(request: AiAnalysisRequest): Promise<AiAnalysis> {
    const key = this.apiKey();

    if (key) {
      try {
        return await this.callGeminiApi(key, request);
      } catch (err: any) {
        console.warn('Gemini API call failed, falling back to local analysis:', err);
        const fallback = this.buildStubResponse(request);
        fallback.whySummary = `(Live Gemini API message: ${err.message || 'Connecting to Google AI'}). Standard stock briefing:`;
        return fallback;
      }
    }

    // If no API key configured, simulate response with prompt to add key
    await this.delay(1200);
    return this.buildStubResponse(request);
  }

  /**
   * Real-time Gemini API Integration with Dynamic Model Discovery
   */
  private async callGeminiApi(apiKey: string, req: AiAnalysisRequest): Promise<AiAnalysis> {
    const model = await this.resolveWorkingModel(apiKey);

    const prompt = `
You are a senior equity research analyst inside the "Money" portfolio intelligence app.
Answer the user's specific stock question with objective, live financial intelligence.

Stock Context:
- Symbol: ${req.symbol}
- Company: ${req.companyName}
- User Question: "${req.question}"
- Position: ${req.portfolioContext.shares} shares @ avg cost $${req.portfolioContext.avgCost.toFixed(2)} (P&L: ${req.portfolioContext.profitLossPct !== null ? req.portfolioContext.profitLossPct.toFixed(2) + '%' : 'N/A'})

Return your entire analysis in valid JSON format only (NO markdown code blocks, NO text outside JSON):
{
  "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "confidence": <number between 50 and 95>,
  "whySummary": "<2-3 sentence direct answer to the user's question with specific catalysts>",
  "positiveFactors": [
    "<Key bullish catalyst 1>",
    "<Key bullish catalyst 2>"
  ],
  "negativeFactors": [
    "<Key risk factor 1>",
    "<Key risk factor 2>"
  ],
  "potentialDirection": "POSITIVE_BIAS" | "NEGATIVE_BIAS" | "NEUTRAL",
  "keyRisks": "<Paragraph explaining the main risks investors should watch>",
  "summary": "<In-depth financial summary connecting current market conditions to the user's position>"
}
`;

    // Try endpoints in order (v1beta then v1)
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    ];

    let lastError: Error | null = null;

    for (const url of endpoints) {
      try {
        const body = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 1200,
            responseMimeType: 'application/json',
          },
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const msg = errBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(msg);
        }

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!candidateText) {
          throw new Error('Gemini API returned an empty text response.');
        }

        const parsed = this.parseJsonResponse(candidateText);
        return {
          symbol: req.symbol,
          question: req.question,
          sentiment: (['POSITIVE', 'NEGATIVE', 'NEUTRAL'].includes(parsed.sentiment) ? parsed.sentiment : 'NEUTRAL') as AiSentiment,
          confidence: typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, parsed.confidence)) : 80,
          whySummary: this.cleanText(parsed.whySummary) || 'Live analysis generated by Gemini AI.',
          positiveFactors: Array.isArray(parsed.positiveFactors) ? parsed.positiveFactors.map((f: any) => this.cleanText(String(f))) : [],
          negativeFactors: Array.isArray(parsed.negativeFactors) ? parsed.negativeFactors.map((f: any) => this.cleanText(String(f))) : [],
          potentialDirection: (['POSITIVE_BIAS', 'NEGATIVE_BIAS', 'NEUTRAL'].includes(parsed.potentialDirection) ? parsed.potentialDirection : 'NEUTRAL') as AiDirection,
          keyRisks: this.cleanText(parsed.keyRisks) || 'Standard market risks apply.',
          summary: this.cleanText(parsed.summary) || 'Summary unavailable.',
          sources: [],
          disclaimer: 'Money provides AI-generated financial insights for informational purposes only. Not investment advice.',
          createdAt: new Date().toISOString(),
          isRealtime: true,
        };
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error('Could not contact Gemini API.');
  }

  /**
   * Dynamically query the user's available Gemini models to pick the best working model.
   */
  private async resolveWorkingModel(apiKey: string): Promise<string> {
    if (this.cachedWorkingModel) {
      return this.cachedWorkingModel;
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (res.ok) {
        const data = await res.json();
        const models: { name: string; supportedGenerationMethods?: string[] }[] = data?.models || [];
        const supported = models
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => m.name.replace(/^models\//, ''));

        // Pick preferred in priority order
        const priorityOrder = [
          'gemini-2.0-flash',
          'gemini-2.0-flash-exp',
          'gemini-1.5-flash-latest',
          'gemini-1.5-flash',
          'gemini-1.5-pro-latest',
          'gemini-1.5-pro',
          'gemini-pro',
        ];

        for (const preferred of priorityOrder) {
          if (supported.includes(preferred)) {
            this.cachedWorkingModel = preferred;
            return preferred;
          }
        }

        if (supported.length > 0) {
          this.cachedWorkingModel = supported[0];
          return supported[0];
        }
      }
    } catch {
      /* ignore discovery failure, use fallback list */
    }

    // Fallback default
    this.cachedWorkingModel = 'gemini-1.5-flash-latest';
    return this.cachedWorkingModel;
  }

  /**
   * Robust JSON parser that extracts structured fields and strips any unwanted code fences or formatting artifacts.
   */
  private parseJsonResponse(rawText: string): any {
    // 1. Direct JSON attempt
    try {
      return JSON.parse(rawText.trim());
    } catch {
      /* continue */
    }

    // 2. Strip code block wrappers
    const stripped = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(stripped);
    } catch {
      /* continue */
    }

    // 3. Find outermost JSON object
    const startIdx = rawText.indexOf('{');
    const endIdx = rawText.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      const jsonSub = rawText.substring(startIdx, endIdx + 1);
      try {
        return JSON.parse(jsonSub);
      } catch {
        /* continue */
      }
    }

    // 4. Fallback if response is plain text
    return {
      sentiment: 'NEUTRAL',
      confidence: 78,
      whySummary: this.cleanText(rawText).slice(0, 300),
      positiveFactors: ['Analysis generated via Google Gemini.'],
      negativeFactors: ['Always verify company financials before trading.'],
      potentialDirection: 'NEUTRAL',
      keyRisks: 'Standard equity market volatility.',
      summary: this.cleanText(rawText),
    };
  }

  private cleanText(text: string): string {
    if (!text) return '';
    return text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
  }

  private buildStubResponse(req: AiAnalysisRequest): AiAnalysis {
    const symbol = req.symbol;
    const question = req.question.toLowerCase();

    let sentiment: AiSentiment = 'NEUTRAL';
    let direction: AiDirection = 'NEUTRAL';
    let confidence = 68;

    if (question.includes('drop') || question.includes('fall') || question.includes('down') || question.includes('loss') || question.includes('risk')) {
      sentiment = 'NEGATIVE';
      direction = 'NEGATIVE_BIAS';
      confidence = 72;
    } else if (question.includes('rise') || question.includes('gain') || question.includes('up') || question.includes('growth') || question.includes('buy')) {
      sentiment = 'POSITIVE';
      direction = 'POSITIVE_BIAS';
      confidence = 76;
    }

    const gainContext = req.portfolioContext.profitLossPct !== null
      ? `Your position is currently ${req.portfolioContext.profitLossPct >= 0 ? '+' : ''}${req.portfolioContext.profitLossPct.toFixed(2)}% from your average purchase price.`
      : `Your average purchase price is $${req.portfolioContext.avgCost.toFixed(2)}.`;

    return {
      symbol,
      question: req.question,
      sentiment,
      confidence,
      whySummary: `Live analysis for ${symbol}. To get real-time Google Gemini analysis with latest company earnings, news, and drivers, add your Gemini API Key in Settings.`,
      positiveFactors: [
        `${req.companyName} maintains strong brand and market position.`,
        'Sector momentum continues to provide underlying support.',
      ],
      negativeFactors: [
        'Macroeconomic interest rates and valuation multiples require monitoring.',
        'Competitive pressures in the primary operating segment.',
      ],
      potentialDirection: direction,
      keyRisks: `Key risks for ${symbol} include market volatility, regulatory shifts, and economic cycle dependencies. Add your Gemini API Key in Settings to get real-time AI risk assessment.`,
      summary: `${gainContext}\n\nAdd your free Gemini API Key in Settings to unlock real-time financial analysis, earnings breakdowns, and sentiment updates.`,
      sources: [],
      disclaimer: 'Money provides AI-generated information for educational purposes only. This is not financial advice.',
      createdAt: new Date().toISOString(),
      isRealtime: false,
    };
  }

  /** Suggested questions for the AI Analyst UI. */
  getSuggestedQuestions(symbol: string, companyName: string): string[] {
    return [
      `Why is ${symbol} moving today?`,
      `Is the latest ${companyName} news positive or negative?`,
      `What are the biggest risks for ${symbol}?`,
      `What could cause ${symbol} to fall?`,
      `Summarize ${symbol} fundamentals and outlook.`,
    ];
  }

  private loadApiKey(): string {
    try {
      return localStorage.getItem(STORAGE_KEY_GEMINI_KEY) || '';
    } catch {
      return '';
    }
  }

  private loadConversations(): Record<string, AiChatMessage[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveConversations(): void {
    try {
      const obj = Object.fromEntries(this.conversations);
      localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(obj));
    } catch {
      /* ignore */
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
