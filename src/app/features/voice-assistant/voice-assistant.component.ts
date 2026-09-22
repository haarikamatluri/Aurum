import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceAssistantService } from '../../core/services/voice-assistant.service';
import { VoiceButtonComponent } from './components/voice-button/voice-button.component';
import { VoicePanelComponent } from './components/voice-panel/voice-panel.component';

@Component({
  selector: 'aurum-voice-assistant',
  standalone: true,
  imports: [CommonModule, VoiceButtonComponent, VoicePanelComponent],
  template: `
    <div class="voice-assistant-container">
      <aurum-voice-button 
        *ngIf="!isOpen" 
        (open)="togglePanel()">
      </aurum-voice-button>
      
      <aurum-voice-panel 
        *ngIf="isOpen" 
        (close)="togglePanel()">
      </aurum-voice-panel>
    </div>
  `,
  styles: [`
    .voice-assistant-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
    }
    
    @media (max-width: 768px) {
      .voice-assistant-container {
        bottom: 16px;
        right: 16px;
      }
    }
  `]
})
export class VoiceAssistantComponent {
  isOpen = false;

  constructor(public voiceService: VoiceAssistantService) {}

  togglePanel() {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) {
      this.voiceService.cancel();
    }
  }
}
