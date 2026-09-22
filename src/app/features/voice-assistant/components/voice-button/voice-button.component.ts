import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'aurum-voice-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button class="voice-btn" (click)="open.emit()" aria-label="Ask Aurum">
      <div class="icon-container">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div class="text-container">
        <span class="title">Ask Aurum</span>
        <span class="subtitle">Your AI investing assistant</span>
      </div>
    </button>
  `,
  styles: [`
    .voice-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #101828, #1D2939);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 40px;
      padding: 10px 20px 10px 10px;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    }
    
    .voice-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(13, 148, 136, 0.3);
      border-color: rgba(13, 148, 136, 0.5);
    }
    
    .icon-container {
      background: #0D9488;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .icon-container svg {
      width: 20px;
      height: 20px;
    }
    
    .text-container {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    
    .title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.2;
    }
    
    .subtitle {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.2;
    }
    
    @media (max-width: 768px) {
      .text-container {
        display: none;
      }
      .voice-btn {
        padding: 12px;
      }
      .icon-container {
        width: 32px;
        height: 32px;
      }
    }
  `]
})
export class VoiceButtonComponent {
  @Output() open = new EventEmitter<void>();
}
