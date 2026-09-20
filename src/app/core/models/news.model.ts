export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string;
  symbols: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  category: 'Earnings' | 'Markets' | 'Company' | 'Macro' | 'Analyst Rating';
}
