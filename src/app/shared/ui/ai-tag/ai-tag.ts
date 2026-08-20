import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AiTagKind = 'fact' | 'calculation' | 'model' | 'interpretation';

/** Subtle badge distinguishing FACT / CALCULATION / MODEL SIGNAL / INTERPRETATION in AI output. */
@Component({
  selector: 'app-ai-tag',
  standalone: true,
  template: `<span class="ai-tag" [class]="'k-' + kind()">{{ label() }}</span>`,
  styles: [
    `
      .ai-tag {
        display: inline-flex;
        align-items: center;
        height: 18px;
        padding: 0 7px;
        border-radius: var(--radius-sm);
        font-size: 9.5px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        flex: none;
      }
      .k-fact { background: var(--ai-fact-bg); color: var(--ai-fact); }
      .k-calculation { background: var(--ai-calc-bg); color: var(--ai-calc); }
      .k-model { background: var(--ai-model-bg); color: var(--ai-model); }
      .k-interpretation { background: var(--ai-interpretation-bg); color: var(--ai-interpretation); }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiTag {
  readonly kind = input.required<AiTagKind>();

  protected label(): string {
    return {
      fact: 'Fact',
      calculation: 'Calculation',
      model: 'Model Signal',
      interpretation: 'Interpretation',
    }[this.kind()];
  }
}
