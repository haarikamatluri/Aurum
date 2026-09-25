import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssistantState } from '../../../../core/services/voice/command-orchestrator.service';

@Component({
  selector: 'aurum-voice-waveform',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="waveform-container" [attr.data-state]="state">
      @for (bar of bars; track bar) {
        <div
          class="wave-bar"
          [style.animation-delay]="bar * 0.08 + 's'"
          [style.height.px]="getBarHeight(bar)"
        ></div>
      }
    </div>
  `,
  styles: [`
    .waveform-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      height: 28px;
      padding: 0 4px;
    }

    .wave-bar {
      width: 3px;
      background: #0D9488;
      border-radius: 2px;
      transition: height 0.15s ease, background-color 0.3s ease;
      min-height: 4px;
    }

    [data-state='LISTENING'] .wave-bar {
      background: #38BDF8;
      animation: wave-active 0.8s infinite ease-in-out alternate;
    }

    [data-state='SPEAKING'] .wave-bar {
      background: #2DD4BF;
      animation: wave-active 0.6s infinite ease-in-out alternate;
    }

    [data-state='UNDERSTANDING'] .wave-bar,
    [data-state='PLANNING'] .wave-bar {
      background: #A78BFA;
      animation: wave-thinking 1s infinite ease-in-out alternate;
    }

    [data-state='ERROR'] .wave-bar {
      background: #F87171;
    }

    @keyframes wave-active {
      0% { height: 4px; }
      100% { height: 26px; }
    }

    @keyframes wave-thinking {
      0% { height: 6px; }
      50% { height: 16px; }
      100% { height: 8px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .wave-bar {
        animation: none !important;
        height: 8px !important;
      }
    }
  `]
})
export class VoiceWaveformComponent {
  @Input() state: AssistantState = 'IDLE';
  readonly bars = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  getBarHeight(index: number): number {
    if (this.state === 'IDLE') return 4;
    const center = 5;
    const dist = Math.abs(index - center);
    return Math.max(4, 24 - dist * 3);
  }
}
