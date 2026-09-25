import { Injectable, signal } from '@angular/core';

export interface PerformanceTelemetry {
  voiceStart: number;
  transcriptReady: number | null;
  intentReady: number | null;
  executionStart: number | null;
  firstResponse: number | null;
  speechStart: number | null;
  completed: number | null;
  recognitionLatencyMs: number;
  intentLatencyMs: number;
  executionLatencyMs: number;
  ttsLatencyMs: number;
  totalPerceivedLatencyMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class VoicePerformanceService {
  private currentMark: Partial<PerformanceTelemetry> = {};
  readonly lastTelemetry = signal<PerformanceTelemetry | null>(null);
  readonly averageLatencyMs = signal<number>(240);

  markVoiceStart() {
    this.currentMark = {
      voiceStart: performance.now(),
      transcriptReady: null,
      intentReady: null,
      executionStart: null,
      firstResponse: null,
      speechStart: null,
      completed: null
    };
  }

  markTranscriptReady() {
    if (!this.currentMark.voiceStart) return;
    this.currentMark.transcriptReady = performance.now();
  }

  markIntentReady() {
    if (!this.currentMark.voiceStart) return;
    this.currentMark.intentReady = performance.now();
  }

  markExecutionStart() {
    if (!this.currentMark.voiceStart) return;
    this.currentMark.executionStart = performance.now();
  }

  markFirstResponse() {
    if (!this.currentMark.voiceStart) return;
    this.currentMark.firstResponse = performance.now();
  }

  markSpeechStart() {
    if (!this.currentMark.voiceStart) return;
    this.currentMark.speechStart = performance.now();
  }

  markCompleted() {
    if (!this.currentMark.voiceStart) return;
    const now = performance.now();
    this.currentMark.completed = now;

    const t = this.currentMark;
    const voiceStart = t.voiceStart || now;
    const transcriptReady = t.transcriptReady || now;
    const intentReady = t.intentReady || transcriptReady;
    const execStart = t.executionStart || intentReady;
    const firstResp = t.firstResponse || now;
    const speechStart = t.speechStart || firstResp;

    const telemetry: PerformanceTelemetry = {
      voiceStart,
      transcriptReady,
      intentReady,
      executionStart: execStart,
      firstResponse: firstResp,
      speechStart,
      completed: now,
      recognitionLatencyMs: Math.max(0, Math.round(transcriptReady - voiceStart)),
      intentLatencyMs: Math.max(0, Math.round(intentReady - transcriptReady)),
      executionLatencyMs: Math.max(0, Math.round(firstResp - execStart)),
      ttsLatencyMs: Math.max(0, Math.round(speechStart - firstResp)),
      totalPerceivedLatencyMs: Math.max(0, Math.round(firstResp - voiceStart))
    };

    this.lastTelemetry.set(telemetry);
    const prevAvg = this.averageLatencyMs();
    this.averageLatencyMs.set(Math.round((prevAvg * 0.7) + (telemetry.totalPerceivedLatencyMs * 0.3)));
  }
}
