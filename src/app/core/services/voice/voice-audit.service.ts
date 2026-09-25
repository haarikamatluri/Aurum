import { Injectable, signal } from '@angular/core';

export interface VoiceAuditRecord {
  id: string;
  timestamp: string;
  query: string;
  intent: string;
  actionsPlanned: string[];
  riskLevel: string;
  executionStatus: string;
  perceivedLatencyMs: number;
  confirmationRequired: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceAuditService {
  readonly auditLogs = signal<VoiceAuditRecord[]>([]);

  recordExecution(entry: Omit<VoiceAuditRecord, 'id' | 'timestamp'>) {
    const record: VoiceAuditRecord = {
      id: `vaudit-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };

    this.auditLogs.update((logs) => [record, ...logs.slice(0, 49)]);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('aurum.voice.audit', JSON.stringify(this.auditLogs().slice(0, 20)));
      }
    } catch {
      // ignore
    }
  }

  getRecentAudits(): VoiceAuditRecord[] {
    return this.auditLogs();
  }
}
