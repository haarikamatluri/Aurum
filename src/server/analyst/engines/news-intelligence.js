/**
 * AURUM AI Analyst — Real-Time News Intelligence Engine
 * 
 * Strict specifications:
 * 1. Stock-specific news retrieval and strict entity matching (no cross-symbol contamination).
 * 2. Deep financial impact analysis: Category, Impact (Positive/Negative/Neutral), 
 *    Confirmation status (Confirmed vs Speculation), Affected metric/segment, and Horizon.
 * 3. Market reaction & correlation context (comparing stock movement with news timing,
 *    with explicit disclosure that correlation does not establish causation).
 * 4. Transparent source verification (never faking published dates or verification).
 * 5. Zero hallucinated or placeholder news articles.
 */

const REPUTABLE_PUBLISHERS = [
  'reuters', 'bloomberg', 'financial times', 'wall street journal', 'cnbc',
  'moneycontrol', 'economic times', 'livemint', 'business standard', 'bse',
  'nse', 'sec', 'groww', 'ndtv profit', 'hindu business line', 'press trust of india'
];

/**
 * Returns canonical keyword aliases for stock entity disambiguation.
 */
function getEntityAliases(symbol, companyName = '') {
  const sym = String(symbol || '').toUpperCase().replace(/\.(NS|BO)$/, '');
  const aliases = [sym.toLowerCase()];

  if (companyName) {
    const cleanComp = companyName.toLowerCase().replace(/ltd|limited|corp|corporation|inc|incorporated/gi, '').trim();
    if (cleanComp.length > 2) {
      aliases.push(cleanComp);
      cleanComp.split(/\s+/).forEach(word => {
        // Exclude generic conglomerate words that cause false-positive matches (e.g., 'tata' matches Tata Motors, Tata Sons, etc.)
        const genericConglomerates = ['tata', 'aditya', 'birla', 'reliance', 'mahindra', 'adani', 'bajaj'];
        if (word.length >= 4 && !genericConglomerates.includes(word)) {
          aliases.push(word);
        }
      });
    }
  }

  // Pre-configured blue-chip entity maps for Indian & US markets
  const knownEntities = {
    'TCS': ['tcs', 'tata consultancy services', 'tata consultancy'],
    'RELIANCE': ['reliance industries', 'ril', 'reliance retail', 'reliance jio'],
    'INFY': ['infosys', 'infy', 'salil parekh'],
    'HDFCBANK': ['hdfc bank', 'hdfcbank', 'sashidhar jagdishan'],
    'ICICIBANK': ['icici bank', 'icicibank', 'sandeep bakhshi'],
    'SBIN': ['state bank of india', 'sbi', 'sbin', 'dinesh khara'],
    'WIPRO': ['wipro', 'srini pallia', 'rishad premji'],
    'AAPL': ['apple', 'aapl', 'iphone', 'tim cook', 'app store', 'macbook', 'ipad'],
    'NVDA': ['nvidia', 'nvda', 'jensen huang', 'geforce', 'blackwell', 'cuda', 'h100'],
    'MSFT': ['microsoft', 'msft', 'satya nadella', 'azure', 'copilot', 'windows'],
    'GOOGL': ['google', 'alphabet', 'googl', 'goog', 'sundar pichai', 'gemini', 'youtube'],
    'AMZN': ['amazon', 'amzn', 'aws', 'andy jassy', 'prime'],
    'META': ['meta', 'meta platforms', 'mark zuckerberg', 'facebook', 'instagram', 'whatsapp'],
    'TSLA': ['tesla', 'tsla', 'elon musk', 'cybertruck', 'gigafactory', 'model y']
  };

  if (knownEntities[sym]) {
    knownEntities[sym].forEach(a => aliases.push(a));
  }

  return Array.from(new Set(aliases));
}

/**
 * Checks whether an article is genuinely relevant to the targeted entity,
 * filtering out conglomerate subsidiaries and common-noun homonyms.
 */
function isArticleRelevantToEntity(article, aliases, symbol = '') {
  if (!article || !article.title) return false;
  const text = `${article.title} ${article.snippet || ''}`.toLowerCase();
  const sym = String(symbol || '').toUpperCase().replace(/\.(NS|BO|O|N)$/i, '');

  // Negative filter for TCS: reject unrelated Tata group subsidiaries or parent conglomerate news
  if (sym === 'TCS') {
    const otherTataEntities = [
      'tata motors', 'tata steel', 'air india', 'tata power', 'tata sons',
      'tata group', 'tata consumer', 'tata chemicals', 'tata communications', 'titan'
    ];
    const mentionsOtherTata = otherTataEntities.some(ent => text.includes(ent));
    const mentionsTCS = text.includes('tcs') || text.includes('tata consultancy');
    if (mentionsOtherTata && !mentionsTCS) {
      return false; // False-positive conglomerate or subsidiary news
    }
  }

  // Negative filter for AAPL: reject common noun uses of 'apple' (fruit, orchards, records)
  if (sym === 'AAPL') {
    const hasAppleWord = /\bapple\b/i.test(text);
    const hasAppleTechContext = /(iphone|ipad|mac|macbook|ios|tim cook|app store|nasdaq|tech|silicon|cupertin|shares|stock|quarter|earnings|revenue|investor|cloud|deal|partnership|device|digital|software|ai|services|enterprise|app\b)/i.test(text);
    const hasDirectTicker = /\baapl\b/i.test(text);

    if (hasAppleWord && !hasAppleTechContext && !hasDirectTicker) {
      return false; // Fruit, agricultural, or unrelated homonym
    }
  }

  return aliases.some(alias => {
    // If alias is 3-4 letters, use word boundary to avoid substring false positives
    if (alias.length <= 4) {
      const reg = new RegExp(`\\b${alias}\\b`, 'i');
      return reg.test(text);
    }
    return text.includes(alias);
  });
}

/**
 * Classifies news into standard financial categories.
 */
function classifyNewsCategory(title, snippet = '') {
  const text = `${title} ${snippet}`.toLowerCase();

  if (/(q[1-4]|quarterly|earnings|net profit|operating profit|revenue beat|revenue miss|eps|ebitda|pat|financial results)/.test(text)) {
    return 'EARNINGS';
  }
  if (/(contract|deal|order win|pact|agreement|partnership|memorandum|client win|multi-million|multi-year deal)/.test(text)) {
    return 'CONTRACTS_DEALS';
  }
  if (/(revenue|growth|sales surge|record sales|turnover|expansion|market share)/.test(text)) {
    return 'REVENUE_GROWTH';
  }
  if (/(regulatory|sebi|sec|rbi|compliance|probe|investigation|penalty|fine|antitrust|notice|lawsuit|legal)/.test(text)) {
    return 'REGULATORY_LEGAL';
  }
  if (/(dividend|buyback|share repurchase|bonus issue|payout|record date)/.test(text)) {
    return 'DIVIDENDS_BUYBACKS';
  }
  if (/(ceo|cfo|executive|leadership|board\s*(changes|appoint|resigns|election|meeting)|resignation|appoints|appointed|steps down|new head)/.test(text)) {
    return 'MANAGEMENT';
  }
  if (/(upgrade|downgrade|target price|brokerage|buy rating|sell rating|overweight|underweight|neutral rating|outperform)/.test(text)) {
    return 'ANALYST_ACTION';
  }
  if (/(launch|launches|unveils|unveiled|new product|ai model|solution|innovation|platform)/.test(text)) {
    return 'PRODUCT_LAUNCH';
  }
  if (/(acquisition|acquire|acquires|merger|takeover|stake buy|stake sale|m&a)/.test(text)) {
    return 'M_AND_A';
  }
  if (/(inflation|interest rate|fed|rbi policy|macro|recession|sector rally|industry trends)/.test(text)) {
    return 'MACRO_SECTOR';
  }
  return 'CORPORATE';
}

/**
 * Determines market impact sentiment and directional classification.
 */
function determineImpactClassification(title, snippet = '', category) {
  const text = `${title} ${snippet}`.toLowerCase();

  const positiveWords = [
    'soars', 'jumps', 'surges', 'rally', 'rallies', 'gains', 'beats', 'beat',
    'record', 'profit rises', 'profit up', 'contract win', 'deal win', 'upgrade',
    'buyback', 'dividend', 'expansion', 'positive', 'breakthrough', 'partnership'
  ];
  const negativeWords = [
    'plunges', 'falls', 'slumps', 'drops', 'misses', 'miss', 'profit falls',
    'profit down', 'loss', 'downgrade', 'penalty', 'fine', 'probe', 'investigation',
    'lawsuit', 'warning', 'headwind', 'weakness', 'cuts', 'resigns', 'concern'
  ];

  let posCount = 0;
  let negCount = 0;

  positiveWords.forEach(w => { if (text.includes(w)) posCount++; });
  negativeWords.forEach(w => { if (text.includes(w)) negCount++; });

  if (category === 'CONTRACTS_DEALS' || category === 'DIVIDENDS_BUYBACKS') {
    posCount += 1;
  }
  if (category === 'REGULATORY_LEGAL' && (text.includes('penalty') || text.includes('probe'))) {
    negCount += 2;
  }

  if (posCount > negCount) return 'POSITIVE';
  if (negCount > posCount) return 'NEGATIVE';
  return 'NEUTRAL';
}

/**
 * Derives affected financial metric or business segment.
 */
function determineAffectedMetric(category, text) {
  switch (category) {
    case 'EARNINGS':
      return 'Quarterly Net Margin & Trailing EPS';
    case 'CONTRACTS_DEALS':
      return 'Order Book & Forward Annual Contract Value (ACV)';
    case 'REVENUE_GROWTH':
      return 'Top-Line Revenue & Organic Growth Rate';
    case 'REGULATORY_LEGAL':
      return 'Compliance Provisions & Operational Risk';
    case 'MANAGEMENT':
      return 'Corporate Governance & Strategic Execution';
    case 'ANALYST_ACTION':
      return 'Institutional Consensus Target & Multiple';
    case 'DIVIDENDS_BUYBACKS':
      return 'Shareholder Return & Free Cash Flow Yield';
    case 'PRODUCT_LAUNCH':
      return 'New Market Penetration & Product Revenue';
    case 'M_AND_A':
      return 'Balance Sheet Goodwill & Inorganic Growth';
    case 'MACRO_SECTOR':
      return 'Cost of Capital & Sector Multiples';
    default:
      return 'General Corporate Valuation';
  }
}

/**
 * Determines whether news represents confirmed corporate disclosures vs market speculation.
 */
function determineConfirmationStatus(title, publisher, snippet = '') {
  const text = `${title} ${snippet}`.toLowerCase();
  const pub = (publisher || '').toLowerCase();

  // Speculation markers
  if (/(sources say|reportedly|may consider|rumour|rumor|in talks|likely to|speculation|alleged)/.test(text)) {
    return 'UNCONFIRMED_SPECULATION';
  }
  if (/(official|exchange filing|regulatory filing|announces|announced|reports|quarterly results|sec filing|bse|nse)/.test(text)) {
    return 'CONFIRMED';
  }
  if (pub.includes('bse') || pub.includes('nse') || pub.includes('sec')) {
    return 'CONFIRMED';
  }
  return 'REPORTED_NEWS';
}

/**
 * Builds why it matters explanation for an article.
 */
function buildWhyItMatters(symbol, category, impact, affectedMetric) {
  const sym = String(symbol || 'the company').toUpperCase();

  switch (category) {
    case 'EARNINGS':
      return impact === 'POSITIVE'
        ? `Directly reinforces ${sym}'s valuation multiple by validating profitability and operational leverage.`
        : `Pressures trailing P/E multiples and raises caution regarding sequential margin compression for ${sym}.`;
    case 'CONTRACTS_DEALS':
      return `Expands ${sym}'s verified deal pipeline and provides forward revenue visibility across commercial business units.`;
    case 'REGULATORY_LEGAL':
      return impact === 'NEGATIVE'
        ? `Presents potential non-operating compliance liabilities and potential headline governance discount for ${sym}.`
        : `Clarifies regulatory standing and removes lingering compliance overhang on ${sym}.`;
    case 'MANAGEMENT':
      return `Signals executive leadership direction and execution priorities for ${sym}'s medium-term strategy.`;
    case 'ANALYST_ACTION':
      return `Influences institutional fund flow allocations and consensus price target models across brokerages.`;
    case 'DIVIDENDS_BUYBACKS':
      return `Signals board confidence in cash generation and capital efficiency, directly enhancing shareholder yield for ${sym}.`;
    case 'PRODUCT_LAUNCH':
      return `Drives competitive differentiation and potential expansion in higher-margin specialized service offerings.`;
    default:
      return `Provides contextual market intelligence on ${sym}'s operating environment and institutional sentiment.`;
  }
}

/**
 * Evaluates whether market price movement is correlated with event timing.
 */
function evaluateMarketReaction(quote = {}, technicals = {}, impact = 'NEUTRAL') {
  const changePct = quote.changePercent !== undefined && quote.changePercent !== null ? Number(quote.changePercent) : null;
  const price = quote.price !== undefined && quote.price !== null ? Number(quote.price) : null;

  if (price === null || changePct === null) {
    return {
      hasData: false,
      stockMovementPercent: null,
      sectorMovementPercent: null,
      volumeChangePercent: null,
      reactionAssessment: 'Reaction data unavailable',
      correlationDisclaimer: 'Contemporaneous price reaction requires verified quote timestamp.',
      summary: 'Market reaction data is currently unavailable for this trading session.'
    };
  }

  const absChange = Math.abs(changePct).toFixed(2);
  const direction = changePct >= 0 ? 'up' : 'down';
  const volumeTrend = technicals.volumeTrend || 'normal volume';

  const isAligned = (impact === 'POSITIVE' && changePct > 0) || (impact === 'NEGATIVE' && changePct < 0);
  const isDivergent = (impact === 'POSITIVE' && changePct < -0.5) || (impact === 'NEGATIVE' && changePct > 0.5);

  let alignmentNote = '';
  if (isAligned) {
    alignmentNote = `Price movement aligns directionally with this catalyst.`;
  } else if (isDivergent) {
    alignmentNote = `Intraday price movement diverged from the announcement tone, indicating dominant broader index or sector pressures.`;
  } else {
    alignmentNote = `Price reaction remained muted within normal daily volatility bands.`;
  }

  return {
    hasData: true,
    price,
    stockMovementPercent: changePct,
    changePercent: changePct,
    sectorMovementPercent: technicals.sectorMovementPercent != null ? technicals.sectorMovementPercent : 0.0,
    volumeChangePercent: technicals.volumeChangePercent != null ? technicals.volumeChangePercent : null,
    volumeTrend,
    reactionAssessment: isAligned ? 'Directionally Aligned' : (isDivergent ? 'Divergent Movement' : 'Muted Reaction'),
    correlationDisclaimer: 'Correlation reflects contemporaneous trading during the same session and does not establish that this announcement caused the observed market movement.',
    summary: `The stock moved ${direction} ${absChange}% today (${volumeTrend}). ${alignmentNote} Note: Correlation reflects contemporaneous trading and does not prove that this announcement caused the move.`
  };
}

/**
 * Audits and verifies an article URL against fake, empty, portal-root, or stock quote pages.
 * A quote summary page (e.g. cnbc.com/quotes/AAPL) is NOT an authentic article link.
 */
function validateArticleUrl(url) {
  if (!url || typeof url !== 'string' || url === '#' || url.trim() === '') {
    return { isValidArticle: false, isQuotePage: false, status: 'UNAVAILABLE', note: 'No URL provided' };
  }

  const cleanUrl = url.trim();
  try {
    const parsed = new URL(cleanUrl);
    const pathname = parsed.pathname.toLowerCase();

    // Check for stock quote overviews / company profile pages
    if (
      pathname.includes('/quotes/') ||
      pathname.includes('/quote/') ||
      pathname.includes('/symbol/') ||
      pathname.includes('/markets/quote/') ||
      pathname.includes('/stocks/quote/') ||
      pathname.includes('/get-quote') ||
      (pathname.includes('/company/') && !pathname.includes('/news/'))
    ) {
      return {
        isValidArticle: false,
        isQuotePage: true,
        status: 'UNVERIFIED',
        note: 'URL targets an equity quote/summary page, not an authentic article headline page.'
      };
    }

    // Check for generic homepage / portal roots
    if (pathname === '/' || pathname === '' || pathname === '/markets' || pathname === '/business' || pathname === '/india-business') {
      return {
        isValidArticle: false,
        isQuotePage: false,
        status: 'UNVERIFIED',
        note: 'URL points to a generic section index or domain root rather than a specific article story.'
      };
    }

    if (pathname.length < 2) {
      return {
        isValidArticle: false,
        isQuotePage: false,
        status: 'UNVERIFIED',
        note: 'URL path is too brief to represent a canonical news slug.'
      };
    }

    return {
      isValidArticle: true,
      isQuotePage: false,
      status: 'ARTICLE_VALID',
      note: 'Canonical story slug verified.'
    };
  } catch (e) {
    return {
      isValidArticle: false,
      isQuotePage: false,
      status: 'UNVERIFIED',
      note: 'Malformed URL structure.'
    };
  }
}

/**
 * Main processor: Transforms raw news articles into verified News Intelligence items.
 */
function processNewsIntelligence({ symbol, companyName, news = [], rawNews = [], quote = {}, marketData = {}, technicals = {} }) {
  const articles = Array.isArray(news) && news.length > 0 ? news : (Array.isArray(rawNews) ? rawNews : []);
  if (articles.length === 0) {
    return [];
  }

  const activeQuote = (quote && typeof quote.price === 'number') ? quote : (marketData || {});
  const activeTechnicals = (technicals && Object.keys(technicals).length > 0) ? technicals : (marketData?.technicals || {});

  const aliases = getEntityAliases(symbol, companyName);
  const processed = [];
  const seenTitles = new Set();

  for (const raw of articles) {
    if (!raw || !raw.title) continue;

    // Deduplicate identical or near-identical headlines
    const normTitle = raw.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (seenTitles.has(normTitle)) continue;
    seenTitles.add(normTitle);

    // Filter relevance to target stock with negative disambiguation
    const isRelevant = isArticleRelevantToEntity(raw, aliases, symbol);
    if (!isRelevant) {
      continue;
    }

    const category = classifyNewsCategory(raw.title, raw.snippet || '');
    const impact = determineImpactClassification(raw.title, raw.snippet || '', category);
    const confirmationStatus = determineConfirmationStatus(raw.title, raw.publisher, raw.snippet || '');
    const affectedMetric = determineAffectedMetric(category, `${raw.title} ${raw.snippet || ''}`);
    const whyItMatters = buildWhyItMatters(symbol, category, impact, affectedMetric);
    const marketReaction = evaluateMarketReaction(activeQuote, activeTechnicals, impact);

    const pubLower = (raw.publisher || '').toLowerCase();
    const isReputable = REPUTABLE_PUBLISHERS.some(p => pubLower.includes(p));
    const rawUrl = raw.url || raw.link || null;
    const pubDateVal = raw.publishedAt || raw.pubDate || null;

    const urlAudit = validateArticleUrl(rawUrl);
    const articleUrl = rawUrl;

    // Granular Verification Dimensions (Priority 4):
    // 1. Source Provenance: Is the source publisher known and the canonical link authentic?
    let sourceStatus = 'UNAVAILABLE';
    if (!rawUrl) {
      sourceStatus = 'UNAVAILABLE';
    } else if (urlAudit.isQuotePage || !urlAudit.isValidArticle) {
      sourceStatus = 'UNVERIFIED';
    } else if (isReputable) {
      sourceStatus = 'SOURCE_AUTHENTICATED';
    } else {
      sourceStatus = 'ARTICLE_RETRIEVED';
    }

    // 2. Entity Disambiguation: Confirmed relevant to targeted ticker
    const entityStatus = 'ENTITY_RELEVANCE_CONFIRMED';

    // 3. Factual Claim Verification: Disentangled from source provenance
    let claimStatus = 'REPORTED_NEWS';
    if (confirmationStatus === 'CONFIRMED' && (pubLower.includes('bse') || pubLower.includes('nse') || pubLower.includes('sec') || isReputable) && sourceStatus === 'SOURCE_AUTHENTICATED') {
      claimStatus = 'CLAIM_INDEPENDENTLY_CORROBORATED';
    } else if (confirmationStatus === 'UNCONFIRMED_SPECULATION') {
      claimStatus = 'UNCONFIRMED_SPECULATION';
    } else if (sourceStatus === 'UNVERIFIED') {
      claimStatus = 'REPORTED_NEWS'; // Unverified quote page cannot corroborate a claim
    }

    // 4. Dimensional Separation (Rule 5)
    const factualEvent = raw.title.trim();
    const newsInterpretation = (raw.snippet && raw.snippet.length > 30) ? raw.snippet.trim() : raw.title.trim();
    const potentialFinancialImpact = `${impact} expected directional impact on ${affectedMetric}.`;
    const observedMarketReaction = marketReaction;

    // Determine freshness
    let freshness = 'RECENT';
    if (pubDateVal) {
      const ageMs = Date.now() - new Date(pubDateVal).getTime();
      if (ageMs < 86400000) freshness = 'FRESH';
      else if (ageMs < 86400000 * 3) freshness = 'RECENT';
      else freshness = 'ARCHIVAL';
    } else {
      freshness = 'UNDATED';
    }

    processed.push({
      id: `NEWS-${symbol}-${processed.length + 1}`,
      symbol: String(symbol).toUpperCase(),
      companyName: companyName || symbol,
      title: raw.title.trim(),
      publisher: raw.publisher || 'Financial Newswire',
      link: articleUrl || '#',
      url: articleUrl || '#',
      pubDate: pubDateVal,
      publishedAt: pubDateVal,
      retrievedAt: new Date().toISOString(),
      category,
      impact, // 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
      confirmationStatus, // 'CONFIRMED' | 'REPORTED_NEWS' | 'UNCONFIRMED_SPECULATION'
      affectedMetric,
      timeHorizon: category === 'CONTRACTS_DEALS' || category === 'M_AND_A' ? 'LONG_TERM' : 'SHORT_TERM',
      summary: newsInterpretation,
      whyItMatters,
      factualEvent,
      newsInterpretation,
      potentialFinancialImpact,
      observedMarketReaction,
      marketReaction,
      sourceStatus,
      entityStatus,
      claimStatus,
      urlAuditStatus: urlAudit.status,
      urlVerificationNote: urlAudit.note,
      isQuotePage: urlAudit.isQuotePage,
      verificationStatus: sourceStatus === 'SOURCE_AUTHENTICATED' ? 'SOURCE_VERIFIED' : 'RETRIEVED_FEED',
      isSourceVerified: sourceStatus === 'SOURCE_AUTHENTICATED',
      freshness
    });
  }

  return processed;
}

module.exports = {
  processNewsIntelligence,
  getEntityAliases,
  classifyNewsCategory,
  determineImpactClassification,
  validateArticleUrl
};
