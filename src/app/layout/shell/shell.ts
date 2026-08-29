import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Topbar } from '../topbar/topbar';
import { BottomNav } from '../bottom-nav/bottom-nav';

/** Root app layout: topbar + routed content. Sidebar removed per user request. */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Topbar, BottomNav],
  template: `
    <div class="shell">
      <app-topbar />
      <main class="content" id="main-content">
        <router-outlet />
      </main>
      <app-bottom-nav />
    </div>
  `,
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {}
