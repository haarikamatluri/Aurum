import { Injectable, signal, computed } from '@angular/core';
import { MoneyNotification } from '../models/alert.model';

const STORAGE_KEY = 'money.notifications';

/**
 * Notification service — manages the in-app notification center.
 * Persists to MongoDB cloud database with localStorage offline fallback.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _notifications = signal<MoneyNotification[]>(this.load());

  readonly notifications = this._notifications.asReadonly();

  readonly unreadCount = computed(() =>
    this._notifications().filter((n) => !n.isRead).length
  );

  constructor() {
    this.syncFromDatabase();
  }

  async syncFromDatabase(): Promise<void> {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        const serverNotifs: MoneyNotification[] = data.notifications || [];
        if (serverNotifs.length > 0 || this._notifications().length === 0) {
          this._notifications.set(serverNotifs);
          this.save();
        }
      }
    } catch {
      // offline fallback
    }
  }

  addNotification(n: MoneyNotification): void {
    this._notifications.update((ns) => [n, ...ns]);
    this.save();

    // Persist to MongoDB
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n),
    }).catch(() => {});
  }

  markAsRead(id: string): void {
    this._notifications.update((ns) =>
      ns.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    this.save();

    // Persist to MongoDB
    fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    }).catch(() => {});
  }

  markAllRead(): void {
    this._notifications.update((ns) => ns.map((n) => ({ ...n, isRead: true })));
    this.save();

    // Persist to MongoDB
    fetch('/api/notifications/read-all', {
      method: 'POST',
    }).catch(() => {});
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
