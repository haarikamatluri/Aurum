import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AiAnalystService } from '../../core/services/ai-analyst.service';
import { AiChat } from '../../shared/ui/ai-chat/ai-chat';
import { Icon } from '../../shared/ui/icon/icon';
import { groupByDate } from '../../shared/utils/date-groups';

@Component({
  selector: 'app-ai-analyst-page',
  standalone: true,
  imports: [AiChat, Icon],
  templateUrl: './ai-analyst.html',
  styleUrl: './ai-analyst.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAnalystPage {
  private readonly aiService = inject(AiAnalystService);

  protected readonly conversations = this.aiService.conversations;
  protected readonly activeId = signal<string | null>(null);
  protected readonly historyOpen = signal(false);

  protected readonly groups = computed(() => groupByDate([...this.conversations()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))));

  selectConversation(id: string): void {
    this.activeId.set(id);
    this.historyOpen.set(false);
  }

  onConversationIdChange(id: string): void {
    this.activeId.set(id || null);
  }

  startNew(): void {
    this.activeId.set(null);
    this.historyOpen.set(false);
  }
}
