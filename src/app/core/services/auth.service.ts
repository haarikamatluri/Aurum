import { Injectable, signal, computed } from '@angular/core';

export interface AppUser {
  name: string;
  initials: string;
}

const DEFAULT_USER: AppUser = { name: 'Investor', initials: 'I' };
const STORAGE_KEY = 'money.user';

/**
 * Auth service — authentication deferred to a later phase.
 * The app is always accessible. User profile is persisted in localStorage.
 * When real auth is added, swap the internals of this service — no component changes needed.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<AppUser>(this.loadUser());

  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => true); // Always authenticated for now

  updateUser(name: string): void {
    const initials = name
      .split(' ')
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2);
    const user: AppUser = { name, initials };
    this._user.set(user);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); } catch { /* ignore */ }
  }

  private loadUser(): AppUser {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_USER;
    } catch { return DEFAULT_USER; }
  }
}
