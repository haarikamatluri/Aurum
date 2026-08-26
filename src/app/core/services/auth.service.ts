import { Injectable, signal, computed } from '@angular/core';

export interface AppUser {
  id: string;
  name: string;
  initials: string;
  avatarInitials: string;
  email: string;
  accountTier: string;
}

const GUEST_USER: AppUser = {
  id: '',
  name: 'Investor',
  initials: 'I',
  avatarInitials: 'I',
  email: '',
  accountTier: 'Free',
};

function toInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function mapUser(raw: any): AppUser {
  return {
    id: raw.id,
    name: raw.name,
    initials: raw.avatarInitials || toInitials(raw.name),
    avatarInitials: raw.avatarInitials || toInitials(raw.name),
    email: raw.email,
    accountTier: raw.accountTier || 'Free',
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body?.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Real authentication against the backend (`/api/auth/*`), session kept in an
 * httpOnly cookie. `bootstrap()` runs once at app startup (see app.config.ts)
 * to restore any existing session before the router's first navigation.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<AppUser | null>(null);
  private readonly _authChecked = signal(false);
  private readonly _googleEnabled = signal(false);
  private readonly _googleClientId = signal<string | null>(null);

  /** Always returns a displayable user — falls back to a guest placeholder while loading/unauthenticated. */
  readonly currentUser = computed(() => this._user() ?? GUEST_USER);
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly authChecked = this._authChecked.asReadonly();
  readonly googleEnabled = this._googleEnabled.asReadonly();
  readonly googleClientId = this._googleClientId.asReadonly();

  /** Called once from an app initializer. Restores session + loads Google config in parallel. */
  async bootstrap(): Promise<void> {
    await Promise.allSettled([this.restoreSession(), this.loadAuthConfig()]);
    this._authChecked.set(true);
  }

  private async restoreSession(): Promise<void> {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const { user } = await res.json();
        this._user.set(mapUser(user));
      } else {
        this._user.set(null);
      }
    } catch {
      this._user.set(null);
    }
  }

  private async loadAuthConfig(): Promise<void> {
    try {
      const res = await fetch('/api/auth/config');
      if (res.ok) {
        const cfg = await res.json();
        this._googleEnabled.set(!!cfg.googleEnabled);
        this._googleClientId.set(cfg.googleClientId ?? null);
      }
    } catch {
      // Google sign-in just stays hidden if config can't be loaded.
    }
  }

  async signup(name: string, email: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Could not create your account'));
    const { user } = await res.json();
    this._user.set(mapUser(user));
  }

  async login(email: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Invalid email or password'));
    const { user } = await res.json();
    this._user.set(mapUser(user));
  }

  async loginWithGoogle(credential: string): Promise<void> {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Google sign-in failed'));
    const { user } = await res.json();
    this._user.set(mapUser(user));
  }

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      this._user.set(null);
    }
  }

  async updateUser(name: string): Promise<void> {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Could not update your profile'));
    const { user } = await res.json();
    this._user.set(mapUser(user));
  }
}
