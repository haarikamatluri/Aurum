import { Injectable, effect, signal } from '@angular/core';
import { ThemePreference } from '../models/user.model';

const STORAGE_KEY = 'pi.theme';

/** Applies the resolved theme to <html data-theme="..."> and persists the user's preference. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly systemQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: light)') : null;
  readonly preference = signal<ThemePreference>(this.readStored());

  constructor() {
    effect(() => {
      const pref = this.preference();
      const resolved = pref === 'system' ? (this.systemQuery?.matches ? 'light' : 'dark') : pref;
      document.documentElement.setAttribute('data-theme', resolved);
    });
    this.systemQuery?.addEventListener('change', () => {
      if (this.preference() === 'system') {
        document.documentElement.setAttribute('data-theme', this.systemQuery!.matches ? 'light' : 'dark');
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
