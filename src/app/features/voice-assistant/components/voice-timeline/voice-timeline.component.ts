import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineStep } from '../../../../core/services/voice/command-orchestrator.service';

@Component({
  selector: 'aurum-voice-timeline',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (steps && steps.length > 0) {
      <div class="timeline-strip">
        @for (step of steps; track step.id) {
          <div class="timeline-item" [attr.data-status]="step.status">
            <span class="status-dot">
              @if (step.status === 'DONE') { ✓ }
              @else if (step.status === 'ACTIVE') { ⟳ }
              @else if (step.status === 'FAILED') { ✕ }
              @else { • }
            </span>
            <span class="step-label">{{ step.label }}</span>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .timeline-strip {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-top: 8px;
      padding: 8px 10px;
      background: rgba(15, 23, 42, 0.6);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .timeline-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #94A3B8;
    }

    .status-dot {
      width: 14px;
      height: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 9px;
      font-weight: 700;
    }

    [data-status='DONE'] .status-dot {
      background: rgba(16, 185, 129, 0.2);
      color: #10B981;
    }
    [data-status='DONE'] .step-label {
      color: #CBD5E1;
    }

    [data-status='ACTIVE'] .status-dot {
      background: rgba(56, 189, 248, 0.2);
      color: #38BDF8;
      animation: spin-dot 1s linear infinite;
    }
    [data-status='ACTIVE'] .step-label {
      color: #38BDF8;
      font-weight: 600;
    }

    [data-status='FAILED'] .status-dot {
      background: rgba(239, 68, 68, 0.2);
      color: #EF4444;
    }

    @keyframes spin-dot {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class VoiceTimelineComponent {
  @Input() steps: TimelineStep[] = [];
}
