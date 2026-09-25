import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, lastValueFrom } from 'rxjs';
import { SpeechToTextService } from './speech-to-text.service';
import { TextToSpeechService } from './text-to-speech.service';
import { CommandOrchestratorService, AssistantState, ActionCardData, TimelineStep } from './voice/command-orchestrator.service';
import { WakeWordService } from './voice/wake-word.service';
import { VoicePerformanceService } from './voice/voice-performance.service';
import { VoiceContextService } from './voice/voice-context.service';
import { TradingService } from './trading.service';

export interface VoicePreferences {
  userId?: string;
  speechRate: number;
  autoPlay: boolean;
  showTranscript: boolean;
  pushToTalk: boolean;
  voiceURI?: string;
  wakeModeEnabled?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceAssistantService {
  private readonly http = inject(HttpClient);
  private readonly stt = inject(SpeechToTextService);
  private readonly tts = inject(TextToSpeechService);
  private readonly orchestrator = inject(CommandOrchestratorService);
  private readonly wakeWord = inject(WakeWordService);
  private readonly perf = inject(VoicePerformanceService);
  private readonly context = inject(VoiceContextService);
  private readonly trading = inject(TradingService);

  readonly state = this.orchestrator.state;
  readonly stateLabel = this.orchestrator.stateLabel;
  readonly liveTranscript = this.orchestrator.interimTranscript;
  readonly activeCard = this.orchestrator.activeCard;
  readonly timeline = this.orchestrator.timeline;
  readonly lastTelemetry = this.perf.lastTelemetry;
  readonly averageLatency = this.perf.averageLatencyMs;
  readonly contextSnapshot = this.context.getSnapshot.bind(this.context);

  private preferences: VoicePreferences = {
    speechRate: 1.05,
    autoPlay: true,
    showTranscript: true,
    pushToTalk: false,
    wakeModeEnabled: false
  };

  constructor() {
    this.loadPreferences();

    // Listen to STT events
    this.stt.transcript$.subscribe((res) => {
      if (res.isFinal && res.text.trim()) {
        this.orchestrator.handleFinalTranscript(res.text);
      } else if (res.text) {
        this.orchestrator.handleInterimTranscript(res.text);
      }
    });

    this.stt.error$.subscribe((err) => {
      if (err) {
        this.orchestrator.cancel();
      }
    });

    // Keyboard shortcut / Wake word activation
    this.wakeWord.wakeTriggered$.subscribe(() => {
      if (this.state() === 'IDLE') {
        this.startListening();
      } else {
        this.stopListening();
      }
    });

    this.wakeWord.cancelTriggered$.subscribe(() => {
      this.cancel();
    });
  }

  private async loadPreferences() {
    try {
      const prefs = await lastValueFrom(this.http.get<VoicePreferences>('/api/voice/preferences'));
      if (prefs) {
        this.preferences = { ...this.preferences, ...prefs };
      }
    } catch {
      // offline / demo fallback
    }
  }

  async savePreferences(prefs: Partial<VoicePreferences>) {
    this.preferences = { ...this.preferences, ...prefs };
    if (prefs.autoPlay !== undefined) {
      this.orchestrator.setAutoSpeak(prefs.autoPlay);
    }
    if (prefs.wakeModeEnabled !== undefined) {
      this.wakeWord.setWakeMode(prefs.wakeModeEnabled);
    }
    try {
      await lastValueFrom(this.http.put('/api/voice/preferences', this.preferences));
    } catch {
      // offline
    }
  }

  getPreferences(): VoicePreferences {
    return this.preferences;
  }

  startListening() {
    this.tts.cancel();
    this.perf.markVoiceStart();
    this.orchestrator.handleInterimTranscript('');
    this.stt.start();
  }

  stopListening() {
    this.stt.stop();
  }

  cancel() {
    this.stt.cancel();
    this.orchestrator.cancel();
  }

  sendTextQuery(text: string) {
    if (!text.trim()) return;
    this.tts.cancel();
    this.perf.markVoiceStart();
    this.orchestrator.handleFinalTranscript(text);
  }

  async executeCardAction(actionKey: string, card: ActionCardData) {
    if (actionKey === 'CONFIRM_ORDER' && card.rawPayload) {
      try {
        const order = await this.trading.executeConfirmedOrder(card.rawPayload);
        this.orchestrator.activeCard.set({
          type: 'ORDER_PREVIEW',
          title: 'Order Executed Successfully',
          symbol: order.symbol,
          price: order.price,
          currency: order.currency,
          summaryText: `Successfully executed ${order.side} ${order.quantity} shares of ${order.symbol} at ${order.currency === 'INR' ? '₹' : '$'}${order.price}. Broker Order ID: ${order.orderId}`
        });
        this.tts.speak(`Order executed successfully for ${order.quantity} shares of ${order.symbol}.`);
      } catch (err: any) {
        this.orchestrator.activeCard.set({
          type: 'ORDER_PREVIEW',
          title: 'Order Execution Failed',
          summaryText: `Error: ${err.message}`
        });
        this.tts.speak(`Order execution failed: ${err.message}`);
      }
    } else if (actionKey === 'CANCEL_ORDER') {
      this.orchestrator.dismissActiveCard();
      this.tts.speak('Order preview cancelled.');
    }
  }

  dismissActiveCard() {
    this.orchestrator.dismissActiveCard();
  }
}
