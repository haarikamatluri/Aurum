import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssistantState } from '../../../../core/services/voice/command-orchestrator.service';

@Component({
  selector: 'aurum-voice-orb',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="orb-container" [attr.data-state]="state">
      <!-- Outer Gyro Rings -->
      <div class="ring ring-outer"></div>
      <div class="ring ring-middle"></div>
      <div class="ring ring-inner"></div>

      <!-- Core Glowing Nucleus -->
      <div class="orb-core">
        <div class="core-sparkle"></div>
      </div>

      <!-- Sonic Wave Pulses (when listening/speaking) -->
      @if (state === 'LISTENING' || state === 'SPEAKING') {
        <div class="wave-pulse pulse-1"></div>
        <div class="wave-pulse pulse-2"></div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
      user-select: none;
    }

    .orb-container {
      position: relative;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .orb-core {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #2DD4BF 0%, #0D9488 55%, #042F2E 100%);
      box-shadow: 0 0 16px rgba(45, 212, 191, 0.65), inset 0 0 6px rgba(255, 255, 255, 0.4);
      z-index: 3;
      transition: all 0.4s ease;
      position: relative;
    }

    .core-sparkle {
      position: absolute;
      top: 3px;
      left: 4px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.85);
      filter: blur(0.5px);
    }

    .ring {
      position: absolute;
      border-radius: 50%;
      border: 1.5px solid transparent;
      pointer-events: none;
      transition: all 0.3s ease;
    }

    .ring-outer {
      width: 42px;
      height: 42px;
      border-color: rgba(45, 212, 191, 0.25);
    }

    .ring-middle {
      width: 32px;
      height: 32px;
      border-top-color: rgba(45, 212, 191, 0.6);
      border-bottom-color: rgba(45, 212, 191, 0.3);
    }

    .ring-inner {
      width: 26px;
      height: 26px;
      border-left-color: rgba(94, 234, 212, 0.8);
    }

    /* STATE: LISTENING */
    [data-state='LISTENING'] .orb-core {
      background: radial-gradient(circle at 35% 35%, #38BDF8 0%, #0284C7 60%, #0369A1 100%);
      box-shadow: 0 0 24px rgba(56, 189, 248, 0.85), inset 0 0 8px rgba(255, 255, 255, 0.6);
      transform: scale(1.15);
    }
    [data-state='LISTENING'] .ring-outer {
      border-color: rgba(56, 189, 248, 0.4);
      animation: spin 3s linear infinite;
    }

    /* STATE: UNDERSTANDING / PLANNING */
    [data-state='UNDERSTANDING'] .orb-core,
    [data-state='PLANNING'] .orb-core {
      background: radial-gradient(circle at 35% 35%, #A78BFA 0%, #7C3AED 60%, #4C1D95 100%);
      box-shadow: 0 0 20px rgba(167, 139, 250, 0.8);
      animation: pulse-core 1.2s infinite alternate;
    }
    [data-state='UNDERSTANDING'] .ring-middle,
    [data-state='PLANNING'] .ring-middle {
      border-top-color: #A78BFA;
      animation: spin-rev 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    [data-state='UNDERSTANDING'] .ring-outer,
    [data-state='PLANNING'] .ring-outer {
      border-bottom-color: #C4B5FD;
      animation: spin 2s linear infinite;
    }

    /* STATE: FETCHING / EXECUTING */
    [data-state='FETCHING'] .orb-core,
    [data-state='EXECUTING'] .orb-core {
      background: radial-gradient(circle at 35% 35%, #FBBF24 0%, #D97706 60%, #78350F 100%);
      box-shadow: 0 0 20px rgba(251, 191, 36, 0.8);
      animation: pulse-fast 0.8s infinite alternate;
    }
    [data-state='FETCHING'] .ring-middle,
    [data-state='EXECUTING'] .ring-middle {
      border-color: rgba(251, 191, 36, 0.6);
      animation: spin 0.8s linear infinite;
    }

    /* STATE: SPEAKING */
    [data-state='SPEAKING'] .orb-core {
      background: radial-gradient(circle at 35% 35%, #34D399 0%, #059669 60%, #064E3B 100%);
      box-shadow: 0 0 22px rgba(52, 211, 153, 0.85);
      animation: speaking-bounce 0.6s infinite alternate ease-in-out;
    }

    /* STATE: CONFIRM_REQUIRED */
    [data-state='CONFIRM_REQUIRED'] .orb-core {
      background: radial-gradient(circle at 35% 35%, #FB923C 0%, #EA580C 60%, #7C2D12 100%);
      box-shadow: 0 0 24px rgba(251, 146, 60, 0.9);
      animation: pulse-alert 0.6s infinite alternate;
    }

    /* STATE: ERROR */
    [data-state='ERROR'] .orb-core {
      background: radial-gradient(circle at 35% 35%, #F87171 0%, #DC2626 60%, #7F1D1D 100%);
      box-shadow: 0 0 20px rgba(248, 113, 113, 0.8);
    }

    /* Sonic Wave Pulses */
    .wave-pulse {
      position: absolute;
      border-radius: 50%;
      border: 1.5px solid rgba(45, 212, 191, 0.6);
      pointer-events: none;
      animation: sonic-pulse 2s infinite cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .pulse-1 { width: 100%; height: 100%; }
    .pulse-2 { width: 100%; height: 100%; animation-delay: 0.8s; }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes spin-rev {
      from { transform: rotate(360deg); }
      to { transform: rotate(0deg); }
    }
    @keyframes pulse-core {
      0% { transform: scale(0.95); opacity: 0.9; }
      100% { transform: scale(1.1); opacity: 1; }
    }
    @keyframes pulse-fast {
      0% { transform: scale(0.9); }
      100% { transform: scale(1.15); }
    }
    @keyframes speaking-bounce {
      0% { transform: scale(0.98); }
      100% { transform: scale(1.12); }
    }
    @keyframes pulse-alert {
      0% { transform: scale(0.95); }
      100% { transform: scale(1.2); }
    }
    @keyframes sonic-pulse {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .ring, .orb-core, .wave-pulse {
        animation: none !important;
        transition: none !important;
      }
    }
  `]
})
export class AurumVoiceOrbComponent {
  @Input() state: AssistantState = 'IDLE';
}
