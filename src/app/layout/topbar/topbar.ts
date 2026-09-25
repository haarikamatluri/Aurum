import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="navbar">
      <div class="navbar-inner">
        <!-- Left: Aurum Brand Logo -->
        <a routerLink="/money" class="brand-logo" aria-label="Aurum Home">
          <div class="logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <path d="M12 3L3 20h4.5l2-4.5h5l2 4.5H21L12 3z"/>
              <path d="M10 12h4"/>
            </svg>
          </div>
          <span class="logo-text">Aurum</span>
        </a>

        <!-- Center: Navigation Tabs -->
        <nav class="center-nav" aria-label="Main Navigation">
          <!-- 1. Portfolio -->
          <a
            routerLink="/money"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="nav-tab"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span>Portfolio</span>
          </a>

          <!-- 2. Alerts -->
          <a
            routerLink="/money/notifications"
            routerLinkActive="active"
            class="nav-tab"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span>Alerts</span>
            @if (notifService.unreadCount() > 0) {
              <span class="notif-badge">{{ notifService.unreadCount() > 9 ? '9+' : notifService.unreadCount() }}</span>
            }
          </a>

          <!-- 3. AI Analyst -->
          <a
            routerLink="/money/ai-analyst"
            routerLinkActive="active"
            class="nav-tab"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <span>AI Analyst</span>
          </a>

          <!-- 4. Settings -->
          <a
            routerLink="/money/settings"
            routerLinkActive="active"
            class="nav-tab"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Settings</span>
          </a>
        </nav>

        <!-- Right: User Profile Menu & Sign Out -->
        <div class="nav-right">
          <div class="profile-menu">
            <button
              type="button"
              class="profile-btn"
              (click)="toggleMenu($event)"
              [attr.aria-expanded]="menuOpen()"
              aria-haspopup="true"
              aria-label="User menu"
            >
              <div class="avatar-badge">{{ auth.currentUser().initials }}</div>
              <div class="user-details">
                <span class="user-name">{{ auth.currentUser().name }}</span>
              </div>
              <svg class="chevron-icon" [class.open]="menuOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            @if (menuOpen()) {
              <div class="dropdown" role="menu">
                <div class="dropdown-header">
                  <span class="dropdown-name">{{ auth.currentUser().name }}</span>
                  @if (auth.currentUser().email) {
                    <span class="dropdown-email">{{ auth.currentUser().email }}</span>
                  }
                </div>
                <a routerLink="/money/settings" class="dropdown-item" role="menuitem" (click)="menuOpen.set(false)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  <span>Settings</span>
                </a>
              </div>
            }
          </div>
        </div>
      </div>
    </header>
  `,
  styleUrl: './topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {
  protected readonly auth = inject(AuthService);
  protected readonly notifService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);
  protected readonly menuOpen = signal(false);

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.set(!this.menuOpen());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
    }
  }
}
