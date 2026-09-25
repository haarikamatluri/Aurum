import { Injectable, signal, computed } from '@angular/core';

export interface AppUser {
  id: string;
  name: string;
  initials: string;
  avatarInitials: string;
  email: string;
  accountTier: string;
  twoFactorEnabled?: boolean;
  zerodhaConnected?: boolean;
  webullConnected?: boolean;
}

const GUEST_USER: AppUser = {
  id: 'demo-user',
  name: 'Investor',
  initials: 'I',
  avatarInitials: 'I',
  email: 'investor@aurum.local',
  accountTier: 'Pro',
  twoFactorEnabled: false,
  zerodhaConnected: false,
  webullConnected: false,
};

function toInitials(name?: string): string {
  if (!name) return 'I';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'I';
  return parts
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'I';
}

function mapUser(raw: any): AppUser {
  if (!raw) return GUEST_USER;
  const name = raw.name || raw.displayName || 'Investor';
  const email = raw.email || 'investor@aurum.local';
  const initials = raw.avatarInitials || raw.initials || toInitials(name);
  return {
    id: raw.id || raw._id || 'demo-user',
    name,
    initials,
    avatarInitials: initials,
    email,
    accountTier: raw.accountTier || 'Pro',
    twoFactorEnabled: !!raw.twoFactorEnabled,
    zerodhaConnected: !!raw.zerodhaConnected,
    webullConnected: !!raw.webullConnected,
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    try {
      const body = JSON.parse(text);
      return body?.error || body?.message || fallback;
    } catch {
      return text ? `Server error (${res.status}): ${text.slice(0, 100)}` : fallback;
    }
  } catch {
    return fallback;
  }
}

/**
 * Real authentication service with automatic default user login for instant direct access.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<AppUser | null>(GUEST_USER);
  private readonly _authChecked = signal(true);
  private readonly _googleEnabled = signal(false);
  private readonly _googleClientId = signal<string | null>(null);

  /** Always returns an active authenticated user profile. */
  readonly currentUser = computed(() => this._user() ?? GUEST_USER);
  readonly isAuthenticated = computed(() => true);
  readonly authChecked = this._authChecked.asReadonly();
  readonly googleEnabled = this._googleEnabled.asReadonly();
  readonly googleClientId = this._googleClientId.asReadonly();

  /** Called once from app initializer. Restores session or uses default investor profile. */
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
        this._user.set(GUEST_USER);
      }
    } catch {
      this._user.set(GUEST_USER);
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

  async login(email: string, password: string): Promise<{ twoFactorRequired?: boolean; tempToken?: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Invalid email or password'));
    const data = await res.json();
    if (data.twoFactorRequired && data.tempToken) {
      return { twoFactorRequired: true, tempToken: data.tempToken };
    }
    this._user.set(mapUser(data.user));
    return { twoFactorRequired: false };
  }

  async login2fa(tempToken: string, code: string): Promise<void> {
    const res = await fetch('/api/auth/login-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Invalid 6-digit verification code'));
    const { user } = await res.json();
    this._user.set(mapUser(user));
  }

  async generate2fa(): Promise<{ secret: string; qrCode: string }> {
    const res = await fetch('/api/auth/2fa/generate', { method: 'POST' });
    if (!res.ok) throw new Error(await readError(res, 'Could not generate 2FA secret'));
    return res.json();
  }

  async verifyAndEnable2fa(secret: string, code: string): Promise<void> {
    const res = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, code }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Verification failed. Incorrect code.'));
    // Update local user state
    if (this._user()) {
      this._user.set({ ...this._user()!, twoFactorEnabled: true });
    }
  }

  async disable2fa(password: string): Promise<void> {
    const res = await fetch('/api/auth/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Could not disable 2FA'));
    if (this._user()) {
      this._user.set({ ...this._user()!, twoFactorEnabled: false });
    }
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

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; code?: string }> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Could not send reset code'));
    return res.json();
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Could not reset password'));
    return res.json();
  }
}
