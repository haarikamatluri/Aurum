import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../shared/ui/icon/icon';
import { UiStateService } from '../../core/services/ui-state.service';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Overview', icon: 'home' },
  { path: '/portfolio', label: 'Portfolio', icon: 'briefcase' },
  { path: '/markets', label: 'Markets', icon: 'trending-up' },
  { path: '/watchlist', label: 'Watchlist', icon: 'eye' },
  { path: '/ai-analyst', label: 'AI Analyst', icon: 'sparkles' },
  { path: '/risk', label: 'Risk', icon: 'shield' },
  { path: '/predictions', label: 'Predictions', icon: 'activity' },
  { path: '/scenarios', label: 'Scenarios', icon: 'git-branch' },
  { path: '/alerts', label: 'Alerts', icon: 'bell' },
  { path: '/research', label: 'Research', icon: 'newspaper' },
];

/** Primary left navigation. Collapsible on desktop, becomes an off-canvas drawer on mobile. */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Icon],
  template: `
    <aside class="sidebar" [class.collapsed]="ui.sidebarCollapsed()" [class.mobile-open]="ui.mobileNavOpen()">
      <div class="brand">
        <div class="brand-mark">
          <app-icon name="activity" [size]="18" />
        </div>
        @if (!ui.sidebarCollapsed()) {
          <span class="brand-name">Portfolio<strong>OS</strong></span>
        }
      </div>

      <nav class="nav" aria-label="Primary">
        @for (item of navItems; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active"
            class="nav-item"
            (click)="ui.closeMobileNav()"
            [attr.aria-label]="item.label"
          >
            <app-icon [name]="item.icon" [size]="18" />
            @if (!ui.sidebarCollapsed()) {
              <span>{{ item.label }}</span>
            }
          </a>
        }
      </nav>

      <div class="sidebar-footer">
        <a routerLink="/settings" routerLinkActive="active" class="nav-item" (click)="ui.closeMobileNav()">
          <app-icon name="settings" [size]="18" />
          @if (!ui.sidebarCollapsed()) {
            <span>Settings</span>
          }
        </a>

        <div class="user-chip">
          <div class="avatar">{{ auth.currentUser().avatarInitials }}</div>
          @if (!ui.sidebarCollapsed()) {
            <div class="user-meta">
              <span class="user-name truncate">{{ auth.currentUser().name }}</span>
              <span class="user-tier">{{ auth.currentUser().accountTier }}</span>
            </div>
          }
        </div>

        <button type="button" class="collapse-btn" (click)="ui.toggleSidebar()" [attr.aria-label]="ui.sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'">
          <app-icon [name]="ui.sidebarCollapsed() ? 'chevron-right' : 'chevron-left'" [size]="15" />
        </button>
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
  protected readonly navItems = NAV_ITEMS;
}
