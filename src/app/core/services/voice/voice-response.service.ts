import { Injectable, inject } from '@angular/core';
import { CapabilityRegistryService } from './capability-registry.service';

@Injectable({
  providedIn: 'root'
})
export class VoiceResponseService {
  private readonly registry = inject(CapabilityRegistryService);

  formatVoiceSummary(actionName: string, data: any): string {
    if (!data) return 'Done.';
    if (typeof data === 'string') return data;
    return data.spokenFeedback || data.message || 'Operation completed.';
  }

  formatErrorMessage(error: any): { voice: string; ui: string } {
    const raw = typeof error === 'string' ? error : (error?.message || '');
    const lower = raw.toLowerCase();

    if (lower.includes('network') || lower.includes('failed to fetch')) {
      return {
        voice: "I'm having trouble connecting to the market data service. You can still navigate your cached portfolio.",
        ui: 'Network disconnected. Operating in offline cached mode.'
      };
    }
    if (lower.includes('risk') || lower.includes('order value')) {
      return {
        voice: `Order blocked by pre-trade risk engine: ${raw}`,
        ui: `Pre-Trade Risk Block: ${raw}`
      };
    }
    if (lower.includes('kill switch')) {
      return {
        voice: 'Trading is currently halted by the emergency risk kill switch.',
        ui: 'Emergency Kill Switch is Active. All order submission is blocked.'
      };
    }
    if (lower.includes('broker') || lower.includes('unauthorized') || lower.includes('token')) {
      return {
        voice: 'Broker session requires authentication. Please sync your broker credentials.',
        ui: 'Broker authentication required. Open Broker Sync settings.'
      };
    }

    return {
      voice: `I couldn't complete that operation: ${raw || 'action could not be verified'}.`,
      ui: `Execution Warning: ${raw || 'Operation failed'}`
    };
  }

  generateHelpDescription(): string {
    const total = this.registry.getAllCapabilities().length;
    return `Aurum Universal Operating System has ${total} registered capabilities across Navigation, Portfolio Tracking, AI Research, Pre-Trade Risk Orders, Price Alerts, and ML Strategy Inference. Speak naturally to command any section.`;
  }
}
