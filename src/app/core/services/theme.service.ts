import { Injectable, effect, signal } from '@angular/core';

export type ThemePreference = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'money.theme';

/** Applies the resolved theme to <html data-theme="..."> and persists the user's preference. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly systemQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  readonly preference = signal<ThemePreference>(this.readStored());

  constructor() {
    effect(() => {
      const pref = this.preference();
      const resolved = pref === 'system' ? (this.systemQuery?.matches ? 'dark' : 'dark') : pref;
      document.documentElement.setAttribute('data-theme', resolved);
    });
    this.systemQuery?.addEventListener('change', () => {
      if (this.preference() === 'system') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    });
  }

  private readStored(): ThemePreference {
    try {
      return (localStorage.getItem(STORAGE_KEY) as ThemePreference) || 'dark';
    } catch {
      return 'dark';
    }
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
  }
}
