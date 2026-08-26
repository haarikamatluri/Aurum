import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UiStateService } from '../../core/services/ui-state.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="topbar">
      <div class="topbar-left">
        <button type="button" class="menu-btn mobile-only" (click)="ui.mobileNavOpen.set(true)" aria-label="Open navigation">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span class="page-title">{{ pageTitle() }}</span>
      </div>

      <div class="topbar-right">
        <!-- Notifications bell -->
        <a routerLink="/money/notifications" class="icon-btn" aria-label="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          @if (notifService.unreadCount() > 0) {
            <span class="notif-dot">{{ notifService.unreadCount() > 9 ? '9+' : notifService.unreadCount() }}</span>
          }
        </a>

        <!-- Profile menu -->
        <div class="profile-menu">
          <button type="button" class="avatar-btn" (click)="menuOpen.set(!menuOpen())" [attr.aria-expanded]="menuOpen()">
            {{ auth.currentUser().initials }}
          </button>
          @if (menuOpen()) {
            <div class="dropdown" role="menu">
              <div class="dropdown-header">
                <span class="dropdown-name">{{ auth.currentUser().name }}</span>
              </div>
              <a routerLink="/money/settings" class="dropdown-item" role="menuitem" (click)="menuOpen.set(false)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Settings
              </a>
              <button type="button" class="dropdown-item" role="menuitem" (click)="logout()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
              </button>
            </div>
          }
        </div>
      </div>
    </header>
    @if (menuOpen()) {
      <div class="click-catcher" (click)="menuOpen.set(false)"></div>
    }
  `,
  styleUrl: './topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {
  protected readonly ui = inject(UiStateService);
  protected readonly auth = inject(AuthService);
  protected readonly notifService = inject(NotificationService);
  private readonly router = inject(Router);
  protected readonly menuOpen = signal(false);

  private readonly titleMap: Record<string, string> = {
    money: 'Your Money',
    notifications: 'Notifications',
    'ai-analyst': 'AI Analyst',
    settings: 'Settings',
    stocks: 'Stock Detail',
  };

  private readonly currentUrl = signal(this.router.url);

  constructor() {
    this.router.events.subscribe(() => this.currentUrl.set(this.router.url));
  }

  protected readonly pageTitle = computed(() => {
    const parts = this.currentUrl().split('/').filter(Boolean);
    const last = parts[parts.length - 1] ?? 'money';
    return this.titleMap[last] ?? 'Money';
  });

  async logout(): Promise<void> {
    this.menuOpen.set(false);
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
