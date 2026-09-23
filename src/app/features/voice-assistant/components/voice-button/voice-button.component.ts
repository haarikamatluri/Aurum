import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'aurum-voice-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button class="voice-btn" (click)="open.emit()" aria-label="Ask Antigravity Bot">
      <div class="icon-container">
        <div class="pulse-ring"></div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div class="text-container">
        <div class="title-row">
          <span class="title">Ask Antigravity Bot</span>
          <span class="ai-tag">AI</span>
        </div>
        <span class="subtitle">Instant Voice Intelligence</span>
      </div>
    </button>
  `,
  styles: [`
    .voice-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #0F172A, #1E293B);
      color: white;
      border: 1px solid rgba(13, 148, 136, 0.4);
      border-radius: 40px;
      padding: 10px 20px 10px 10px;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 15px rgba(13, 148, 136, 0.25);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: visible;
    }
    
    .voice-btn:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 12px 32px rgba(13, 148, 136, 0.4), 0 0 25px rgba(13, 148, 136, 0.4);
      border-color: #0D9488;
    }
    
    .icon-container {
      position: relative;
      background: linear-gradient(135deg, #0D9488, #059669);
      width: 42px;
      height: 42px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 12px rgba(13, 148, 136, 0.6);
    }
    
    .pulse-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid rgba(13, 148, 136, 0.6);
      animation: pulse-ring-anim 2s infinite ease-out;
    }

    @keyframes pulse-ring-anim {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    
    .icon-container svg {
      width: 22px;
      height: 22px;
      z-index: 1;
    }
    
    .text-container {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.2;
      background: linear-gradient(90deg, #FFFFFF, #E2E8F0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .ai-tag {
      background: rgba(13, 148, 136, 0.25);
      color: #2DD4BF;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 6px;
      border: 1px solid rgba(45, 212, 191, 0.3);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .subtitle {
      font-size: 11px;
      color: #94A3B8;
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
        width: 36px;
        height: 36px;
      }
    }
  `]
})
export class VoiceButtonComponent {
  @Output() open = new EventEmitter<void>();
}
