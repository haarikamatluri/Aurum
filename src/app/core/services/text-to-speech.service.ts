import { Injectable } from '@angular/core';
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

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices() {
    this.voices = this.synth.getVoices();
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  speak(text: string, voiceURI?: string, rate: number = 1.0) {
    if (!this.isSupported() || !text) return;
    
    this.cancel(); // Stop anything currently playing

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
    if (this.synth.speaking) {
      this.synth.pause();
    }
  }

  resume() {
    if (this.synth.paused) {
      this.synth.resume();
    }
  }

  cancel() {
    if (this.synth.speaking || this.synth.pending) {
      this.synth.cancel();
    }
    this.isSpeakingSubject.next(false);
    this.isPausedSubject.next(false);
  }
}
