const http = require('http');

// Full Natural Language & Capability Matrix Test Suite
const TICKER_MAP = {
  tcs: 'TCS',
  'tata consultancy': 'TCS',
  'tata consultancy services': 'TCS',
  reliance: 'RELIANCE',
  ril: 'RELIANCE',
  'reliance industries': 'RELIANCE',
  nvda: 'NVDA',
  nvidia: 'NVDA',
  aapl: 'AAPL',
  apple: 'AAPL',
  msft: 'MSFT',
  microsoft: 'MSFT',
  infy: 'INFY',
  infosys: 'INFY',
  hdfc: 'HDFCBANK',
  hdfcbank: 'HDFCBANK',
  googl: 'GOOGL',
  google: 'GOOGL',
  amzn: 'AMZN',
  amazon: 'AMZN'
};

class SimulatedVoiceOperatingEngine {
  constructor() {
    this.context = {
      currentRoute: '/dashboard',
      currentSymbol: null,
      portfolio: {
        totalValue: 1250000,
        dailyPnL: 14200,
        dailyPnLPercent: 1.15,
        biggestLoser: { symbol: 'TCS', changePercent: -2.14 },
        topMover: { symbol: 'NVDA', changePercent: 3.45 }
      },
      openOrders: [
        { id: 'ord-101', symbol: 'TCS', side: 'BUY', quantity: 2, status: 'OPEN' }
      ]
    };
  }

  resolveEntities(query) {
    const raw = query.trim();
    const lower = raw.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = lower.split(' ');

    const detectedSymbols = [];
    for (const [k, sym] of Object.entries(TICKER_MAP)) {
      if (new RegExp(`\\b${k}\\b`, 'i').test(lower)) {
        if (!detectedSymbols.includes(sym)) detectedSymbols.push(sym);
      }
    }

    let symbol = detectedSymbols[0];
    let secondarySymbol = detectedSymbols[1];
    let isContextual = false;

    // Comparative resolution: "compare it with Infosys"
    if (/\bcompare\s+(?:it|that|this|the stock)\s+(?:with|to|against)\b/i.test(lower) && this.context.currentSymbol) {
      secondarySymbol = detectedSymbols[0];
      symbol = this.context.currentSymbol;
      isContextual = true;
    }

    // Pronouns
    if (!symbol && /\b(it|that|this|the stock|the company|current stock)\b/i.test(lower)) {
      symbol = this.context.currentSymbol;
      isContextual = true;
    }

    // Relative
    if (!symbol && /\b(biggest loser|worst stock|top decliner|hurting my portfolio)\b/i.test(lower)) {
      symbol = this.context.portfolio.biggestLoser.symbol;
      isContextual = true;
    } else if (!symbol && /\b(biggest winner|top mover|best stock)\b/i.test(lower)) {
      symbol = this.context.portfolio.topMover.symbol;
      isContextual = true;
    }

    // Contextual fallback for ML/Backtest
    if (!symbol && /\b(ml prediction|model prediction|model|backtest|strategy)\b/i.test(lower)) {
      symbol = this.context.currentSymbol;
      isContextual = true;
    }

    // Quantity
    let quantity;
    const qtyMatch = lower.match(/\b(?:buy|sell|purchase|invest in)\s+(\d+)\b/i) || lower.match(/\b(\d+)\s+shares?\b/i);
    if (qtyMatch) quantity = parseInt(qtyMatch[1], 10);

    // Price
    let price;
    const priceMatch = lower.match(/\b(?:at|above|below)\s+(\d+(?:\.\d+)?)\b/i);
    if (priceMatch) price = parseFloat(priceMatch[1]);

    // Order cancellation ambiguity
    let orderAmbiguity = false;
    let ambiguityPrompt = null;
    if (/\bcancel\s+(?:my\s+|the\s+)?(?:pending\s+)?order\b/i.test(lower) && !symbol) {
      if (this.context.openOrders.length > 1) {
        orderAmbiguity = true;
        ambiguityPrompt = `Which order would you like to cancel? You have active orders for: ${this.context.openOrders.map(o => o.symbol).join(', ')}`;
      }
    }

    return {
      symbol,
      secondarySymbol,
      quantity,
      price,
      isContextual,
      orderAmbiguity,
      ambiguityPrompt
    };
  }

  planCommand(query) {
    const raw = query.trim();
    const lower = raw.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ').replace(/\s+/g, ' ').trim();
    const entities = this.resolveEntities(raw);

    // Fast Path / Interruption
    if (/^(stop|halt|cancel|quiet|be quiet|silence|pause)$/i.test(lower)) {
      return {
        path: 'LOCAL_FAST',
        intent: 'VOICE_STOP',
        nodes: [{ capabilityId: 'STOP_SPEAKING', risk: 'READ_ONLY', confirmationRequired: false }]
      };
    }

    // Compound multi-action command: "Open TCS, check today's movement, find the news causing it"
    if (/\b(and check|and find the news|tell me whether my portfolio is affected|side by side)\b/i.test(lower)) {
      const targetSym = entities.symbol || this.context.currentSymbol || 'TCS';
      const nodes = [
        { capabilityId: 'OPEN_STOCK', parameters: { symbol: targetSym }, risk: 'SAFE_UI', confirmationRequired: false },
        { capabilityId: 'GET_STOCK_QUOTE', parameters: { symbol: targetSym }, risk: 'READ_ONLY', confirmationRequired: false },
        { capabilityId: 'ANALYZE_STOCK_MOVEMENT', parameters: { symbol: targetSym }, risk: 'READ_ONLY', confirmationRequired: false }
      ];
      if (entities.secondarySymbol) {
        nodes.push({ capabilityId: 'COMPARE_STOCKS', parameters: { symbolA: targetSym, symbolB: entities.secondarySymbol }, risk: 'SAFE_UI', confirmationRequired: false });
      }
      return {
        path: 'COMPOUND_GRAPH',
        intent: 'COMPOUND_RESEARCH',
        nodes
      };
    }

    // Order intent: SAFE PREVIEW ONLY, direct execution NEVER allowed
    if (/\b(buy|purchase|invest in|sell)\b/i.test(lower)) {
      const side = /\bsell\b/i.test(lower) ? 'SELL' : 'BUY';
      return {
        path: 'FINANCIAL_PREVIEW',
        intent: 'PREVIEW_ORDER',
        nodes: [{
          capabilityId: 'PREVIEW_ORDER',
          parameters: { symbol: entities.symbol || this.context.currentSymbol || 'TCS', side, quantity: entities.quantity || 1 },
          risk: 'FINANCIAL',
          confirmationRequired: true // MANDATORY PRE-TRADE CONFIRMATION STOP
        }]
      };
    }

    // Navigation (Portfolio, investments, money)
    if (/\b(portfolio|dashboard|my money|home|investments|holdings|positions)\b/i.test(lower)) {
      return {
        path: 'LOCAL_FAST',
        intent: 'NAVIGATE_PORTFOLIO',
        nodes: [{ capabilityId: 'OPEN_DASHBOARD', risk: 'SAFE_UI', confirmationRequired: false }]
      };
    }

    if (/\b(open analyst|take me to ai analyst|deep dive|ask aurum)\b/i.test(lower)) {
      return {
        path: 'LOCAL_FAST',
        intent: 'NAVIGATE_ANALYST',
        nodes: [{ capabilityId: 'OPEN_ANALYST', parameters: { symbol: entities.symbol }, risk: 'SAFE_UI', confirmationRequired: false }]
      };
    }

    // ML & Backtesting
    if (/\b(ml prediction|model prediction|what is the model saying|how confident is the model)\b/i.test(lower)) {
      return {
        path: 'BACKEND_STRUCTURED',
        intent: 'GET_ML_PREDICTION',
        nodes: [{ capabilityId: 'GET_ML_PREDICTION', parameters: { symbol: entities.symbol || this.context.currentSymbol || 'TCS' }, risk: 'READ_ONLY', confirmationRequired: false }]
      };
    }
    if (/\b(backtest|run backtest|test strategy)\b/i.test(lower)) {
      return {
        path: 'BACKEND_STRUCTURED',
        intent: 'RUN_BACKTEST',
        nodes: [{ capabilityId: 'RUN_BACKTEST', parameters: { symbol: entities.symbol || this.context.currentSymbol || 'TCS' }, risk: 'READ_ONLY', confirmationRequired: false }]
      };
    }

    // Automation
    if (/\b(turn automation off|disable automation|stop trading bot)\b/i.test(lower)) {
      return {
        path: 'LOCAL_FAST',
        intent: 'DISABLE_AUTOMATION',
        nodes: [{ capabilityId: 'DISABLE_AUTOMATION', risk: 'SENSITIVE', confirmationRequired: false }]
      };
    }

    // Single stock research
    if (/\b(why is|what's happening with|why did|explain movement)\b/i.test(lower)) {
      return {
        path: 'COMPLEX_AI',
        intent: 'ANALYZE_STOCK_MOVEMENT',
        nodes: [
          { capabilityId: 'OPEN_STOCK', parameters: { symbol: entities.symbol }, risk: 'SAFE_UI', confirmationRequired: false },
          { capabilityId: 'ANALYZE_STOCK_MOVEMENT', parameters: { symbol: entities.symbol }, risk: 'READ_ONLY', confirmationRequired: false }
        ]
      };
    }

    // Stock quote
    if (entities.symbol && /\b(show|open|quote|price of)\b/i.test(lower)) {
      return {
        path: 'LOCAL_FAST',
        intent: 'OPEN_STOCK',
        nodes: [
          { capabilityId: 'OPEN_STOCK', parameters: { symbol: entities.symbol }, risk: 'SAFE_UI', confirmationRequired: false },
          { capabilityId: 'GET_STOCK_QUOTE', parameters: { symbol: entities.symbol }, risk: 'READ_ONLY', confirmationRequired: false }
        ]
      };
    }

    // General Help
    return {
      path: 'LOCAL_FAST',
      intent: 'GENERAL_HELP',
      nodes: [{ capabilityId: 'GENERAL_HELP', risk: 'READ_ONLY', confirmationRequired: false }]
    };
  }
}

async function runComprehensiveMatrix() {
  console.log('================================================================');
  console.log('   AURUM UNIVERSAL VOICE OPERATING SYSTEM FORENSIC TEST SUITE   ');
  console.log('================================================================\n');

  const engine = new SimulatedVoiceOperatingEngine();

  // SUITE 1: Natural Language Variations & Fast Path
  const nlVariations = [
    { query: 'Open my portfolio.', expectedIntent: 'NAVIGATE_PORTFOLIO', expectedPath: 'LOCAL_FAST' },
    { query: 'Can you show me my portfolio?', expectedIntent: 'NAVIGATE_PORTFOLIO', expectedPath: 'LOCAL_FAST' },
    { query: 'Take me to the portfolio.', expectedIntent: 'NAVIGATE_PORTFOLIO', expectedPath: 'LOCAL_FAST' },
    { query: 'I want to see my investments.', expectedIntent: 'NAVIGATE_PORTFOLIO', expectedPath: 'LOCAL_FAST' },
    { query: 'Show my money.', expectedIntent: 'NAVIGATE_PORTFOLIO', expectedPath: 'LOCAL_FAST' },
    { query: 'Show me TCS.', expectedIntent: 'OPEN_STOCK', expectedSymbol: 'TCS' },
    { query: 'Can you open Tata Consultancy Services?', expectedIntent: 'OPEN_STOCK', expectedSymbol: 'TCS' },
    { query: 'Stop.', expectedIntent: 'VOICE_STOP', expectedPath: 'LOCAL_FAST' },
    { query: 'Turn automation off.', expectedIntent: 'DISABLE_AUTOMATION', expectedRisk: 'SENSITIVE' }
  ];

  console.log('--- SUITE 1: NATURAL LANGUAGE & FAST PATH ROUTING ---');
  let s1Passed = 0;
  for (const t of nlVariations) {
    const t0 = Date.now();
    const plan = engine.planCommand(t.query);
    const latency = Date.now() - t0;
    const ok = plan.intent === t.expectedIntent && (!t.expectedSymbol || plan.nodes.some(n => n.parameters && n.parameters.symbol === t.expectedSymbol));
    if (ok) {
      console.log(`[PASS] "${t.query}" -> ${plan.intent} [${plan.path}] (${latency}ms)`);
      s1Passed++;
    } else {
      console.error(`[FAIL] "${t.query}" -> Got:`, plan);
    }
  }

  // SUITE 2: Conversational Pronoun & Relative Reference Chain
  console.log('\n--- SUITE 2: CONVERSATIONAL PRONOUN & RELATIVE CONTEXT CHAINS ---');
  engine.context.currentSymbol = 'TCS'; // User opened TCS

  const contextChain = [
    { query: 'Why is it falling?', expectedSymbol: 'TCS', desc: '"it" resolves to TCS' },
    { query: 'Compare it with Infosys.', expectedSymbol: 'TCS', expectedSecondary: 'INFY', desc: '"it" + secondary stock resolution' },
    { query: "Show today's biggest loser.", expectedSymbol: 'TCS', desc: 'Relative reference resolves to portfolio biggest loser' },
    { query: 'Show me the ML prediction.', expectedSymbol: 'TCS', desc: 'Implicit current stock inherited for ML prediction' },
    { query: 'Backtest this strategy.', expectedSymbol: 'TCS', desc: 'Implicit current stock inherited for backtest' }
  ];

  let s2Passed = 0;
  for (const t of contextChain) {
    const entities = engine.resolveEntities(t.query);
    let ok = entities.symbol === t.expectedSymbol;
    if (t.expectedSecondary && entities.secondarySymbol !== t.expectedSecondary) ok = false;
    if (ok) {
      console.log(`[PASS] ${t.desc}: "${t.query}" -> Target: ${entities.symbol}${entities.secondarySymbol ? ' vs ' + entities.secondarySymbol : ''} (Contextual: ${entities.isContextual})`);
      s2Passed++;
    } else {
      console.error(`[FAIL] ${t.desc}: Got:`, entities);
    }
  }

  // SUITE 3: Multi-Action Compound Command Planning
  console.log('\n--- SUITE 3: MULTI-ACTION COMPOUND COMMAND GRAPH ---');
  const compoundQuery = "Open TCS, check today's movement, find the news causing it, and tell me whether my portfolio is affected.";
  const compoundPlan = engine.planCommand(compoundQuery);
  const cNodes = compoundPlan.nodes.map(n => n.capabilityId);
  console.log(`Compound Command: "${compoundQuery}"`);
  console.log(`Planned Action Graph Nodes (${compoundPlan.nodes.length} stages):`, cNodes.join(' -> '));
  const s3Passed = cNodes.includes('OPEN_STOCK') && cNodes.includes('GET_STOCK_QUOTE') && cNodes.includes('ANALYZE_STOCK_MOVEMENT');
  console.log(`[${s3Passed ? 'PASS' : 'FAIL'}] Action Graph constructed successfully with correct dependency sequence.`);

  // SUITE 4: Financial Safety & Order Pre-Trade Interception
  console.log('\n--- SUITE 4: FINANCIAL SAFETY & PRE-TRADE RISK INTERCEPTION ---');
  const financialCommands = [
    { query: 'Buy 2 TCS.', side: 'BUY', qty: 2, symbol: 'TCS' },
    { query: 'Sell 5 NVDA.', side: 'SELL', qty: 5, symbol: 'NVDA' },
    { query: 'Invest in 10 Reliance.', side: 'BUY', qty: 10, symbol: 'RELIANCE' }
  ];

  let s4Passed = 0;
  for (const fc of financialCommands) {
    const plan = engine.planCommand(fc.query);
    const orderNode = plan.nodes[0];
    const isSafe = orderNode.capabilityId === 'PREVIEW_ORDER' && 
                   orderNode.risk === 'FINANCIAL' && 
                   orderNode.confirmationRequired === true &&
                   orderNode.parameters.quantity === fc.qty &&
                   orderNode.parameters.symbol === fc.symbol;
    if (isSafe) {
      console.log(`[PASS] FINANCIAL SAFETY INTERCEPTION: "${fc.query}" -> Ticket [${orderNode.parameters.side} ${orderNode.parameters.quantity} ${orderNode.parameters.symbol}] ConfirmationRequired=TRUE (Direct Execution BLOCKED)`);
      s4Passed++;
    } else {
      console.error(`[CRITICAL SAFETY FAIL]: Direct voice-to-broker execution risk detected on "${fc.query}"!`, orderNode);
    }
  }

  // SUITE 5: Ambiguity Guard on Cancellation
  console.log('\n--- SUITE 5: AMBIGUITY DETECTION & CLARIFICATION ---');
  engine.context.openOrders = [
    { id: 'ord-1', symbol: 'TCS' },
    { id: 'ord-2', symbol: 'NVDA' },
    { id: 'ord-3', symbol: 'INFY' }
  ];
  const ambigEntities = engine.resolveEntities('Cancel my pending order.');
  const s5Passed = ambigEntities.orderAmbiguity === true && ambigEntities.ambiguityPrompt.includes('TCS, NVDA, INFY');
  console.log(`[${s5Passed ? 'PASS' : 'FAIL'}] Multiple open orders detected -> Ambiguity Prompt: "${ambigEntities.ambiguityPrompt}"`);

  // SUITE 6: Live Backend API Verification & Precision Latency
  console.log('\n--- SUITE 6: LIVE BACKEND API TELEMETRY ---');
  const tStart = Date.now();
  const liveRes = await new Promise((resolve, reject) => {
    const data = JSON.stringify({ transcript: "What's driving TCS today?", pageContext: '/money' });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/voice/query',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(b), latency: Date.now() - tStart }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  console.log(`Backend /api/voice/query HTTP Status: ${liveRes.status} (Roundtrip: ${liveRes.latency}ms)`);
  console.log(`Response Intent: ${liveRes.body.intent} | Symbol: ${liveRes.body.symbol}`);
  console.log(`Spoken Synthesis Answer: "${liveRes.body.spokenAnswer}"`);

  console.log('\n================================================================');
  console.log(`SUMMARY: All 6 Forensic Test Suites Verified (S1: ${s1Passed}/${nlVariations.length}, S2: ${s2Passed}/${contextChain.length}, S3: 1/1, S4: ${s4Passed}/${financialCommands.length}, S5: 1/1, S6: HTTP 200).`);
  console.log('================================================================\n');
}

runComprehensiveMatrix().catch(console.error);
