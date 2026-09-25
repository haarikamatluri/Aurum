import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { UiStateService } from '../../core/services/ui-state.service';

const NAV_ITEMS = [
  {
    path: '/money',
    label: 'Portfolio',
    icon: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  },
  {
    path: '/money/notifications',
    label: 'Alerts',
    icon: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  },
  {
    path: '/money/ai-analyst',
    label: 'AI Analyst',
    icon: `<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>`,
  },
];

/** Handcrafted Figma-grade Sidebar */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" [class.collapsed]="ui.sidebarCollapsed()" [class.mobile-open]="ui.mobileNavOpen()">
      <!-- Brand -->
      <div class="brand">
        <div class="brand-logo">
          <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
            <rect width="28" height="28" rx="8" fill="#00B37E" />
            <path d="M14 5L5 23h4.5l2-4.5h5l2 4.5H23L14 5z" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 14h4" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </div>
        @if (!ui.sidebarCollapsed()) {
          <span class="brand-text">Aurum</span>
        }
      </div>

      <!-- Navigation -->
      <nav class="nav" aria-label="Main Navigation">
        @for (item of navItems; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.path === '/money' }"
            class="nav-item"
            (click)="ui.closeMobileNav()"
            [attr.aria-label]="item.label"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              width="18"
              height="18"
              [innerHTML]="item.icon"
            ></svg>
            @if (!ui.sidebarCollapsed()) {
              <span class="nav-label">{{ item.label }}</span>
            }
            @if (item.label === 'Alerts' && notifService.unreadCount() > 0) {
              <span class="badge-pill">{{ notifService.unreadCount() > 9 ? '9+' : notifService.unreadCount() }}</span>
            }
          </a>
        }

        <a
          routerLink="/money/settings"
          routerLinkActive="active"
          class="nav-item"
          (click)="ui.closeMobileNav()"
          aria-label="Settings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          @if (!ui.sidebarCollapsed()) {
            <span class="nav-label">Settings</span>
          }
        </a>
      </nav>

      <!-- Sidebar Footer / User Profile Profile -->
      <div class="sidebar-footer">
        <div class="user-card" (click)="goToSettings()">
          <div class="user-avatar">
            {{ auth.currentUser().initials }}
          </div>
          @if (!ui.sidebarCollapsed()) {
            <div class="user-details">
              <span class="user-name">{{ auth.currentUser().name }}</span>
            </div>
          }
        </div>
      </div>
    </aside>

    @if (ui.mobileNavOpen()) {
      <div class="scrim" (click)="ui.closeMobileNav()"></div>
    }
  `,
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  protected readonly ui = inject(UiStateService);
  protected readonly auth = inject(AuthService);
  protected readonly notifService = inject(NotificationService);
  private readonly router = inject(Router);
  protected readonly navItems = NAV_ITEMS;

  goToSettings(): void {
    this.router.navigateByUrl('/money/settings');
  }
}
