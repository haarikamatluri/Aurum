import { Injectable, signal, inject, NgZone } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WakeWordService {
  private readonly zone = inject(NgZone);
  private isListeningForWake = false;

  readonly wakeTriggered$ = new Subject<void>();
  readonly cancelTriggered$ = new Subject<void>();
  readonly wakeModeEnabled = signal<boolean>(false);

  constructor() {
    this.initKeyboardHotkeys();
  }

  private initKeyboardHotkeys() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Ctrl + Space or Cmd + Space activates Voice Operating Layer
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        this.zone.run(() => {
          this.wakeTriggered$.next();
        });
      } else if (e.code === 'Escape') {
        this.zone.run(() => {
          this.cancelTriggered$.next();
        });
      }
    });
  }

  checkWakePhrase(transcript: string): boolean {
    if (!this.wakeModeEnabled()) return false;
    const lower = transcript.toLowerCase();
    return lower.includes('hey aurum') || lower.includes('aurum') || lower.includes('ok aurum');
  }

  setWakeMode(enabled: boolean) {
    this.wakeModeEnabled.set(enabled);
  }
}
