import { Injectable, inject } from '@angular/core';
import { CapabilityRegistryService, AurumCapability, RiskClassification } from './capability-registry.service';
import { EntityResolverService, ResolvedEntities } from './entity-resolver.service';
import { VoiceContextService } from './voice-context.service';
import { CapabilityDiscoveryService, CapabilityCandidate } from './capability-discovery.service';

export interface ActionNode {
  id: string;
  capabilityId: string;
  name: string;
  parameters: Record<string, any>;
  dependencies: string[];
  status: 'PENDING' | 'RUNNING' | 'WAITING' | 'CONFIRM_REQUIRED' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  riskLevel: RiskClassification;
  confirmationRequired: boolean;
  result?: any;
  error?: string;
}

export interface ActionGraph {
  planId: string;
  rawQuery: string;
  intent: string;
  entities: ResolvedEntities;
  nodes: ActionNode[];
  isCompound: boolean;
  requiresClarification: boolean;
  clarificationMessage?: string;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class CommandPlannerService {
  private readonly registry = inject(CapabilityRegistryService);
  private readonly entityResolver = inject(EntityResolverService);
  private readonly contextService = inject(VoiceContextService);
  private readonly discovery = inject(CapabilityDiscoveryService);

  planCommand(query: string): ActionGraph {
    const raw = query.trim();
    const lower = raw.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ').replace(/\s+/g, ' ');
    const entities = this.entityResolver.resolveEntities(raw);
    const context = this.contextService.getSnapshot();

    const planId = `plan-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`;

    // =========================================================================
    // 0. AMBIGUITY CHECK (Financial Safety Priority)
    // =========================================================================
    if (entities.ambiguityPrompt) {
      return {
        planId,
        rawQuery: raw,
        intent: 'AMBIGUITY_RESOLUTION',
        entities,
        nodes: [],
        isCompound: false,
        requiresClarification: true,
        clarificationMessage: entities.ambiguityPrompt,
        createdAt: Date.now()
      };
    }

    const nodes: ActionNode[] = [];

    // =========================================================================
    // LEVEL 1: LOCAL FAST PATH (< 20ms deterministic control)
    // =========================================================================
    if (/^(stop|shut up|be quiet|silence|cancel|pause|halt|abort|stop speaking)$/i.test(lower)) {
      nodes.push(this.createNode('STOP_SPEAKING', {}));
      return this.wrapPlan(planId, raw, 'VOICE_CONTROL', entities, nodes);
    }

    if (/^(go back|take me back|navigate back|back|return)$/i.test(lower)) {
      nodes.push(this.createNode('NAVIGATE_BACK', {}));
      return this.wrapPlan(planId, raw, 'NAVIGATION', entities, nodes);
    }

    if (/\b(what can you do|how to use|capabilities|voice help)\b/i.test(lower) || lower === 'help') {
      nodes.push(this.createNode('GENERAL_HELP', {}));
      return this.wrapPlan(planId, raw, 'GENERAL_HELP', entities, nodes);
    }

    if (/\b(expand chart|maximize chart|make chart easier to read|make the chart easier to read)\b/i.test(lower)) {
      nodes.push(this.createNode('EXPAND_CHART', {}));
      return this.wrapPlan(planId, raw, 'UI_CONTROL', entities, nodes);
    }

    if (/^(close that|close this|collapse the details|collapse details|hide details|dismiss)\b/i.test(lower)) {
      nodes.push(this.createNode('COLLAPSE_DETAILS', {}));
      return this.wrapPlan(planId, raw, 'UI_CONTROL', entities, nodes);
    }

    // =========================================================================
    // LEVEL 2: COMPOUND ACTION GRAPHS (Parallel / Sequential Multi-Node Chains)
    // =========================================================================

    // Complete Intelligence: "Give me everything about Nvidia", "Show me all information about TCS", "Full intelligence on Apple"
    if (
      /\b(everything about|all information about|everything on|complete intelligence|full intelligence|dossier on|give me everything)\b/i.test(lower) ||
      (/\b(give|show|tell)\s+me\s+everything\b/i.test(lower))
    ) {
      const targetSym = entities.symbol || context.currentSymbol || 'TCS';
      const nIntel = this.createNode('GET_COMPLETE_SECURITY_INTELLIGENCE', { symbol: targetSym });
      nodes.push(nIntel);
      return this.wrapPlan(planId, raw, 'COMPLETE_INTELLIGENCE', entities, nodes, false);
    }

    // Compound A: "Open TCS, check today's movement, find the news causing it, compare it with Infosys, and tell me whether my portfolio is affected."
    if (
      /\b(open|show)\b/i.test(lower) && entities.symbol &&
      /\b(movement|moving|why|dropped|fell)\b/i.test(lower) &&
      /\b(compare)\b/i.test(lower)
    ) {
      const symA = entities.symbol;
      const symB = entities.secondarySymbol || 'INFY';
      const n1 = this.createNode('OPEN_STOCK', { symbol: symA });
      const n2 = this.createNode('GET_STOCK_QUOTE', { symbol: symA }, [n1.id]);
      const n3 = this.createNode('ANALYZE_STOCK_MOVEMENT', { symbol: symA }, [n2.id]);
      const n4 = this.createNode('COMPARE_STOCKS', { symbolA: symA, symbolB: symB }, [n3.id]);
      const n5 = this.createNode('GET_PORTFOLIO_IMPACT', { symbol: symA }, [n4.id]);
      nodes.push(n1, n2, n3, n4, n5);
      return this.wrapPlan(planId, raw, 'MULTI_ACTION_DEEP_ANALYSIS', entities, nodes, true);
    }

    // Compound B: Open stock + Set Timeframe ("Open the chart and show me the last three months", "Show TCS for 3 months")
    if (
      (/\b(open|show|inspect)\b/i.test(lower) && entities.symbol) &&
      entities.timeframe
    ) {
      const nOpen = this.createNode('OPEN_STOCK', { symbol: entities.symbol });
      const nTimeframe = this.createNode('SET_TIMEFRAME', { timeframe: entities.timeframe }, [nOpen.id]);
      nodes.push(nOpen, nTimeframe);
      return this.wrapPlan(planId, raw, 'STOCK_TIMEFRAME_ANALYSIS', entities, nodes, true);
    }

    // Compound C: Find biggest loser and explain why ("Find the biggest loser and explain why")
    if (/\b(find the biggest loser and explain why|why is my biggest loser falling|explain biggest loser)\b/i.test(lower)) {
      const loserSym = context.currentPortfolio?.biggestLoser?.symbol || context.portfolio?.biggestLoser?.symbol || 'TCS';
      const nLoser = this.createNode('GET_BIGGEST_LOSER', {});
      const nAnalysis = this.createNode('ANALYZE_STOCK_MOVEMENT', { symbol: loserSym }, [nLoser.id]);
      nodes.push(nLoser, nAnalysis);
      return this.wrapPlan(planId, raw, 'PORTFOLIO_LOSER_ANALYSIS', entities, nodes, true);
    }

    // Compound D: Open stock + ML prediction ("Show TCS and run the ML prediction")
    if (
      (/\b(open|show)\b/i.test(lower) && entities.symbol) &&
      /\b(ml prediction|run the ml|model prediction)\b/i.test(lower)
    ) {
      const nOpen = this.createNode('OPEN_STOCK', { symbol: entities.symbol });
      const nML = this.createNode('GET_ML_PREDICTION', { symbol: entities.symbol }, [nOpen.id]);
      nodes.push(nOpen, nML);
      return this.wrapPlan(planId, raw, 'STOCK_ML_INSPECTION', entities, nodes, true);
    }

    // Compound E: Open stock + Movement analysis ("Open TCS and tell me why it moved today")
    if (
      (/\b(open|show|pull up)\b/i.test(lower) && entities.symbol) &&
      (/\b(why|news|moving|happened|causing|reason)\b/i.test(lower))
    ) {
      const nOpen = this.createNode('OPEN_STOCK', { symbol: entities.symbol });
      const nQuote = this.createNode('GET_STOCK_QUOTE', { symbol: entities.symbol }, [nOpen.id]);
      const nAnalysis = this.createNode('ANALYZE_STOCK_MOVEMENT', { symbol: entities.symbol }, [nQuote.id]);
      nodes.push(nOpen, nQuote, nAnalysis);
      return this.wrapPlan(planId, raw, 'MULTI_ACTION_RESEARCH', entities, nodes, true);
    }

    // Compound F: Portfolio check + biggest loser ("Check my portfolio and tell me what needs attention")
    if (/\b(check my portfolio|what is happening with my investments|why am i losing money|what needs attention)\b/i.test(lower)) {
      const nSummary = this.createNode('GET_PORTFOLIO_SUMMARY', {});
      const nLoser = this.createNode('GET_BIGGEST_LOSER', {}, [nSummary.id]);
      nodes.push(nSummary, nLoser);
      return this.wrapPlan(planId, raw, 'PORTFOLIO_HEALTH_CHECK', entities, nodes, true);
    }

    // =========================================================================
    // LEVEL 3: STRUCTURED FINANCIAL ACTIONS & CAPABILITY DISCOVERY
    // =========================================================================

    // Financial Safety Gating: Buy / Sell -> PREVIEW_ORDER ticket
    if (entities.side && (entities.symbol || context.currentSymbol)) {
      const sym = entities.symbol || context.currentSymbol || 'TCS';
      const qty = entities.quantity || 1;
      nodes.push(this.createNode('PREVIEW_ORDER', {
        symbol: sym,
        side: entities.side,
        quantity: qty
      }));
      return this.wrapPlan(planId, raw, 'ORDER_OPS', entities, nodes);
    }

    // Dynamic Discovery: Use CapabilityDiscoveryService to rank & find target capability
    const candidate: CapabilityCandidate = this.discovery.discoverCapability(raw);

    // If candidate capability is discovered
    if (candidate && candidate.capability) {
      const cap = candidate.capability;
      const params = candidate.extractedParameters || {};

      // If capability requires symbol and it wasn't extracted, inherit from context
      if (cap.requiredContext?.includes('symbol') && !params['symbol']) {
        params['symbol'] = entities.symbol || context.currentSymbol || 'TCS';
      }

      nodes.push(this.createNode(cap.id, params));
      return this.wrapPlan(planId, raw, cap.category, entities, nodes);
    }

    // Safe Fallback: General research analysis without claiming non-existent operations
    nodes.push(this.createNode('ANALYZE_STOCK_MOVEMENT', { symbol: entities.symbol || context.currentSymbol || 'TCS' }));
    return this.wrapPlan(planId, raw, 'RESEARCH', entities, nodes);
  }

  private createNode(capabilityId: string, parameters: Record<string, any>, dependencies: string[] = []): ActionNode {
    const cap = this.registry.getCapability(capabilityId);
    const confirmationRequired = cap?.confirmationRequired ?? false;
    return {
      id: `node-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
      capabilityId,
      name: cap ? cap.name : capabilityId,
      parameters,
      dependencies,
      status: confirmationRequired ? 'CONFIRM_REQUIRED' : 'PENDING',
      riskLevel: cap?.riskLevel || 'READ_ONLY',
      confirmationRequired
    };
  }

  private wrapPlan(
    planId: string,
    rawQuery: string,
    intent: string,
    entities: ResolvedEntities,
    nodes: ActionNode[],
    isCompound = false
  ): ActionGraph {
    return {
      planId,
      rawQuery,
      intent,
      entities,
      nodes,
      isCompound,
      requiresClarification: false,
      createdAt: Date.now()
    };
  }
}
