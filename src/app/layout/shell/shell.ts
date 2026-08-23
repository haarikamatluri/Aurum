import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
import { BottomNav } from '../bottom-nav/bottom-nav';
import { UiStateService } from '../../core/services/ui-state.service';

/** Root app layout: minimal sidebar + topbar + routed content. */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Topbar, BottomNav],
  template: `
    <div class="shell">
      <app-sidebar />
      <div class="shell-main" [class.collapsed]="ui.sidebarCollapsed()">
        <app-topbar />
        <main class="content" id="main-content">
          <router-outlet />
        </main>
      </div>
      <app-bottom-nav />
    </div>
  `,
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly ui = inject(UiStateService);
}
