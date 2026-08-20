import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, map, of } from 'rxjs';
import { AlertCategory, AlertItem } from '../models/alert.model';

function minsAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

const INITIAL_ALERTS: AlertItem[] = [
  { id: 'al-1', severity: 'critical', category: 'Price', subject: 'NVDA', message: 'NVDA is down 5.1% today, exceeding your -5% price alert threshold.', timestamp: minsAgo(18), symbol: 'NVDA', read: false },
  { id: 'al-2', severity: 'warning', category: 'Portfolio', subject: 'Portfolio', message: 'Technology allocation (54%) exceeds your 42% target by a wide margin.', timestamp: minsAgo(42), read: false },
  { id: 'al-3', severity: 'info', category: 'Events', subject: 'MSFT', message: 'MSFT reports earnings in 3 days (before market open).', timestamp: minsAgo(70), symbol: 'MSFT', read: false },
  { id: 'al-4', severity: 'warning', category: 'Technical', subject: 'TSLA', message: 'TSLA RSI has crossed into overbought territory (74).', timestamp: minsAgo(95), symbol: 'TSLA', read: true },
  { id: 'al-5', severity: 'info', category: 'Market', subject: 'Market', message: 'VIX fell 4.2% today, signaling reduced near-term volatility expectations.', timestamp: minsAgo(130), read: true },
  { id: 'al-6', severity: 'critical', category: 'Portfolio', subject: 'Portfolio', message: 'Portfolio concentration risk score increased to 78/100 (High).', timestamp: minsAgo(160), read: false },
  { id: 'al-7', severity: 'info', category: 'News', subject: 'AMD', message: 'New analyst coverage initiated on AMD with an Overweight rating.', timestamp: minsAgo(210), symbol: 'AMD', read: true },
  { id: 'al-8', severity: 'warning', category: 'Prediction', subject: 'TSLA', message: 'Model 5-day negative-return probability for TSLA increased to 34%.', timestamp: minsAgo(260), symbol: 'TSLA', read: true },
  { id: 'al-9', severity: 'info', category: 'Events', subject: 'AAPL', message: 'AAPL ex-dividend date is in 6 days.', timestamp: minsAgo(320), symbol: 'AAPL', read: true },
  { id: 'al-10', severity: 'warning', category: 'Technical', subject: 'AMD', message: 'AMD price broke below its 50-day moving average.', timestamp: minsAgo(400), symbol: 'AMD', read: true },
];

/** Alerts / notifications feed. Backs GET/POST /api/alerts. */
@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly alertsSubject = new BehaviorSubject<AlertItem[]>(INITIAL_ALERTS);
  readonly alerts$ = this.alertsSubject.asObservable();

  getAlerts(): Observable<AlertItem[]> {
    return of(this.alertsSubject.value).pipe(delay(260));
  }

  getUnreadCount(): Observable<number> {
    return of(this.alertsSubject.value.filter((a) => !a.read).length).pipe(delay(120));
  }

  filterByCategory(category: AlertCategory | 'All'): Observable<AlertItem[]> {
    return this.getAlerts().pipe(map((alerts) => (category === 'All' ? alerts : alerts.filter((a) => a.category === category))));
  }

  markRead(id: string): Observable<void> {
    this.alertsSubject.next(this.alertsSubject.value.map((a) => (a.id === id ? { ...a, read: true } : a)));
    return of(void 0).pipe(delay(80));
  }

  markAllRead(): Observable<void> {
    this.alertsSubject.next(this.alertsSubject.value.map((a) => ({ ...a, read: true })));
    return of(void 0).pipe(delay(120));
  }

  dismiss(id: string): Observable<void> {
    this.alertsSubject.next(this.alertsSubject.value.filter((a) => a.id !== id));
    return of(void 0).pipe(delay(80));
  }
}
