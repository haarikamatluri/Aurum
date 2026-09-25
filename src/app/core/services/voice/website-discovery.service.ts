import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CapabilityRegistryService, AurumCapability } from './capability-registry.service';

export interface WebsiteCapabilityNode {
  name: string;
  category: string;
  route?: string;
  capabilities: AurumCapability[];
  children?: WebsiteCapabilityNode[];
}

export interface WebsiteDiscoveryReport {
  timestamp: string;
  totalRoutes: number;
  routes: Array<{ path: string; title?: string }>;
  capabilityTree: WebsiteCapabilityNode[];
  coverageStats: {
    totalCapabilities: number;
    financialSafetyGatedCount: number;
    readOnlyCount: number;
    uiControlCount: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class WebsiteCapabilityDiscoveryService {
  private readonly router = inject(Router);
  private readonly registry = inject(CapabilityRegistryService);

  discoverApplicationCapabilities(): WebsiteDiscoveryReport {
    const configRoutes = this.router.config;
    const flattenedRoutes: Array<{ path: string; title?: string }> = [];

    const traverseRoutes = (rList: any[], prefix = '') => {
      for (const r of rList) {
        const fullPath = (prefix ? `${prefix}/${r.path}` : r.path).replace(/\/+/g, '/');
        flattenedRoutes.push({
          path: fullPath || '/',
          title: typeof r.title === 'string' ? r.title : undefined
        });
        if (r.children) {
          traverseRoutes(r.children, fullPath);
        }
      }
    };
    traverseRoutes(configRoutes);

    const allCaps = this.registry.getAllCapabilities();

    // Construct capability tree hierarchy
    const capabilityTree: WebsiteCapabilityNode[] = [
      {
        name: 'PORTFOLIO',
        category: 'PORTFOLIO',
        route: '/money',
        capabilities: allCaps.filter((c) => c.category === 'PORTFOLIO'),
        children: [
          { name: 'Summary & Value', category: 'PORTFOLIO', capabilities: allCaps.filter((c) => c.id === 'GET_PORTFOLIO_SUMMARY') },
          { name: 'Holdings & Movers', category: 'PORTFOLIO', capabilities: allCaps.filter((c) => ['GET_BIGGEST_LOSER', 'GET_TOP_MOVER'].includes(c.id)) },
          { name: 'Exposure & Impact', category: 'PORTFOLIO', capabilities: allCaps.filter((c) => ['GET_SECTOR_EXPOSURE', 'GET_MARKET_EXPOSURE', 'GET_PORTFOLIO_IMPACT'].includes(c.id)) }
        ]
      },
      {
        name: 'STOCK',
        category: 'STOCK',
        route: '/money/stocks/:symbol',
        capabilities: allCaps.filter((c) => ['STOCK', 'RESEARCH'].includes(c.category)),
        children: [
          { name: 'Quotes & Charts', category: 'STOCK', capabilities: allCaps.filter((c) => ['GET_STOCK_QUOTE', 'SET_TIMEFRAME', 'EXPAND_CHART'].includes(c.id)) },
          { name: 'Movement Analysis', category: 'STOCK', capabilities: allCaps.filter((c) => ['ANALYZE_STOCK_MOVEMENT', 'GET_FINANCIAL_NEWS'].includes(c.id)) },
          { name: 'Comparison', category: 'STOCK', capabilities: allCaps.filter((c) => c.id === 'COMPARE_STOCKS') }
        ]
      },
      {
        name: 'ORDER & FINANCIAL SAFETY',
        category: 'ORDER',
        route: '/money',
        capabilities: allCaps.filter((c) => c.category === 'ORDER'),
        children: [
          { name: 'Pre-Trade Risk Preview', category: 'ORDER', capabilities: allCaps.filter((c) => c.id === 'PREVIEW_ORDER') },
          { name: 'Order Cancellation', category: 'ORDER', capabilities: allCaps.filter((c) => c.id === 'CANCEL_ORDER') },
          { name: 'Emergency Kill Switch', category: 'ORDER', capabilities: allCaps.filter((c) => c.id === 'TOGGLE_KILL_SWITCH') }
        ]
      },
      {
        name: 'QUANTITATIVE ML & STRATEGY',
        category: 'ML',
        route: '/money/ai-analyst',
        capabilities: allCaps.filter((c) => ['ML', 'STRATEGY', 'AUTOMATION'].includes(c.category)),
        children: [
          { name: 'Model Inference', category: 'ML', capabilities: allCaps.filter((c) => ['GET_ML_PREDICTION', 'EXPLAIN_ML_PREDICTION'].includes(c.id)) },
          { name: 'Walk-Forward Backtesting', category: 'STRATEGY', capabilities: allCaps.filter((c) => c.id === 'RUN_BACKTEST') },
          { name: 'Strategy Automation', category: 'AUTOMATION', capabilities: allCaps.filter((c) => ['ENABLE_AUTOMATION', 'DISABLE_AUTOMATION', 'GET_AUTOMATION_STATUS'].includes(c.id)) }
        ]
      },
      {
        name: 'ALERTS & SYSTEM',
        category: 'ALERT',
        route: '/money/notifications',
        capabilities: allCaps.filter((c) => ['ALERT', 'SETTINGS', 'VOICE', 'GENERAL'].includes(c.category))
      }
    ];

    return {
      timestamp: new Date().toISOString(),
      totalRoutes: flattenedRoutes.length,
      routes: flattenedRoutes,
      capabilityTree,
      coverageStats: {
        totalCapabilities: allCaps.length,
        financialSafetyGatedCount: allCaps.filter((c) => c.confirmationRequired).length,
        readOnlyCount: allCaps.filter((c) => c.riskLevel === 'READ_ONLY').length,
        uiControlCount: allCaps.filter((c) => c.category === 'UI_CONTROL').length
      }
    };
  }
}
