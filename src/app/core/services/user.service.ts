import { Injectable, signal } from '@angular/core';
import { Observable, delay, of, tap } from 'rxjs';
import { InvestorProfile, NotificationSettings } from '../models/user.model';

const DEFAULT_INVESTOR_PROFILE: InvestorProfile = {
  riskTolerance: 'Moderate',
  investmentHorizon: '3-10 years',
  primaryObjective: 'Balanced Growth',
  maxDrawdownTolerancePct: 20,
  targetAllocations: [
    { sector: 'Technology', targetPct: 42 },
    { sector: 'Healthcare', targetPct: 14 },
    { sector: 'Financials', targetPct: 14 },
    { sector: 'Consumer Discretionary', targetPct: 10 },
    { sector: 'Communication Services', targetPct: 10 },
    { sector: 'Energy', targetPct: 5 },
    { sector: 'Consumer Staples', targetPct: 5 },
  ],
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  priceAlerts: true,
  marketAlerts: true,
  portfolioAlerts: true,
  dailyBriefing: true,
  aiAlerts: false,
};

/** Investor profile & notification preferences. Backs future GET/PUT /api/settings/*. */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly investorProfileSignal = signal<InvestorProfile>(DEFAULT_INVESTOR_PROFILE);
  private readonly notificationsSignal = signal<NotificationSettings>(DEFAULT_NOTIFICATIONS);

  readonly investorProfile = this.investorProfileSignal.asReadonly();
  readonly notifications = this.notificationsSignal.asReadonly();

  getInvestorProfile(): Observable<InvestorProfile> {
    return of(this.investorProfileSignal()).pipe(delay(220));
  }

  saveInvestorProfile(profile: InvestorProfile): Observable<InvestorProfile> {
    return of(profile).pipe(delay(400), tap((p) => this.investorProfileSignal.set(p)));
  }

  getNotificationSettings(): Observable<NotificationSettings> {
    return of(this.notificationsSignal()).pipe(delay(180));
  }

  saveNotificationSettings(settings: NotificationSettings): Observable<NotificationSettings> {
    return of(settings).pipe(delay(300), tap((s) => this.notificationsSignal.set(s)));
  }
}
