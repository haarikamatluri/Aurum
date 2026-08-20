import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface TabDef {
  id: string;
  label: string;
}

/** Horizontally scrollable tab strip (used by the stock research page and settings). */
@Component({
  selector: 'app-tabs',
  standalone: true,
  template: `
    <div class="tabs" role="tablist">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          class="tab"
          [class.active]="tab.id === active()"
          [attr.aria-selected]="tab.id === active()"
          (click)="activeChange.emit(tab.id)"
        >
          {{ tab.label }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .tabs {
        display: flex;
        gap: var(--space-1);
        border-bottom: 1px solid var(--border);
        overflow-x: auto;
      }
      .tab {
        background: none;
        border: none;
        padding: var(--space-3) var(--space-4);
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        white-space: nowrap;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard);
      }
      .tab:hover { color: var(--text-primary); }
      .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tabs {
  readonly tabs = input.required<TabDef[]>();
  readonly active = input.required<string>();
  readonly activeChange = output<string>();
}
