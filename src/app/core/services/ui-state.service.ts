import { Injectable, signal } from '@angular/core';

/** Cross-cutting UI chrome state: sidebar collapse and the dashboard AI panel. */
@Injectable({ providedIn: 'root' })
export class UiStateService {
  readonly sidebarCollapsed = signal<boolean>(false);
  readonly mobileNavOpen = signal<boolean>(false);
  readonly aiPanelOpen = signal<boolean>(false);

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleAiPanel(): void {
    this.aiPanelOpen.update((v) => !v);
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }
}
