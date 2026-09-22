import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SpeechEvent {
  text: string;
  isFinal: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SpeechToTextService {
  private recognition: any;
  private isListeningSubject = new BehaviorSubject<boolean>(false);
  private transcriptSubject = new BehaviorSubject<SpeechEvent>({ text: '', isFinal: false });
  private errorSubject = new BehaviorSubject<string | null>(null);

  isListening$ = this.isListeningSubject.asObservable();
  transcript$ = this.transcriptSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  constructor(private zone: NgZone) {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.zone.run(() => {
          this.isListeningSubject.next(true);
          this.errorSubject.next(null);
        });
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        this.zone.run(() => {
          if (finalTranscript) {
            this.transcriptSubject.next({ text: finalTranscript, isFinal: true });
          } else if (interimTranscript) {
            this.transcriptSubject.next({ text: interimTranscript, isFinal: false });
          }
        });
      };

      this.recognition.onerror = (event: any) => {
        this.zone.run(() => {
          this.isListeningSubject.next(false);
          if (event.error === 'not-allowed') {
            this.errorSubject.next('Microphone access is blocked.');
          } else if (event.error === 'no-speech') {
            this.errorSubject.next('No speech detected.');
          } else {
            this.errorSubject.next(`Microphone error: ${event.error}`);
          }
        });
      };

      this.recognition.onend = () => {
        this.zone.run(() => {
          this.isListeningSubject.next(false);
        });
      };
    }
  }

  isSupported(): boolean {
    return !!this.recognition;
  }

  start() {
    if (!this.recognition) {
      this.errorSubject.next("Voice input isn't supported in this browser.");
      return;
    }
    this.errorSubject.next(null);
    this.transcriptSubject.next({ text: '', isFinal: false });
    try {
      this.recognition.start();
    } catch (e) {
      // Already started
    }
  }

  stop() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  cancel() {
    if (this.recognition) {
      this.recognition.abort();
    }
  }
}
