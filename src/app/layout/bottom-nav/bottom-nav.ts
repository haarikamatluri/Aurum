import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../shared/ui/icon/icon';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Overview', icon: 'home' },
  { path: '/portfolio', label: 'Portfolio', icon: 'briefcase' },
  { path: '/ai-analyst', label: 'AI Analyst', icon: 'sparkles' },
  { path: '/watchlist', label: 'Watchlist', icon: 'eye' },
  { path: '/alerts', label: 'Alerts', icon: 'bell' },
];

/** Compact bottom tab bar shown only on narrow (mobile) viewports. */
@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Icon],
  template: `
    <nav class="bottom-nav" aria-label="Primary mobile">
      @for (item of items; track item.path) {
        <a [routerLink]="item.path" routerLinkActive="active" class="bn-item">
          <app-icon [name]="item.icon" [size]="19" />
          <span>{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
  styleUrl: './bottom-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNav {
  protected readonly items = ITEMS;
}
