import { Injectable, inject } from '@angular/core';
import { CapabilityRegistryService, AurumCapability } from './capability-registry.service';
import { EntityResolverService, ResolvedEntities } from './entity-resolver.service';
import { VoiceContextService } from './voice-context.service';

export interface CapabilityCandidate {
  capability: AurumCapability;
  confidence: number;
  extractedParameters: Record<string, any>;
  matchedQuery: string;
  reasoning: string;
  isContextual: boolean;
  isRepetition: boolean;
  secondaryCapability?: AurumCapability;
}

// Common out-of-domain patterns that must never hallucinate an execution
const OUT_OF_DOMAIN_PATTERNS = [
  /\b(book|reserve)\s+(?:me\s+)?(?:a\s+)?(?:flight|hotel|taxi|cab|uber|ticket|train)\b/i,
  /\b(send|compose|write)\s+(?:an?\s+)?(?:email|text|message|sms|whatsapp)\b/i,
  /\btransfer\s+.*(?:friend|account|bank|brother|sister|mom|dad|john|alice)\b/i,
  /\b(change|reset)\s+(?:my\s+)?(?:bank\s+)?password\b/i,
  /\b(order|deliver)\s+(?:a\s+)?(?:pizza|food|groceries|coffee)\b/i,
  /\b(play|stream)\s+(?:a\s+)?(?:movie|song|video|youtube|netflix|spotify)\b/i
];

@Injectable({
  providedIn: 'root'
})
export class CapabilityDiscoveryService {
  private readonly registry = inject(CapabilityRegistryService);
  private readonly entityResolver = inject(EntityResolverService);
  private readonly contextService = inject(VoiceContextService);

  discoverCapability(query: string): CapabilityCandidate {
    const raw = query.trim();
    const lower = raw.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ').replace(/\s+/g, ' ');
    const entities = this.entityResolver.resolveEntities(raw);
    const context = this.contextService.getSnapshot();

    // 0. UNSUPPORTED OUT-OF-DOMAIN GUARD
    // Never hallucinate financial or system capabilities for flight booking, emailing, bank transfers, etc.
    for (const pattern of OUT_OF_DOMAIN_PATTERNS) {
      if (pattern.test(lower)) {
        const unsupportedCap = this.registry.getCapability('UNSUPPORTED_CAPABILITY')!;
        return {
          capability: unsupportedCap,
          confidence: 0.99,
          extractedParameters: { query: raw },
          matchedQuery: raw,
          reasoning: 'Out-of-domain non-financial request detected. Rejecting gracefully without hallucinating.',
          isContextual: false,
          isRepetition: false
        };
      }
    }

    // 1. REPETITION HANDLING ("Do the same thing for Infosys", "Do the same for INFY")
    if (entities.isRepetition && entities.symbol) {
      const prevCapId = context.lastCapability || 'OPEN_STOCK';
      const cap = this.registry.getCapability(prevCapId) || this.registry.getCapability('OPEN_STOCK')!;
      return {
        capability: cap,
        confidence: 0.98,
        extractedParameters: { symbol: entities.symbol },
        matchedQuery: raw,
        reasoning: `Repetition inferred from previous operation "${prevCapId}" targeted at newly resolved entity ${entities.symbol}.`,
        isContextual: true,
        isRepetition: true
      };
    }

    // 2. CONTEXTUAL DESTINATION ("Take me there", "Go there")
    if (/\b(take me there|go there)\b/i.test(lower) && context.currentSymbol) {
      const cap = this.registry.getCapability('OPEN_STOCK')!;
      return {
        capability: cap,
        confidence: 0.95,
        extractedParameters: { symbol: context.currentSymbol },
        matchedQuery: raw,
        reasoning: `Contextual navigation resolved to active symbol ${context.currentSymbol}.`,
        isContextual: true,
        isRepetition: false
      };
    }

    // 3. SEMANTIC SCORING OF ALL REGISTERED CAPABILITIES
    const candidates = this.rankCapabilities(raw, lower, entities, context);

    if (candidates.length > 0 && candidates[0].score >= 4) {
      const top = candidates[0];
      return {
        capability: top.cap,
        confidence: Math.min(0.99, top.score / 20 + 0.4),
        extractedParameters: top.params,
        matchedQuery: raw,
        reasoning: top.reasoning,
        isContextual: entities.isContextual,
        isRepetition: false
      };
    }

    // 4. LOW CONFIDENCE & FAIL-CLOSED SAFETY CHECK
    // If no capability matches with score >= 4, reject or ask for clarification without executing default commands.
    const financialTokens = ['stock', 'share', 'portfolio', 'invest', 'p&l', 'gain', 'loss', 'market', 'chart', 'price', 'alert', 'ml', 'backtest', 'strategy', 'bot', 'trade', 'order', 'nifty', 'sensex', 'nasdaq', 'nyse', 'earnings', 'filings', 'news', 'pe', 'eps', 'revenue', 'report', 'compare', 'vs', 'mover', 'decliner', 'loser', 'winner', 'holding', 'position', 'exposure', 'broker', 'kill switch', 'automation', 'dashboard', 'settings', 'notification'];
    const hasAnyFinancialToken = financialTokens.some((tok) => lower.includes(tok));

    if (!hasAnyFinancialToken) {
      const unsupportedCap = this.registry.getCapability('UNSUPPORTED_CAPABILITY')!;
      return {
        capability: unsupportedCap,
        confidence: 0.99,
        extractedParameters: { query: raw },
        matchedQuery: raw,
        reasoning: 'Out-of-domain request. Safe fail-closed rejection without executing default actions.',
        isContextual: false,
        isRepetition: false
      };
    }

    // Financial query with unclear capability -> Prompt user for clarification
    const needsClarificationCap = this.registry.getCapability('NEEDS_CLARIFICATION')!;
    return {
      capability: needsClarificationCap,
      confidence: 0.50,
      extractedParameters: { query: raw, reason: 'Ambiguous financial query without clear capability match' },
      matchedQuery: raw,
      reasoning: 'Financial query is ambiguous. Asking user for clarification rather than running a default command.',
      isContextual: entities.isContextual,
      isRepetition: false
    };
  }

  private rankCapabilities(
    raw: string,
    lower: string,
    entities: ResolvedEntities,
    context: any
  ): Array<{ cap: AurumCapability; score: number; params: Record<string, any>; reasoning: string }> {
    const all = this.registry.getAllCapabilities();
    const words = lower.split(/\s+/).filter((w) => w.length > 2);
    const results: Array<{ cap: AurumCapability; score: number; params: Record<string, any>; reasoning: string }> = [];

    for (const cap of all) {
      // Don't match UNSUPPORTED_CAPABILITY in normal ranking
      if (cap.id === 'UNSUPPORTED_CAPABILITY') continue;

      let score = 0;
      let matchedReason = '';
      const params: Record<string, any> = {};

      // A. Check exact examples (Weight: +15)
      if (cap.examples) {
        for (const ex of cap.examples) {
          const exLower = ex.toLowerCase();
          if (lower === exLower) {
            score += 18;
            matchedReason = `Exact match with example: "${ex}"`;
            break;
          } else if (lower.includes(exLower) || exLower.includes(lower)) {
            score += 10;
            matchedReason = `High semantic overlap with example: "${ex}"`;
            break;
          }
        }
      }

      // B. Check aliases (Weight: +10)
      if (cap.aliases) {
        for (const al of cap.aliases) {
          const reg = new RegExp(`\\b${al}\\b`, 'i');
          if (reg.test(lower)) {
            score += 12;
            matchedReason = `Matched alias: "${al}"`;
            break;
          }
        }
      }

      // C. Check keywords (Weight: +5)
      if (cap.keywords) {
        for (const kw of cap.keywords) {
          const reg = new RegExp(`\\b${kw}\\b`, 'i');
          if (reg.test(lower)) {
            score += 6;
            if (!matchedReason) matchedReason = `Matched keyword: "${kw}"`;
          }
        }
      }

      // D. Token match in name or description (Weight: +2)
      for (const w of words) {
        if (cap.name.toLowerCase().includes(w)) score += 3;
        if (cap.description.toLowerCase().includes(w)) score += 1;
      }

      // E. Parameter Extraction & Affinity
      const effectiveSymbol = entities.symbol || (cap.supportsContextInheritance ? context.currentSymbol : undefined);

      if (cap.id === 'OPEN_STOCK' || cap.id === 'GET_STOCK_QUOTE' || cap.id === 'ANALYZE_STOCK_MOVEMENT' || cap.id === 'GET_ML_PREDICTION' || cap.id === 'RUN_BACKTEST') {
        if (effectiveSymbol) {
          params['symbol'] = effectiveSymbol;
          score += 4;
        }
      }

      if (cap.id === 'COMPARE_STOCKS') {
        const symA = entities.symbol || context.currentSymbol || 'TCS';
        const symB = entities.secondarySymbol || (symA === 'TCS' ? 'INFY' : 'NVDA');
        params['symbolA'] = symA;
        params['symbolB'] = symB;
        if (entities.secondarySymbol) score += 8;
      }

      if (cap.id === 'SET_TIMEFRAME' && entities.timeframe) {
        params['timeframe'] = entities.timeframe;
        score += 12;
      }

      if (cap.id === 'SET_MARKET_FILTER' && entities.market) {
        params['market'] = entities.market;
        score += 12;
      }

      if (cap.id === 'SWITCH_TAB' && entities.tab) {
        params['tab'] = entities.tab;
        score += 12;
      }

      if (cap.id === 'PREVIEW_ORDER') {
        if (entities.side) {
          params['side'] = entities.side;
          params['symbol'] = effectiveSymbol || 'TCS';
          params['quantity'] = entities.quantity || 1;
          score += 14;
        }
      }

      if (cap.id === 'SET_PRICE_ALERT') {
        if (entities.price) {
          params['price'] = entities.price;
          params['symbol'] = effectiveSymbol || 'NVDA';
          score += 8;
        }
      }

      if (cap.id === 'TOGGLE_KILL_SWITCH') {
        if (/\b(halt|kill|stop trading)\b/i.test(lower)) {
          params['active'] = true;
          score += 10;
        } else if (/\b(resume|disengage|clear|turn off kill switch)\b/i.test(lower)) {
          params['active'] = false;
          score += 10;
        }
      }

      if (score > 0) {
        results.push({ cap, score, params, reasoning: matchedReason || `Semantic affinity score: ${score}` });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}
