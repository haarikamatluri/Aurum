import { NewsArticle } from '../models/news.model';

function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    id: 'news-1', headline: 'NVIDIA extends rally as data-center demand forecasts raised again',
    summary: 'Analysts lifted price targets after channel checks pointed to sustained hyperscaler capex into next year, with several desks flagging supply constraints as the primary risk.',
    source: 'MarketWire', publishedAt: hoursAgo(2), symbols: ['NVDA', 'AMD'], sentiment: 'positive', category: 'Analyst Rating',
  },
  {
    id: 'news-2', headline: 'Fed officials signal patience on rate path amid sticky services inflation',
    summary: 'Commentary from two regional presidents pushed back on near-term cut expectations, adding modest pressure to long-duration growth names.',
    source: 'Macro Daily', publishedAt: hoursAgo(4), symbols: [], sentiment: 'negative', category: 'Macro',
  },
  {
    id: 'news-3', headline: 'Microsoft Azure growth reaccelerates on AI workload adoption',
    summary: 'Enterprise AI consumption continues to outpace prior guidance, with management citing broadening adoption beyond early pilot programs.',
    source: 'TechLedger', publishedAt: hoursAgo(6), symbols: ['MSFT'], sentiment: 'positive', category: 'Earnings',
  },
  {
    id: 'news-4', headline: 'Tesla deliveries miss consensus as price competition intensifies',
    summary: 'Regional delivery data came in below Street estimates, reviving margin-compression concerns heading into the next print.',
    source: 'AutoBeat', publishedAt: hoursAgo(9), symbols: ['TSLA'], sentiment: 'negative', category: 'Company',
  },
  {
    id: 'news-5', headline: 'Semiconductor sector broadly higher on export-policy clarity',
    summary: 'Chipmakers rose after regulators clarified licensing terms, reducing near-term uncertainty around advanced-node export rules.',
    source: 'MarketWire', publishedAt: hoursAgo(11), symbols: ['NVDA', 'AMD'], sentiment: 'positive', category: 'Markets',
  },
  {
    id: 'news-6', headline: 'Apple supplier checks point to steady iPhone demand into the holiday quarter',
    summary: 'Component order data suggests build volumes are tracking in line with seasonal norms, easing concerns of a sharper slowdown.',
    source: 'SupplyChain Insider', publishedAt: hoursAgo(14), symbols: ['AAPL'], sentiment: 'neutral', category: 'Company',
  },
  {
    id: 'news-7', headline: 'UnitedHealth reaffirms guidance as medical cost trends stabilize',
    summary: 'Management reiterated full-year targets, noting utilization trends have leveled off after several quarters of elevated cost pressure.',
    source: 'HealthWire', publishedAt: hoursAgo(18), symbols: ['UNH'], sentiment: 'positive', category: 'Earnings',
  },
  {
    id: 'news-8', headline: 'Treasury yields tick higher ahead of upcoming auction supply',
    summary: 'The 10-year yield edged up as the market digested a heavier-than-usual auction calendar, weighing modestly on rate-sensitive sectors.',
    source: 'Macro Daily', publishedAt: hoursAgo(21), symbols: [], sentiment: 'negative', category: 'Macro',
  },
  {
    id: 'news-9', headline: 'Meta expands AI infrastructure spend, flags margin trade-off',
    summary: 'The company raised its full-year capex outlook to support model training, prompting mixed analyst reaction on near-term profitability.',
    source: 'TechLedger', publishedAt: hoursAgo(26), symbols: ['META'], sentiment: 'neutral', category: 'Earnings',
  },
  {
    id: 'news-10', headline: 'Financials outperform as yield curve steepens',
    summary: 'Regional and money-center banks advanced as the steeper curve improved forward net-interest-margin expectations.',
    source: 'MarketWire', publishedAt: hoursAgo(30), symbols: ['JPM', 'V'], sentiment: 'positive', category: 'Markets',
  },
];
