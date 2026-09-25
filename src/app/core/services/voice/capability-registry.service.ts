import { Injectable } from '@angular/core';

export type CapabilityCategory =
  | 'NAVIGATION'
  | 'UI_CONTROL'
  | 'PORTFOLIO'
  | 'MARKET'
  | 'STOCK'
  | 'RESEARCH'
  | 'ALERT'
  | 'ORDER'
  | 'BROKER'
  | 'ML'
  | 'STRATEGY'
  | 'AUTOMATION'
  | 'PAPER_TRADING'
  | 'SETTINGS'
  | 'VOICE'
  | 'SYSTEM'
  | 'GENERAL'
  // Backward compatibility aliases
  | 'PORTFOLIO_DATA'
  | 'STOCK_DATA'
  | 'RESEARCH_DATA'
  | 'ALERT_OPS'
  | 'ORDER_OPS'
  | 'AUTOMATION_OPS'
  | 'ML_OPS'
  | 'STRATEGY_OPS'
  | 'PAPER_TRADING_OPS'
  | 'BROKER_OPS'
  | 'SETTINGS_OPS'
  | 'VOICE_OPS'
  | 'GENERAL_HELP';

export type RiskClassification =
  | 'READ_ONLY'
  | 'SAFE_UI'
  | 'REVERSIBLE'
  | 'SENSITIVE'
  | 'FINANCIAL'
  | 'DESTRUCTIVE';

export interface CapabilityParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  required: boolean;
  description: string;
  default?: any;
  options?: string[];
}

export interface AurumCapability {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  aliases?: string[];
  parameters?: CapabilityParameter[];
  requiredContext?: string[];
  riskLevel: RiskClassification;
  confirmationRequired: boolean;
  reversible: boolean;
  requiresAuthentication: boolean;
  endpoint?: string;
  actionHandler?: string;
  navigationTarget?: string;
  dependencies?: string[];
  examples?: string[];
  supportsCompoundCommand: boolean;
  supportsContextInheritance: boolean;
  keywords: string[];
  execute?: (params: Record<string, any>, context: any) => Promise<any>;
}

@Injectable({
  providedIn: 'root'
})
export class CapabilityRegistryService {
  private readonly capabilities = new Map<string, AurumCapability>();

  constructor() {
    this.registerCoreWebsiteCapabilities();
  }

  registerCapability(cap: AurumCapability) {
    this.capabilities.set(cap.id, cap);
  }

  getCapability(id: string): AurumCapability | undefined {
    return this.capabilities.get(id);
  }

  getAllCapabilities(): AurumCapability[] {
    return Array.from(this.capabilities.values());
  }

  getCapabilitiesByCategory(category: CapabilityCategory): AurumCapability[] {
    return this.getAllCapabilities().filter((c) => c.category === category);
  }

  findMatchingCapabilities(query: string): AurumCapability[] {
    const lower = query.toLowerCase().trim();
    const words = lower.split(/\s+/).filter((w) => w.length > 2);

    const scored = this.getAllCapabilities().map((cap) => {
      let score = 0;

      // Exact alias match
      if (cap.aliases?.some((a) => lower.includes(a.toLowerCase()))) {
        score += 10;
      }

      // Keyword match
      if (cap.keywords?.some((kw) => lower.includes(kw.toLowerCase()))) {
        score += 6;
      }

      // Example match
      if (cap.examples?.some((ex) => lower.includes(ex.toLowerCase()) || ex.toLowerCase().includes(lower))) {
        score += 8;
      }

      // Word match in name or description
      for (const w of words) {
        if (cap.name.toLowerCase().includes(w)) score += 3;
        if (cap.description.toLowerCase().includes(w)) score += 1;
      }

      return { cap, score };
    });

    return scored
      .filter((s) => s.score > 2)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.cap);
  }

  private registerCoreWebsiteCapabilities() {
    // =========================================================================
    // 1. NAVIGATION
    // =========================================================================
    this.registerCapability({
      id: 'OPEN_DASHBOARD',
      name: 'Open Dashboard',
      description: 'Navigates to the main portfolio dashboard and summary overview.',
      category: 'NAVIGATION',
      aliases: ['portfolio', 'my portfolio', 'dashboard', 'my money', 'my investments', 'holdings', 'positions', 'home', 'money page'],
      parameters: [],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      navigationTarget: '/money',
      examples: ['Take me to my portfolio', 'Open my portfolio', 'Show my money', 'Go to dashboard', 'Take me to where my investments are'],
      supportsCompoundCommand: true,
      supportsContextInheritance: false,
      keywords: ['dashboard', 'portfolio', 'home', 'main page', 'overview', 'investments', 'holdings', 'money']
    });

    this.registerCapability({
      id: 'OPEN_STOCK',
      name: 'Open Stock Detail',
      description: 'Navigates to the stock detail page for a specific ticker symbol.',
      category: 'NAVIGATION',
      aliases: ['open stock', 'show stock', 'view stock', 'pull up', 'inspect stock'],
      parameters: [
        { name: 'symbol', type: 'string', required: true, description: 'Ticker symbol (e.g. TCS, NVDA)' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      navigationTarget: '/money/stocks/:symbol',
      examples: ['Show me TCS', 'Open Tata Consultancy Services', 'Pull up Nvidia', 'Inspect Apple', 'Take me there'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['stock', 'chart', 'quote', 'view', 'inspect', 'show', 'open', 'ticker']
    });

    this.registerCapability({
      id: 'OPEN_ANALYST',
      name: 'Open AI Analyst',
      description: 'Navigates to the institutional AI Analyst research dossier for deep fundamental, technical, and catalyst analysis.',
      category: 'NAVIGATION',
      aliases: ['ai analyst', 'research dossier', 'analyst report', 'deep dive', 'stock research'],
      parameters: [
        { name: 'symbol', type: 'string', required: false, description: 'Ticker symbol to inspect' },
        { name: 'tab', type: 'enum', required: false, description: 'Sub-tab', options: ['overview', 'deep-dive', 'evidence', 'valuation', 'catalysts'] }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      navigationTarget: '/money/ai-analyst/:symbol/:tab',
      examples: ['Open AI Analyst', 'Show research for TCS', 'Open the analyst tab', 'Show evidence citations'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['analyst', 'ai analyst', 'research', 'dossier', 'citations', 'valuation', 'catalysts']
    });

    this.registerCapability({
      id: 'OPEN_NOTIFICATIONS',
      name: 'Open Notifications & Alerts',
      description: 'Navigates to the notification center and alert management screen.',
      category: 'NAVIGATION',
      aliases: ['notifications', 'alerts center', 'my alerts', 'alert list'],
      parameters: [],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      navigationTarget: '/money/notifications',
      examples: ['Open notifications', 'Show my alerts', 'View alerts center', 'Open alerts'],
      supportsCompoundCommand: true,
      supportsContextInheritance: false,
      keywords: ['notifications', 'alerts', 'inbox', 'messages']
    });

    this.registerCapability({
      id: 'OPEN_SETTINGS',
      name: 'Open Settings',
      description: 'Navigates to application user settings and preferences.',
      category: 'NAVIGATION',
      aliases: ['settings', 'preferences', 'user preferences', 'config', 'account settings'],
      parameters: [],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      navigationTarget: '/money/settings',
      examples: ['Open settings', 'Go to settings', 'User preferences', 'Show settings'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['settings', 'preferences', 'configuration', 'account', 'profile']
    });

    this.registerCapability({
      id: 'NAVIGATE_BACK',
      name: 'Navigate Back',
      description: 'Navigates back to the previous screen or route.',
      category: 'NAVIGATION',
      aliases: ['back', 'go back', 'previous page', 'return'],
      parameters: [],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: false,
      examples: ['Go back', 'Take me back', 'Return to previous page', 'Back'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['back', 'return', 'previous', 'reverse']
    });

    // =========================================================================
    // 2. UI CONTROL
    // =========================================================================
    this.registerCapability({
      id: 'SET_TIMEFRAME',
      name: 'Set Chart Timeframe',
      description: 'Adjusts the active stock or portfolio chart historical timeframe.',
      category: 'UI_CONTROL',
      aliases: ['timeframe', 'chart period', 'chart window', 'switch timeframe'],
      parameters: [
        { name: 'timeframe', type: 'enum', required: true, description: '1D, 1W, 1M, 3M, 1Y, or All', options: ['1D', '1W', '1M', '3M', '1Y', 'All'] }
      ],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Make it three months', 'Show the last three months', 'Switch chart to 1 year', 'Show 1 day view', 'Show the last six months'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['timeframe', '1d', '1w', '1m', '3m', '1y', 'all', 'months', 'year', 'chart period', 'window']
    });

    this.registerCapability({
      id: 'SET_MARKET_FILTER',
      name: 'Set Market Filter',
      description: 'Filters the portfolio holdings and quotes by geographic market.',
      category: 'UI_CONTROL',
      aliases: ['filter market', 'filter stocks', 'show market'],
      parameters: [
        { name: 'market', type: 'enum', required: true, description: 'Market', options: ['ALL', 'US', 'IN'] }
      ],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Filter this to Indian stocks', 'Show only US stocks', 'Switch to Indian markets', 'Show all markets'],
      supportsCompoundCommand: true,
      supportsContextInheritance: false,
      keywords: ['market', 'indian', 'us', 'american', 'filter', 'all markets']
    });

    this.registerCapability({
      id: 'SWITCH_TAB',
      name: 'Switch Tab',
      description: 'Switches the active sub-tab on the current view (e.g. AI Analyst or detail panels).',
      category: 'UI_CONTROL',
      aliases: ['switch tab', 'open tab', 'view tab', 'select tab'],
      parameters: [
        { name: 'tab', type: 'string', required: true, description: 'Tab identifier (overview, deep-dive, evidence, valuation, catalysts)' }
      ],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Switch to deep dive tab', 'Open evidence tab', 'Show catalysts tab', 'Open the valuation tab'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['tab', 'sub-tab', 'switch tab', 'deep-dive', 'evidence', 'valuation', 'catalysts']
    });

    this.registerCapability({
      id: 'TOGGLE_MORNING_BRIEFING',
      name: 'Toggle Morning Briefing Audio',
      description: 'Plays or pauses the daily AI morning market briefing.',
      category: 'UI_CONTROL',
      aliases: ['morning briefing', 'daily briefing', 'audio briefing'],
      parameters: [],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Play morning briefing', 'Read my morning briefing', 'Stop briefing'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['briefing', 'morning briefing', 'audio update', 'market podcast']
    });

    this.registerCapability({
      id: 'EXPAND_CHART',
      name: 'Expand Chart',
      description: 'Expands the chart view to full width or high readability mode.',
      category: 'UI_CONTROL',
      aliases: ['expand chart', 'maximize chart', 'large chart', 'make chart easier to read'],
      parameters: [],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Expand the chart', 'Make the chart easier to read', 'Maximize chart view'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['expand', 'maximize', 'zoom', 'easier to read', 'enlarge']
    });

    this.registerCapability({
      id: 'COLLAPSE_DETAILS',
      name: 'Collapse Details',
      description: 'Collapses expanded detail panels or cards.',
      category: 'UI_CONTROL',
      aliases: ['collapse', 'minimize', 'close that', 'close this', 'hide details'],
      parameters: [],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Close that', 'Collapse the details', 'Hide sidebar', 'Close this'],
      supportsCompoundCommand: true,
      supportsContextInheritance: false,
      keywords: ['collapse', 'close that', 'close this', 'hide', 'dismiss']
    });

    this.registerCapability({
      id: 'OPEN_ORDER_MODAL',
      name: 'Open Order Modal',
      description: 'Opens the trade ticket dialog with pre-trade checks.',
      category: 'UI_CONTROL',
      aliases: ['order modal', 'trade modal', 'open trade'],
      parameters: [
        { name: 'symbol', type: 'string', required: false, description: 'Stock symbol' },
        { name: 'side', type: 'enum', required: false, description: 'BUY or SELL', options: ['BUY', 'SELL'] }
      ],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Open trade ticket', 'Trade TCS', 'Open buy modal'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['trade modal', 'order dialog', 'buy modal', 'sell modal']
    });

    this.registerCapability({
      id: 'OPEN_AUTOMATION_MODAL',
      name: 'Open Automation Modal',
      description: 'Opens the quantitative trading automation and risk control modal.',
      category: 'UI_CONTROL',
      aliases: ['automation modal', 'bot settings', 'strategy automation modal'],
      parameters: [],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Open automation modal', 'Show bot settings', 'View automation status'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['automation modal', 'bot modal', 'strategy modal']
    });

    this.registerCapability({
      id: 'OPEN_BROKER_SYNC_MODAL',
      name: 'Open Broker Sync Modal',
      description: 'Opens broker reconciliation and adapter connection modal.',
      category: 'UI_CONTROL',
      aliases: ['broker sync', 'connect broker', 'broker modal'],
      parameters: [],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Open broker sync', 'Connect my broker', 'Show broker connection'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['broker', 'connect broker', 'sync broker', 'adapter']
    });

    // =========================================================================
    // 3. PORTFOLIO
    // =========================================================================
    this.registerCapability({
      id: 'GET_PORTFOLIO_SUMMARY',
      name: 'Get Portfolio Summary',
      description: 'Retrieves current total portfolio value, invested capital, and overall P&L.',
      category: 'PORTFOLIO',
      aliases: ['portfolio return', 'portfolio value', 'how is my portfolio', 'my returns', 'p&l', 'total gain'],
      parameters: [],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      endpoint: '/api/portfolio',
      examples: [
        'How much is my portfolio worth?',
        'What is my portfolio return?',
        'How much did I gain today?',
        'Why did my portfolio fall today?',
        'Check my portfolio'
      ],
      supportsCompoundCommand: true,
      supportsContextInheritance: false,
      keywords: ['portfolio value', 'portfolio return', 'p&l', 'gain', 'worth', 'invested', 'total return', 'performance']
    });

    this.registerCapability({
      id: 'GET_BIGGEST_LOSER',
      name: 'Get Biggest Loser',
      description: 'Identifies the holding in the portfolio suffering the largest percentage loss today.',
      category: 'PORTFOLIO',
      aliases: ['biggest loser', 'worst stock', 'top decliner', 'what is hurting my portfolio', 'losing positions'],
      parameters: [],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: [
        'What is my biggest loser?',
        'Show only the losing positions',
        'Find the biggest loser and explain why',
        'Show me the stock that lost the most today',
        'What is hurting my portfolio?'
      ],
      supportsCompoundCommand: true,
      supportsContextInheritance: false,
      keywords: ['loser', 'biggest loser', 'decliner', 'worst stock', 'hurting', 'losing positions', 'loss']
    });

    this.registerCapability({
      id: 'GET_TOP_MOVER',
      name: 'Get Top Mover / Winner',
      description: 'Identifies the highest performing holding in the portfolio today.',
      category: 'PORTFOLIO',
      aliases: ['top mover', 'biggest winner', 'best performer', 'best stock today'],
      parameters: [],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['What is my biggest winner?', 'Show today\'s top movers', 'Which stock gained the most?'],
      supportsCompoundCommand: true,
      supportsContextInheritance: false,
      keywords: ['top mover', 'winner', 'biggest winner', 'best performer', 'gainer']
    });

    this.registerCapability({
      id: 'GET_SECTOR_EXPOSURE',
      name: 'Get Sector Exposure',
      description: 'Analyzes portfolio diversification and sector concentration breakdown.',
      category: 'PORTFOLIO',
      aliases: ['sector exposure', 'allocation', 'technology exposure', 'diversification'],
      parameters: [],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['How much am I exposed to technology?', 'Show my sector exposure', 'What is my portfolio allocation?'],
      supportsCompoundCommand: true,
      supportsContextInheritance: false,
      keywords: ['sector', 'exposure', 'allocation', 'concentration', 'technology', 'diversification']
    });

    this.registerCapability({
      id: 'GET_MARKET_EXPOSURE',
      name: 'Get Market Exposure',
      description: 'Compares Indian versus US geographic asset allocation in the portfolio.',
      category: 'PORTFOLIO',
      aliases: ['compare market exposure', 'us vs indian exposure', 'geographic allocation'],
      parameters: [],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Compare my Indian and US exposure', 'How much is in Indian stocks?', 'How much is in US stocks?'],
      supportsCompoundCommand: true,
      supportsContextInheritance: false,
      keywords: ['market exposure', 'indian and us exposure', 'geographic', 'inr vs usd']
    });

    this.registerCapability({
      id: 'GET_PORTFOLIO_IMPACT',
      name: 'Get Portfolio Impact',
      description: 'Calculates how an individual stock or sector movement impacts total portfolio P&L.',
      category: 'PORTFOLIO',
      aliases: ['portfolio impact', 'what is affecting my portfolio', 'holding impact'],
      parameters: [
        { name: 'symbol', type: 'string', required: false, description: 'Ticker symbol' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['What is affecting my portfolio?', 'Tell me whether my portfolio is affected', 'How does TCS affect my portfolio?'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['impact', 'affecting my portfolio', 'portfolio impact', 'risk contribution']
    });

    // =========================================================================
    // 4. MARKET
    // =========================================================================
    this.registerCapability({
      id: 'GET_MARKET_BRIEF',
      name: 'Get Market Overview',
      description: 'Provides live macroeconomic indices, Nifty 50, Sensex, and S&P 500 status.',
      category: 'MARKET',
      aliases: ['market news', 'market status', 'how are markets doing', 'macro brief'],
      parameters: [],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: false,
      endpoint: '/api/market/quotes',
      examples: [
        'Show me today\'s market news',
        'What\'s happening in the market?',
        'How are Indian markets doing?',
        'How are US markets doing?',
        'What\'s moving the market?'
      ],
      supportsCompoundCommand: true,
      supportsContextInheritance: false,
      keywords: ['market', 'nifty', 'sensex', 'indices', 'macro', 'nasdaq', 'sp500', 'market news']
    });

    // =========================================================================
    // 5. STOCK
    // =========================================================================
    this.registerCapability({
      id: 'GET_STOCK_QUOTE',
      name: 'Get Stock Quote',
      description: 'Fetches real-time price, day change, volume, and spread for a stock.',
      category: 'STOCK',
      aliases: ['stock quote', 'current price', 'what is stock trading at', 'quote'],
      parameters: [
        { name: 'symbol', type: 'string', required: true, description: 'Ticker symbol' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: false,
      endpoint: '/api/market/quotes',
      examples: ['What\'s TCS trading at?', 'How is Nvidia doing?', 'Get price for Apple', 'What is it trading at?'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['quote', 'price', 'trading at', 'ticker', 'current price', 'doing']
    });

    this.registerCapability({
      id: 'COMPARE_STOCKS',
      name: 'Compare Stocks',
      description: 'Performs side-by-side valuation, momentum, and financial comparison between two assets.',
      category: 'STOCK',
      aliases: ['compare', 'versus', 'side by side', 'which is better'],
      parameters: [
        { name: 'symbolA', type: 'string', required: true, description: 'Primary ticker' },
        { name: 'symbolB', type: 'string', required: true, description: 'Secondary ticker' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Compare it with Infosys', 'Compare TCS and Infosys', 'Which one is performing better?', 'Compare these two', 'Which is stronger?'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['compare', 'vs', 'versus', 'side by side', 'comparison', 'which is better']
    });

    this.registerCapability({
      id: 'ANALYZE_STOCK_MOVEMENT',
      name: 'Analyze Stock Movement',
      description: 'Reasons through catalysts, news headlines, and volatility explaining why an asset is moving.',
      category: 'STOCK',
      aliases: ['why is it moving', 'why is it falling', 'why is it rising', 'movement drivers', 'catalyst analysis'],
      parameters: [
        { name: 'symbol', type: 'string', required: true, description: 'Ticker symbol' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      endpoint: '/api/voice/query',
      examples: ['What\'s happening with it?', 'Why is it falling?', 'Why is TCS moving?', 'Find why it dropped', 'What news is affecting Nvidia?'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['why', 'falling', 'dropping', 'rising', 'moving', 'happening with it', 'reason', 'catalyst']
    });

    this.registerCapability({
      id: 'GET_COMPLETE_SECURITY_INTELLIGENCE',
      name: 'Get Complete Security Intelligence',
      description: 'Fetches complete security intelligence across live quote, fundamentals, technicals, news, earnings, filings, portfolio position, watchlist, and ML predictions.',
      category: 'STOCK',
      aliases: ['give me everything about', 'show me all information about', 'everything on', 'full intelligence on', 'complete dossier on'],
      parameters: [
        { name: 'symbol', type: 'string', required: true, description: 'Ticker symbol' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: [
        'Give me everything about TCS',
        'Show me all information about Nvidia',
        'Give me everything about Apple',
        'Full intelligence on Tata Steel'
      ],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['everything about', 'all information', 'everything on', 'complete intelligence', 'full data']
    });

    // =========================================================================
    // 6. RESEARCH
    // =========================================================================
    this.registerCapability({
      id: 'GET_FINANCIAL_NEWS',
      name: 'Get Financial News',
      description: 'Retrieves relevant financial headlines and Google Search Grounded market stories.',
      category: 'RESEARCH',
      aliases: ['news', 'financial news', 'headlines', 'market stories'],
      parameters: [
        { name: 'symbol', type: 'string', required: false, description: 'Ticker symbol' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      endpoint: '/api/news',
      examples: ['Show me today\'s market news', 'Search the latest news about TCS', 'What is the news on Nvidia?'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['news', 'headlines', 'stories', 'media', 'press release', 'search news']
    });

    this.registerCapability({
      id: 'SEARCH_RESEARCH',
      name: 'Search Research & Everything',
      description: 'Deep-dives into all records, documents, news, and fundamentals for a company.',
      category: 'RESEARCH',
      aliases: ['everything related to', 'deep research', 'search company'],
      parameters: [
        { name: 'symbol', type: 'string', required: true, description: 'Ticker symbol' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Show me everything related to TCS', 'Research Infosys in depth', 'Find all analysis for NVDA'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['everything related', 'all analysis', 'full research', 'dossier']
    });

    this.registerCapability({
      id: 'EXPLAIN_FINANCIAL_CONCEPT',
      name: 'Explain Financial Concept',
      description: 'Provides plain-English quantitative explanations of ratios, indicators, and risk metrics.',
      category: 'RESEARCH',
      aliases: ['explain ratio', 'what does it mean', 'financial definition'],
      parameters: [
        { name: 'concept', type: 'string', required: true, description: 'Financial concept or metric' }
      ],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: false,
      examples: ['What does PE ratio mean?', 'Explain Sharpe ratio', 'What is beta?'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['explain', 'what does this mean', 'concept', 'definition', 'ratio']
    });

    // =========================================================================
    // 7. ALERT
    // =========================================================================
    this.registerCapability({
      id: 'SET_PRICE_ALERT',
      name: 'Set Price Alert',
      description: 'Creates a deterministic price threshold notification trigger.',
      category: 'ALERT',
      aliases: ['set alert', 'create alert', 'price alert', 'notify me when'],
      parameters: [
        { name: 'symbol', type: 'string', required: true, description: 'Ticker symbol' },
        { name: 'price', type: 'number', required: true, description: 'Trigger price' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'REVERSIBLE',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Create an alert when TCS crosses 4000', 'Alert me if NVDA drops below 160', 'Set price alert for TCS at 3900'],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['alert', 'price alert', 'notify', 'crosses', 'threshold', 'trigger']
    });

    this.registerCapability({
      id: 'REMOVE_ALERT',
      name: 'Remove Price Alert',
      description: 'Deletes an active price threshold alert.',
      category: 'ALERT',
      aliases: ['remove alert', 'delete alert', 'cancel alert'],
      parameters: [
        { name: 'symbol', type: 'string', required: false, description: 'Ticker symbol' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'REVERSIBLE',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['Remove this alert', 'Delete alert for TCS', 'Cancel the alert'],
      supportsCompoundCommand: false,
      supportsContextInheritance: true,
      keywords: ['remove alert', 'delete alert', 'clear alert', 'dismiss alert']
    });

    this.registerCapability({
      id: 'LIST_ALERTS',
      name: 'List Active Alerts',
      description: 'Lists all current active price alerts and notification triggers.',
      category: 'ALERT',
      aliases: ['active alerts', 'what alerts do i have', 'show alerts'],
      parameters: [],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: ['What alerts are active?', 'Show my alerts', 'List active alerts'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['list alerts', 'active alerts', 'my alerts']
    });

    // =========================================================================
    // 8. ORDER & FINANCIAL SAFETY
    // =========================================================================
    this.registerCapability({
      id: 'PREVIEW_ORDER',
      name: 'Preview Trade Order Ticket',
      description: 'Calculates pre-trade risk, fees, and creates an order confirmation card. NEVER directly transmits to broker without explicit on-screen user click.',
      category: 'ORDER',
      aliases: ['buy stock', 'sell stock', 'trade order', 'preview order', 'invest in'],
      parameters: [
        { name: 'symbol', type: 'string', required: true, description: 'Ticker symbol' },
        { name: 'side', type: 'enum', required: true, description: 'BUY or SELL', options: ['BUY', 'SELL'] },
        { name: 'quantity', type: 'number', required: true, description: 'Number of shares' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'FINANCIAL',
      confirmationRequired: true,
      reversible: false,
      requiresAuthentication: true,
      endpoint: '/api/orders/preview',
      examples: ['Buy 2 TCS', 'Sell 5 NVDA', 'Buy 10 shares of Reliance', 'Buy ₹50,000 of Infosys'],
      supportsCompoundCommand: false,
      supportsContextInheritance: true,
      keywords: ['buy', 'sell', 'purchase', 'order', 'trade', 'shares']
    });

    this.registerCapability({
      id: 'CANCEL_ORDER',
      name: 'Cancel Order',
      description: 'Cancels an active or pending open order. If multiple orders exist, requests explicit clarification.',
      category: 'ORDER',
      aliases: ['cancel order', 'cancel my order', 'abort order'],
      parameters: [
        { name: 'orderId', type: 'string', required: false, description: 'Order ID' },
        { name: 'symbol', type: 'string', required: false, description: 'Stock symbol of order' }
      ],
      riskLevel: 'REVERSIBLE',
      confirmationRequired: true,
      reversible: false,
      requiresAuthentication: true,
      endpoint: '/api/orders/cancel',
      examples: ['Cancel my order', 'Cancel order for TCS', 'Abort pending trade'],
      supportsCompoundCommand: false,
      supportsContextInheritance: true,
      keywords: ['cancel order', 'abort order', 'kill order']
    });

    this.registerCapability({
      id: 'TOGGLE_KILL_SWITCH',
      name: 'Toggle Emergency Trading Kill Switch',
      description: 'Immediately halts or resumes all order placement, broker routing, and strategy automation.',
      category: 'ORDER',
      aliases: ['kill switch', 'emergency halt', 'halt all trading', 'disengage kill switch', 'resume trading'],
      parameters: [
        { name: 'active', type: 'boolean', required: true, description: 'True to halt, false to resume' },
        { name: 'reason', type: 'string', required: false, description: 'Reason for toggle' }
      ],
      riskLevel: 'SENSITIVE',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      endpoint: '/api/orders/kill-switch',
      examples: ['Kill trading', 'Emergency halt', 'Activate kill switch', 'Turn off kill switch', 'Resume trading'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['kill switch', 'emergency halt', 'halt trading', 'stop trading', 'resume trading', 'disengage kill switch']
    });

    // =========================================================================
    // 9. BROKER
    // =========================================================================
    this.registerCapability({
      id: 'SYNC_BROKER',
      name: 'Sync Broker Account',
      description: 'Triggers portfolio and balance reconciliation against connected broker adapters.',
      category: 'BROKER',
      aliases: ['sync broker', 'reconcile broker', 'refresh broker connection'],
      parameters: [],
      riskLevel: 'SENSITIVE',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      endpoint: '/api/broker/reconcile',
      examples: ['Sync my broker', 'Reconcile broker balances', 'Refresh broker connection'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['broker', 'sync broker', 'reconcile', 'broker status']
    });

    // =========================================================================
    // 10. ML & QUANTITATIVE INTELLIGENCE
    // =========================================================================
    this.registerCapability({
      id: 'GET_ML_PREDICTION',
      name: 'Get ML Model Prediction',
      description: 'Runs real inference on the trained decision tree classifier, returning signal, confidence, and driving features.',
      category: 'ML',
      aliases: ['ml prediction', 'model prediction', 'run ml', 'what does the model predict'],
      parameters: [
        { name: 'symbol', type: 'string', required: true, description: 'Ticker symbol' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      endpoint: '/api/ml/predict',
      examples: [
        'Run the ML prediction for it',
        'Give me the ML prediction for TCS',
        'What does the model predict?',
        'Now show the ML prediction',
        'What\'s the confidence?'
      ],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['ml', 'machine learning', 'prediction', 'model', 'decision tree', 'forecast', 'bullish', 'bearish', 'confidence']
    });

    this.registerCapability({
      id: 'EXPLAIN_ML_PREDICTION',
      name: 'Explain ML Prediction & Features',
      description: 'Explains the quantitative feature weights, technical indicators, and reasoning behind an ML prediction.',
      category: 'ML',
      aliases: ['explain prediction', 'why is the model bullish', 'feature importance', 'what does this ml prediction mean'],
      parameters: [
        { name: 'symbol', type: 'string', required: false, description: 'Ticker symbol' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      examples: [
        'What does this ML prediction mean?',
        'Why is the model bullish?',
        'Which features are driving this prediction?',
        'Explain the model\'s reasoning'
      ],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['explain prediction', 'features', 'why is model', 'feature importance', 'driving this prediction']
    });

    this.registerCapability({
      id: 'COMPARE_ML_MODELS',
      name: 'Compare ML Models (V1 Baseline vs V2 Ensemble)',
      description: 'Compares the baseline Decision Tree against the new High-Confidence Selective Ensemble.',
      category: 'ML',
      aliases: ['compare models', 'compare old model with new', 'compare v1 with v2', 'compare the old model with the new one', 'model comparison'],
      parameters: [
        { name: 'symbol', type: 'string', required: false, description: 'Ticker symbol' }
      ],
      requiredContext: [],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      endpoint: '/api/ml/models/compare',
      examples: [
        'Compare the old model with the new one',
        'Compare ML models',
        'Compare V1 baseline with V2 ensemble',
        'Show model comparison'
      ],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['compare models', 'old model', 'new model', 'baseline', 'v1', 'v2', 'compare ml']
    });

    // =========================================================================
    // 11. STRATEGY & BACKTESTING
    // =========================================================================
    this.registerCapability({
      id: 'RUN_BACKTEST',
      name: 'Run Strategy Backtest',
      description: 'Executes chronological walk-forward strategy backtest against historical data.',
      category: 'STRATEGY',
      aliases: ['backtest', 'run backtest', 'strategy backtest', 'test strategy'],
      parameters: [
        { name: 'symbol', type: 'string', required: true, description: 'Ticker symbol' }
      ],
      requiredContext: ['symbol'],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      endpoint: '/api/ml/backtest',
      examples: [
        'Backtest the current strategy',
        'Backtest it',
        'Run a backtest',
        'How did the strategy perform?',
        'Compare the strategy with buy and hold',
        'Show me the backtest results'
      ],
      supportsCompoundCommand: true,
      supportsContextInheritance: true,
      keywords: ['backtest', 'strategy', 'simulation', 'sharpe ratio', 'buy and hold', 'win rate', 'drawdown']
    });

    // =========================================================================
    // 12. AUTOMATION
    // =========================================================================
    this.registerCapability({
      id: 'GET_AUTOMATION_STATUS',
      name: 'Get Automation Status',
      description: 'Checks whether trading automation is active, idle, or halted.',
      category: 'AUTOMATION',
      aliases: ['automation status', 'is automation running', 'what is automation doing'],
      parameters: [],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      endpoint: '/api/automation/status',
      examples: ['Is automation running?', 'What\'s automation doing?', 'Check automation status'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['automation status', 'is automation running', 'bot status']
    });

    this.registerCapability({
      id: 'DISABLE_AUTOMATION',
      name: 'Disable Automation',
      description: 'Safely turns off automated strategy execution and order generation.',
      category: 'AUTOMATION',
      aliases: ['turn off automation', 'disable automation', 'stop automation', 'halt bot'],
      parameters: [],
      riskLevel: 'SENSITIVE',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: true,
      endpoint: '/api/automation/toggle',
      examples: ['Turn automation off', 'Stop automation', 'Disable automated trading'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['turn off automation', 'disable automation', 'stop bot', 'halt automation']
    });

    this.registerCapability({
      id: 'ENABLE_AUTOMATION',
      name: 'Enable Automation',
      description: 'Requests activation of automated strategy execution (requires explicit risk confirmation).',
      category: 'AUTOMATION',
      aliases: ['turn on automation', 'enable automation', 'start bot', 'activate automation'],
      parameters: [],
      riskLevel: 'SENSITIVE',
      confirmationRequired: true,
      reversible: true,
      requiresAuthentication: true,
      endpoint: '/api/automation/toggle',
      examples: ['Turn automation on', 'Enable automation', 'Start trading bot'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['turn on automation', 'enable automation', 'start bot', 'activate automation']
    });

    // =========================================================================
    // 13. VOICE CONTROL & INTERRUPTION
    // =========================================================================
    this.registerCapability({
      id: 'STOP_SPEAKING',
      name: 'Stop Voice / Interrupt',
      description: 'Immediately halts ongoing voice playback, speech synthesizer, and active UI cards.',
      category: 'VOICE',
      aliases: ['stop', 'be quiet', 'shut up', 'silence', 'cancel', 'pause', 'abort', 'never mind'],
      parameters: [],
      riskLevel: 'SAFE_UI',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: false,
      examples: ['Stop', 'Cancel', 'Never mind', 'Abort', 'Cancel what you\'re doing'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['stop', 'cancel', 'silence', 'quiet', 'pause', 'halt', 'abort', 'never mind']
    });

    // =========================================================================
    // 14. GENERAL & UNSUPPORTED REJECTION
    // =========================================================================
    this.registerCapability({
      id: 'GENERAL_HELP',
      name: 'General Voice Help',
      description: 'Explains what Aurum Universal Voice OS can do across the platform.',
      category: 'GENERAL',
      aliases: ['help', 'what can you do', 'capabilities', 'voice commands'],
      parameters: [],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: false,
      examples: ['Help', 'What can you do?', 'How do I use voice?', 'Show capabilities'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['help', 'capabilities', 'what can you do', 'features', 'commands']
    });

    this.registerCapability({
      id: 'UNSUPPORTED_CAPABILITY',
      name: 'Unsupported Capability Fallback',
      description: 'Truthful fallback when the user requests an out-of-domain operation (e.g. flight booking, emailing, bank transfers) without hallucinating.',
      category: 'GENERAL',
      aliases: ['unsupported', 'out of domain', 'unknown capability'],
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'Raw user request' }
      ],
      riskLevel: 'READ_ONLY',
      confirmationRequired: false,
      reversible: true,
      requiresAuthentication: false,
      examples: ['Book me a flight', 'Send an email to John', 'Transfer 10000 to my friend', 'Change my bank password'],
      supportsCompoundCommand: false,
      supportsContextInheritance: false,
      keywords: ['book flight', 'send email', 'transfer money', 'bank password', 'order pizza']
    });
  }
}
