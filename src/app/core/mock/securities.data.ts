/** Static universe of realistic securities used to synthesize every mock dataset. */
export interface SecurityDef {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  assetType: 'Equity' | 'ETF';
  basePrice: number;
  beta: number;
  marketCap: number;
  description: string;
}

export const SECURITIES: SecurityDef[] = [
  {
    symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors',
    assetType: 'Equity', basePrice: 175.42, beta: 1.68, marketCap: 4_320_000_000_000,
    description: 'Designs GPUs and accelerated-computing platforms powering AI, gaming, and data-center workloads.',
  },
  {
    symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software',
    assetType: 'Equity', basePrice: 431.22, beta: 0.91, marketCap: 3_210_000_000_000,
    description: 'Develops software, cloud services (Azure), and productivity platforms for consumers and enterprises.',
  },
  {
    symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics',
    assetType: 'Equity', basePrice: 224.18, beta: 1.12, marketCap: 3_450_000_000_000,
    description: 'Designs consumer hardware, software, and services including the iPhone, Mac, and App Store ecosystem.',
  },
  {
    symbol: 'AMZN', name: 'Amazon.com, Inc.', sector: 'Consumer Discretionary', industry: 'E-Commerce',
    assetType: 'Equity', basePrice: 186.51, beta: 1.24, marketCap: 1_950_000_000_000,
    description: 'Global e-commerce and cloud computing (AWS) company with a growing advertising business.',
  },
  {
    symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', industry: 'Internet Content & Search',
    assetType: 'Equity', basePrice: 168.34, beta: 1.05, marketCap: 2_080_000_000_000,
    description: 'Parent of Google Search, YouTube, Android, and Google Cloud, with significant AI research investment.',
  },
  {
    symbol: 'META', name: 'Meta Platforms, Inc.', sector: 'Communication Services', industry: 'Internet & Social Media',
    assetType: 'Equity', basePrice: 512.87, beta: 1.31, marketCap: 1_310_000_000_000,
    description: 'Operates Facebook, Instagram, and WhatsApp, investing heavily in AI and the metaverse.',
  },
  {
    symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Consumer Discretionary', industry: 'Automobiles',
    assetType: 'Equity', basePrice: 238.45, beta: 2.14, marketCap: 760_000_000_000,
    description: 'Designs and manufactures electric vehicles, energy storage, and autonomous driving technology.',
  },
  {
    symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', sector: 'Technology', industry: 'Semiconductors',
    assetType: 'Equity', basePrice: 142.67, beta: 1.89, marketCap: 231_000_000_000,
    description: 'Designs CPUs and GPUs for computing, gaming, and data-center AI acceleration.',
  },
  {
    symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials', industry: 'Diversified Banks',
    assetType: 'Equity', basePrice: 218.9, beta: 1.08, marketCap: 620_000_000_000,
    description: 'Global financial services firm offering investment banking, asset management, and consumer banking.',
  },
  {
    symbol: 'V', name: 'Visa Inc.', sector: 'Financials', industry: 'Payment Processing',
    assetType: 'Equity', basePrice: 289.14, beta: 0.96, marketCap: 580_000_000_000,
    description: 'Operates the world’s largest electronic payments network, connecting banks and merchants.',
  },
  {
    symbol: 'UNH', name: 'UnitedHealth Group Inc.', sector: 'Healthcare', industry: 'Managed Health Care',
    assetType: 'Equity', basePrice: 512.3, beta: 0.72, marketCap: 470_000_000_000,
    description: 'Diversified health care company combining insurance (UnitedHealthcare) and services (Optum).',
  },
  {
    symbol: 'LLY', name: 'Eli Lilly and Company', sector: 'Healthcare', industry: 'Pharmaceuticals',
    assetType: 'Equity', basePrice: 812.6, beta: 0.44, marketCap: 770_000_000_000,
    description: 'Pharmaceutical company with a leading portfolio in diabetes, obesity, and oncology treatments.',
  },
  {
    symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy', industry: 'Oil & Gas',
    assetType: 'Equity', basePrice: 118.22, beta: 0.89, marketCap: 490_000_000_000,
    description: 'Integrated energy company engaged in exploration, production, refining, and chemicals.',
  },
  {
    symbol: 'PG', name: 'Procter & Gamble Co.', sector: 'Consumer Staples', industry: 'Household Products',
    assetType: 'Equity', basePrice: 168.77, beta: 0.4, marketCap: 398_000_000_000,
    description: 'Multinational consumer goods company with brands spanning personal care and household products.',
  },
  {
    symbol: 'QQQ', name: 'Invesco QQQ Trust', sector: 'Diversified', industry: 'Index ETF',
    assetType: 'ETF', basePrice: 481.2, beta: 1.15, marketCap: 320_000_000_000,
    description: 'Tracks the Nasdaq-100 Index, offering broad exposure to large-cap growth and technology names.',
  },
];

export const SECURITY_MAP: Record<string, SecurityDef> = Object.fromEntries(
  SECURITIES.map((s) => [s.symbol, s]),
);

export function getSecurity(symbol: string): SecurityDef {
  const sec = SECURITY_MAP[symbol];
  if (!sec) throw new Error(`Unknown mock security: ${symbol}`);
  return sec;
}

export const SECTORS = Array.from(new Set(SECURITIES.map((s) => s.sector)));
