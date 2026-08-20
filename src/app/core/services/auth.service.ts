import { Injectable, computed, signal } from '@angular/core';
import { Observable, delay, of, tap } from 'rxjs';
import { UserProfile } from '../models/user.model';

const DEMO_USER: UserProfile = {
  name: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  avatarInitials: 'AM',
  memberSince: '2022-03-14T00:00:00.000Z',
  accountTier: 'Premium',
};

const STORAGE_KEY = 'pi.auth.session';

/**
 * Mock authentication gate. Persists a lightweight session flag in localStorage so refreshes
 * don't bounce back to /login. Swap the internals for a real ASP.NET Core auth flow later —
 * the public surface (isAuthenticated, login, logout, currentUser) stays the same.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authenticated = signal<boolean>(this.readSession());
  private readonly user = signal<UserProfile>(DEMO_USER);

  readonly isAuthenticated = computed(() => this.authenticated());
  readonly currentUser = computed(() => this.user());

  private readSession(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return true; // storage unavailable — default to authenticated for demo purposes
    }
  }

  login(email: string, _password: string): Observable<UserProfile> {
    const user: UserProfile = { ...DEMO_USER, email: email || DEMO_USER.email };
    return of(user).pipe(
      delay(500),
      tap((u) => {
        this.user.set(u);
        this.authenticated.set(true);
        try {
          localStorage.setItem(STORAGE_KEY, '1');
        } catch {
          /* ignore */
        }
      }),
    );
  }

  logout(): void {
    this.authenticated.set(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
