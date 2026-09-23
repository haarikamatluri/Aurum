import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, lastValueFrom } from 'rxjs';
import { SpeechToTextService } from './speech-to-text.service';
import { TextToSpeechService } from './text-to-speech.service';

export type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'ERROR';

export interface VoiceSession {
  id: string;
  userId: string;
}

export interface VoicePreferences {
  userId?: string;
  speechRate: number;
  autoPlay: boolean;
  showTranscript: boolean;
  pushToTalk: boolean;
  voiceURI?: string;
}

export interface VoiceResponse {
  intent: string;
  spokenAnswer: string;
  answer: string;
  symbol: string | null;
  actions: any[];
  sources: any[];
  followUpSuggestions: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceAssistantService {
  private stateSubject = new BehaviorSubject<VoiceState>('IDLE');
  state$ = this.stateSubject.asObservable();
  
  private chatHistorySubject = new BehaviorSubject<ChatMessage[]>([]);
  chatHistory$ = this.chatHistorySubject.asObservable();

  private session: VoiceSession | null = null;
  private preferences: VoicePreferences = {
    speechRate: 1,
    autoPlay: true,
    showTranscript: true,
    pushToTalk: false
  };

  private currentTranscript = '';
  private liveTranscriptSubject = new BehaviorSubject<string>('');
  liveTranscript$ = this.liveTranscriptSubject.asObservable();

  constructor(
    private http: HttpClient,
    private stt: SpeechToTextService,
    private tts: TextToSpeechService
  ) {
    this.initSession();
    this.loadPreferences();

    this.stt.transcript$.subscribe(res => {
      this.currentTranscript = res.text;
      this.liveTranscriptSubject.next(res.text);
      if (res.isFinal && res.text.trim()) {
        this.processQuery(this.currentTranscript);
      }
    });

    this.stt.error$.subscribe(err => {
      if (err) {
        this.stateSubject.next('ERROR');
        this.addMessage('assistant', err, true);
      }
    });
  }

  private async initSession() {
    try {
      this.session = await lastValueFrom(this.http.post<VoiceSession>('/api/voice/session', {}));
    } catch (e) {
      console.warn('Failed to init voice session', e);
    }
  }

  private async loadPreferences() {
    try {
      const prefs = await lastValueFrom(this.http.get<VoicePreferences>('/api/voice/preferences'));
      if (prefs) {
        this.preferences = prefs;
      }
    } catch (e) {
      console.warn('Failed to load voice preferences', e);
    }
  }

  async savePreferences(prefs: Partial<VoicePreferences>) {
    this.preferences = { ...this.preferences, ...prefs };
    try {
      await lastValueFrom(this.http.put('/api/voice/preferences', this.preferences));
    } catch (e) {
      console.warn('Failed to save voice preferences', e);
    }
  }

  getPreferences() {
    return this.preferences;
  }

  startListening() {
    this.tts.cancel();
    this.stateSubject.next('LISTENING');
    this.currentTranscript = '';
    this.liveTranscriptSubject.next('');
    this.stt.start();
  }

  stopListening() {
    this.stt.stop();
    if (this.currentTranscript && this.currentTranscript.trim()) {
      this.processQuery(this.currentTranscript);
    }
  }
  
  cancel() {
    this.stt.cancel();
    this.tts.cancel();
    this.stateSubject.next('IDLE');
  }

  sendTextQuery(text: string) {
    if (!text.trim()) return;
    this.tts.cancel();
    this.processQuery(text);
  }

  private async processQuery(transcript: string) {
    if (!transcript.trim()) {
      this.stateSubject.next('IDLE');
      return;
    }
    
    this.stateSubject.next('PROCESSING');
    this.addMessage('user', transcript);

    try {
      const pageContext = window.location.pathname;
      const res = await lastValueFrom(this.http.post<VoiceResponse>('/api/voice/query', {
        sessionId: this.session?.id,
        transcript,
        pageContext
      }));

      this.addMessage('assistant', res.answer);
      
      if (this.preferences.autoPlay && res.spokenAnswer) {
        this.stateSubject.next('SPEAKING');
        this.tts.speak(res.spokenAnswer, this.preferences.voiceURI, this.preferences.speechRate);
        
        // Wait for TTS to finish to go back to IDLE
        const sub = this.tts.isSpeaking$.subscribe(speaking => {
          if (!speaking && this.stateSubject.value === 'SPEAKING') {
            this.stateSubject.next('IDLE');
            sub.unsubscribe();
          }
        });
      } else {
        this.stateSubject.next('IDLE');
      }

    } catch (error: any) {
      this.stateSubject.next('ERROR');
      this.addMessage('assistant', 'Sorry, I encountered an error processing your request.', true);
    }
  }

  private addMessage(role: 'user' | 'assistant', content: string, isError = false) {
    const current = this.chatHistorySubject.value;
    this.chatHistorySubject.next([...current, { role, content, timestamp: new Date(), isError }]);
  }

  toggleMute() {
    this.tts.cancel();
    this.stateSubject.next('IDLE');
  }

  pause() {
    this.tts.pause();
  }

  resume() {
    this.tts.resume();
  }
}
