export type RiskTolerance = 'Conservative' | 'Moderate' | 'Aggressive';
export type InvestmentHorizon = '< 1 year' | '1-3 years' | '3-10 years' | '10+ years';
export type InvestmentObjective = 'Capital Preservation' | 'Income' | 'Balanced Growth' | 'Aggressive Growth';
export type ThemePreference = 'dark' | 'light' | 'system';

export interface UserProfile {
  name: string;
  email: string;
  avatarInitials: string;
  memberSince: string;
  accountTier: 'Free' | 'Premium';
}

export interface TargetAllocation {
  sector: string;
  targetPct: number;
}

export interface InvestorProfile {
  riskTolerance: RiskTolerance;
  investmentHorizon: InvestmentHorizon;
  primaryObjective: InvestmentObjective;
  maxDrawdownTolerancePct: number;
  targetAllocations: TargetAllocation[];
}

export interface NotificationSettings {
  priceAlerts: boolean;
  marketAlerts: boolean;
  portfolioAlerts: boolean;
  dailyBriefing: boolean;
  aiAlerts: boolean;
}

export interface AppearanceSettings {
  theme: ThemePreference;
}
