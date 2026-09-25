import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommandPlannerService, ActionGraph } from './command-planner.service';
import { ActionExecutorService, GraphExecutionResult } from './action-executor.service';
import { VoiceResponseService } from './voice-response.service';
import { VoiceAuditService } from './voice-audit.service';
import { VoiceContextService } from './voice-context.service';
import { VoicePerformanceService } from './voice-performance.service';
import { TextToSpeechService } from '../text-to-speech.service';

export type AssistantState =
  | 'IDLE'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'UNDERSTANDING'
  | 'PLANNING'
  | 'FETCHING'
  | 'EXECUTING'
  | 'CONFIRM_REQUIRED'
  | 'SPEAKING'
  | 'SUCCESS'
  | 'ERROR'
  | 'CANCELLED'
  | 'OFFLINE';

export interface TimelineStep {
  id: string;
  label: string;
  status: 'PENDING' | 'ACTIVE' | 'DONE' | 'FAILED';
  timestamp: number;
}

export interface ActionCardData {
  type: 'STOCK_QUOTE' | 'ORDER_PREVIEW' | 'ALERT_CREATED' | 'PORTFOLIO_PULSE' | 'RESEARCH_EVIDENCE' | 'AUTOMATION_STATUS';
  title: string;
  symbol?: string;
  price?: number;
  changePct?: number;
  currency?: string;
  summaryText: string;
  actions?: Array<{ label: string; actionKey: string; primary?: boolean }>;
  evidence?: Array<{ claim: string; source: string }>;
  rawPayload?: any;
}

@Injectable({
  providedIn: 'root'
})
export class CommandOrchestratorService {
  private readonly http = inject(HttpClient);
  private readonly planner = inject(CommandPlannerService);
  private readonly executor = inject(ActionExecutorService);
  private readonly responseFormatter = inject(VoiceResponseService);
  private readonly auditService = inject(VoiceAuditService);
  private readonly contextService = inject(VoiceContextService);
  private readonly perfService = inject(VoicePerformanceService);
  private readonly tts = inject(TextToSpeechService);

  readonly state = signal<AssistantState>('IDLE');
  readonly stateLabel = signal<string>('Ready');
  readonly currentTranscript = signal<string>('');
  readonly interimTranscript = signal<string>('');
  readonly timeline = signal<TimelineStep[]>([]);
  readonly activeCard = signal<ActionCardData | null>(null);
  readonly currentPlan = signal<ActionGraph | null>(null);

  private currentAbortController: AbortController | null = null;
  private autoSpeak = true;

  constructor() {
    this.tts.isSpeaking$.subscribe((speaking) => {
      if (!speaking && this.state() === 'SPEAKING') {
        this.setState('IDLE', 'Ready');
      }
    });
  }

  setAutoSpeak(enabled: boolean) {
    this.autoSpeak = enabled;
  }

  private setState(nextState: AssistantState, label?: string) {
    this.state.set(nextState);
    if (label) this.stateLabel.set(label);
  }

  private addTimelineStep(label: string): string {
    const id = `step-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`;
    const step: TimelineStep = { id, label, status: 'ACTIVE', timestamp: Date.now() };
    this.timeline.update((list) => [...list.slice(-6), step]);
    return id;
  }

  private completeTimelineStep(id: string, success = true) {
    this.timeline.update((list) =>
      list.map((s) => (s.id === id ? { ...s, status: success ? 'DONE' : 'FAILED' } : s))
    );
  }

  handleInterimTranscript(interim: string) {
    this.interimTranscript.set(interim);
    if (this.state() !== 'LISTENING' && this.state() !== 'TRANSCRIBING') {
      this.setState('TRANSCRIBING', 'Transcribing...');
    }
  }

  async handleFinalTranscript(transcript: string) {
    const raw = transcript.trim();
    if (!raw) {
      this.setState('IDLE', 'Ready');
      return;
    }

    // Abort in-flight network request if user spoke new instruction
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    this.currentTranscript.set(raw);
    this.interimTranscript.set('');
    this.perfService.markTranscriptReady();

    // 1. UNDERSTANDING & PLANNING: Build Dynamic ActionGraph
    this.setState('UNDERSTANDING', 'Synthesizing intent...');
    const stepPlan = this.addTimelineStep(`Planning: "${raw.slice(0, 28)}..."`);
    
    const graph = this.planner.planCommand(raw);
    this.currentPlan.set(graph);
    this.perfService.markIntentReady();
    this.completeTimelineStep(stepPlan, true);

    this.contextService.recordInteraction('user', raw, graph.intent);

    // 2. EXECUTION: Execute nodes in ActionGraph
    this.perfService.markExecutionStart();
    this.setState('EXECUTING', 'Executing actions...');

    // Add individual step entries to timeline
    const nodeStepIds = graph.nodes.map((n) => this.addTimelineStep(n.name));

    try {
      const execResult: GraphExecutionResult = await this.executor.executePlan(graph);
      this.perfService.markFirstResponse();

      // Mark timeline steps complete
      nodeStepIds.forEach((id) => this.completeTimelineStep(id, execResult.success));

      if (execResult.activeActionCard) {
        this.activeCard.set(execResult.activeActionCard);
      }

      // Record Audit Log
      this.auditService.recordExecution({
        query: raw,
        intent: graph.intent,
        actionsPlanned: graph.nodes.map((n) => n.capabilityId),
        riskLevel: graph.nodes[0]?.riskLevel || 'READ_ONLY',
        executionStatus: execResult.success ? (execResult.requiresConfirmation ? 'CONFIRM_REQUIRED' : 'SUCCESS') : 'FAILED',
        perceivedLatencyMs: this.perfService.lastTelemetry()?.totalPerceivedLatencyMs || 150,
        confirmationRequired: execResult.requiresConfirmation
      });

      if (execResult.requiresConfirmation) {
        this.setState('CONFIRM_REQUIRED', 'Confirmation required on screen');
        if (this.autoSpeak && execResult.spokenSummary) {
          this.speakOutput(execResult.spokenSummary);
        }
      } else if (execResult.success) {
        if (this.autoSpeak && execResult.spokenSummary) {
          this.speakOutput(execResult.spokenSummary);
        } else {
          this.setState('SUCCESS', execResult.uiMessage || 'Action Completed');
          setTimeout(() => {
            if (this.state() === 'SUCCESS') this.setState('IDLE', 'Ready');
          }, 3000);
        }
      } else {
        this.setState('ERROR', execResult.uiMessage || 'Action Failed');
        if (this.autoSpeak && execResult.spokenSummary) {
          this.speakOutput(execResult.spokenSummary);
        }
      }
    } catch (err: any) {
      const formatted = this.responseFormatter.formatErrorMessage(err);
      this.setState('ERROR', formatted.ui);
      this.speakOutput(formatted.voice);
    } finally {
      this.perfService.markCompleted();
    }
  }

  private speakOutput(text: string) {
    if (!text) return;
    this.setState('SPEAKING', 'Speaking...');
    this.perfService.markSpeechStart();
    this.contextService.recordInteraction('assistant', text);
    this.tts.speak(text);
  }

  cancel() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.tts.cancel();
    this.setState('IDLE', 'Ready');
    this.interimTranscript.set('');
  }

  dismissActiveCard() {
    this.activeCard.set(null);
  }
}
