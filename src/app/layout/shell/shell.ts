import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
import { BottomNav } from '../bottom-nav/bottom-nav';
import { AiPanel } from '../ai-panel/ai-panel';
import { UiStateService } from '../../core/services/ui-state.service';

/** Root authenticated layout: sidebar + topbar + routed content + global AI panel. */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Topbar, BottomNav, AiPanel],
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
      <app-ai-panel />
    </div>
  `,
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly ui = inject(UiStateService);
}
