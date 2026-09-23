import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TextToSpeechService {
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  
  private isSpeakingSubject = new BehaviorSubject<boolean>(false);
  private isPausedSubject = new BehaviorSubject<boolean>(false);
  
  isSpeaking$ = this.isSpeakingSubject.asObservable();
  isPaused$ = this.isPausedSubject.asObservable();

  private currentAudio: HTMLAudioElement | null = null;
  private useElevenLabs = false; // Fast instant browser TTS for zero latency

  constructor(private http: HttpClient) {
    this.synth = window.speechSynthesis;
    this.loadVoices();
    if (this.synth && this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices() {
    if (this.synth) {
      this.voices = this.synth.getVoices();
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  isSupported(): boolean {
    return true; // We have backend support
  }

  speak(text: string, voiceURI?: string, rate: number = 1.0) {
    if (!text) return;
    this.cancel();

    if (this.useElevenLabs) {
      this.speakWithElevenLabs(text, voiceURI);
    } else {
      this.speakWithBrowser(text, voiceURI, rate);
    }
  }

  private speakWithElevenLabs(text: string, voiceURI?: string) {
    this.isSpeakingSubject.next(true);
    this.isPausedSubject.next(false);
    
    this.http.post('/api/voice/speak', { text, voiceId: voiceURI }, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.currentAudio = new Audio(url);
          
          this.currentAudio.onplay = () => {
            this.isSpeakingSubject.next(true);
            this.isPausedSubject.next(false);
          };
          
          this.currentAudio.onended = () => {
            this.isSpeakingSubject.next(false);
            this.isPausedSubject.next(false);
            URL.revokeObjectURL(url);
          };
          
          this.currentAudio.onerror = (e) => {
            console.error('ElevenLabs Audio Error:', e);
            URL.revokeObjectURL(url);
            this.speakWithBrowser(text, voiceURI, 1.0);
          };
          
          this.currentAudio.play().catch(err => {
            console.error('Play error', err);
            this.speakWithBrowser(text, voiceURI, 1.0);
          });
        },
        error: (err) => {
          console.error('ElevenLabs API Error:', err);
          this.speakWithBrowser(text, voiceURI, 1.0);
        }
      });
  }

  private speakWithBrowser(text: string, voiceURI?: string, rate: number = 1.0) {
    if (!('speechSynthesis' in window)) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    
    if (voiceURI && this.voices.length > 0) {
      const selectedVoice = this.voices.find(v => v.voiceURI === voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onstart = () => {
      this.isSpeakingSubject.next(true);
      this.isPausedSubject.next(false);
    };

    utterance.onend = () => {
      this.isSpeakingSubject.next(false);
      this.isPausedSubject.next(false);
    };

    utterance.onerror = (e) => {
      console.error('TTS Error:', e);
      this.isSpeakingSubject.next(false);
      this.isPausedSubject.next(false);
    };

    utterance.onpause = () => {
      this.isPausedSubject.next(true);
    };

    utterance.onresume = () => {
      this.isPausedSubject.next(false);
    };

    this.synth.speak(utterance);
  }

  pause() {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.isPausedSubject.next(true);
    } else if (this.synth && this.synth.speaking) {
      this.synth.pause();
    }
  }

  resume() {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play();
      this.isPausedSubject.next(false);
    } else if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  cancel() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.synth && (this.synth.speaking || this.synth.pending)) {
      this.synth.cancel();
    }
    this.isSpeakingSubject.next(false);
    this.isPausedSubject.next(false);
  }
}
