import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceAssistantService, VoiceState } from '../../../../core/services/voice-assistant.service';

@Component({
  selector: 'aurum-voice-waveform',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="waveform-container" [class.active]="state === 'LISTENING' || state === 'SPEAKING'">
      <div class="bar" *ngFor="let i of bars" [style.animation-delay]="i * 0.1 + 's'"></div>
    </div>
  `,
  styles: [`
    .waveform-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      height: 60px;
    }
    .bar {
      width: 4px;
      height: 8px;
      background-color: #0D9488;
      border-radius: 4px;
      transition: height 0.2s ease;
    }
    .waveform-container.active .bar {
      animation: pulse 1s infinite alternate ease-in-out;
    }
    @keyframes pulse {
      0% { height: 8px; }
      100% { height: 48px; }
    }
  `]
})
export class VoiceWaveformComponent implements OnInit {
  @Input() state: VoiceState = 'IDLE';
  bars = Array.from({ length: 9 }, (_, i) => i);
  
  ngOnInit() {}
}
