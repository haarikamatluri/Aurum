import { Injectable, signal, computed } from '@angular/core';
import { MoneyNotification } from '../models/alert.model';

const STORAGE_KEY = 'money.notifications';

/**
 * Notification service — manages the in-app notification center.
 * Persists to localStorage. Ready for WebSocket/SSE push later.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _notifications = signal<MoneyNotification[]>(this.load());

  readonly notifications = this._notifications.asReadonly();

  readonly unreadCount = computed(() =>
    this._notifications().filter((n) => !n.isRead).length
  );

  addNotification(n: MoneyNotification): void {
    this._notifications.update((ns) => [n, ...ns]);
    this.save();
  }

  markAsRead(id: string): void {
    this._notifications.update((ns) =>
      ns.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    this.save();
  }

  markAllRead(): void {
    this._notifications.update((ns) => ns.map((n) => ({ ...n, isRead: true })));
    this.save();
  }

  /** Remove all notifications for a holding (called on holding delete). */
  removeForHolding(holdingId: string): void {
    this._notifications.update((ns) => ns.filter((n) => n.holdingId !== holdingId));
    this.save();
  }

  getForSymbol(symbol: string): MoneyNotification[] {
    return this._notifications().filter((n) => n.symbol === symbol);
  }

  private load(): MoneyNotification[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._notifications()));
    } catch { /* ignore */ }
  }
}
