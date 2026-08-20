import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { Icon } from '../../shared/ui/icon/icon';
import { DemoBadge } from '../../shared/ui/demo-badge/demo-badge';
import { MarketTicker } from './market-ticker';
import { UiStateService } from '../../core/services/ui-state.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { map } from 'rxjs';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, Icon, DemoBadge, MarketTicker, AsyncPipe],
  template: `
    <header class="topbar">
      <div class="topbar-left">
        <button type="button" class="btn btn-icon btn-ghost mobile-only" (click)="ui.mobileNavOpen.set(true)" aria-label="Open navigation">
          <app-icon name="menu" [size]="18" />
        </button>
        <div class="title-block">
          <span class="title">{{ pageTitle() }}</span>
          <app-demo-badge />
        </div>
      </div>

      <div class="topbar-center">
        <app-market-ticker />
      </div>

      <div class="topbar-right">
        <button type="button" class="btn btn-icon btn-ghost" routerLink="/alerts" aria-label="Notifications">
          <app-icon name="bell" [size]="18" />
          @if ((unread$ | async); as count) {
            @if (count > 0) {
              <span class="dot-badge">{{ count }}</span>
            }
          }
        </button>

        <button type="button" class="btn btn-icon btn-ghost" (click)="ui.toggleAiPanel()" aria-label="Toggle AI Analyst panel" [class.active]="ui.aiPanelOpen()">
          <app-icon name="sparkles" [size]="18" />
        </button>

        <div class="profile-menu">
          <button type="button" class="avatar-btn" (click)="menuOpen.set(!menuOpen())" aria-haspopup="menu" [attr.aria-expanded]="menuOpen()">
            {{ auth.currentUser().avatarInitials }}
          </button>
          @if (menuOpen()) {
            <div class="dropdown" role="menu">
              <div class="dropdown-header">
                <span class="dropdown-name">{{ auth.currentUser().name }}</span>
                <span class="dropdown-email truncate">{{ auth.currentUser().email }}</span>
              </div>
              <a routerLink="/settings" class="dropdown-item" role="menuitem" (click)="menuOpen.set(false)">
                <app-icon name="settings" [size]="14" /> Settings
              </a>
              <button type="button" class="dropdown-item" role="menuitem" (click)="logout()">
                <app-icon name="log-out" [size]="14" /> Log out
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
  private readonly router = inject(Router);
  private readonly alertService = inject(AlertService);

  protected readonly menuOpen = signal(false);
  protected readonly unread$ = this.alertService.alerts$.pipe(map((alerts) => alerts.filter((a) => !a.read).length));

  private readonly titleMap: Record<string, string> = {
    dashboard: 'Overview',
    portfolio: 'Portfolio',
    transactions: 'Transactions',
    markets: 'Markets',
    watchlist: 'Watchlist',
    risk: 'Risk',
    predictions: 'Predictions',
    scenarios: 'Scenarios',
    alerts: 'Alerts',
    research: 'Research',
    'ai-analyst': 'AI Analyst',
    settings: 'Settings',
    stocks: 'Stock Research',
  };

  protected readonly pageTitle = computed(() => {
    const url = this.currentUrlSignal();
    const seg = url.split('/').filter(Boolean)[0] ?? 'dashboard';
    return this.titleMap[seg] ?? 'Portfolio Intelligence';
  });

  private readonly currentUrlSignal = signal(this.router.url);

  constructor() {
    this.router.events.subscribe(() => this.currentUrlSignal.set(this.router.url));
  }

  logout(): void {
    this.menuOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
