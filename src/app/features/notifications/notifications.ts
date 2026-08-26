import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { NotificationService } from '../../core/services/notification.service';
import { MoneyNotification } from '../../core/models/alert.model';

interface NotificationGroup { label: string; items: MoneyNotification[]; }

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe, CurrencyPipe],
  template: `
    <div class="notifications-page">
      <div class="page-header">
        <div>
          <h1>Notifications</h1>
          <p class="subtitle">Price movement alerts for your portfolio.</p>
        </div>
        @if (notifService.unreadCount() > 0) {
          <button class="btn-mark-all" (click)="notifService.markAllRead()" id="mark-all-read-btn">
            Mark all as read
          </button>
        }
      </div>

      @if (groups().length > 0) {
        <div class="notif-list">
          @for (group of groups(); track group.label) {
            <div class="notif-group">
              <h3 class="group-label">{{ group.label }}</h3>
              @for (n of group.items; track n.id) {
                <div
                  class="notif-item"
                  [class.unread]="!n.isRead"
                  (click)="open(n)"
                  role="button"
                  tabindex="0"
                >
                  <div class="notif-icon" [class.up]="n.direction === 'UP'" [class.down]="n.direction === 'DOWN'">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                      @if (n.direction === 'UP') {
                        <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                      } @else {
                        <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                      }
                    </svg>
                  </div>

                  <div class="notif-content">
                    <div class="notif-headline">
                      <span class="notif-symbol">{{ n.symbol }}</span>
                      <span class="notif-threshold" [class.up]="n.direction === 'UP'" [class.down]="n.direction === 'DOWN'">
                        {{ n.direction === 'UP' ? '+' : '' }}{{ n.thresholdPct }}%
                      </span>
                    </div>
                    <p class="notif-message">{{ n.message }}</p>
                    <div class="notif-meta">
                      <span class="notif-time">{{ n.createdAt | date:'h:mm a' }}</span>
                      <span class="notif-price">Price: {{ n.price | currency }}</span>
                    </div>
                  </div>

                  @if (!n.isRead) {
                    <div class="unread-dot"></div>
                  }
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <!-- Empty state -->
        <div class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="40" height="40">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <h2>No notifications yet</h2>
          <p>You'll be notified here when any of your stocks cross a 5% movement threshold.</p>
        </div>
      }
    </div>
  `,
  styleUrl: './notifications.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage {
  protected readonly notifService = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly groups = computed<NotificationGroup[]>(() => {
    const notifications = this.notifService.notifications();
    if (notifications.length === 0) return [];

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

    const todayItems: MoneyNotification[] = [];
    const yesterdayItems: MoneyNotification[] = [];
    const olderItems: MoneyNotification[] = [];

    for (const n of notifications) {
      const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
      if (d.getTime() === today.getTime()) todayItems.push(n);
      else if (d.getTime() === yesterday.getTime()) yesterdayItems.push(n);
      else olderItems.push(n);
    }

    const groups: NotificationGroup[] = [];
    if (todayItems.length) groups.push({ label: 'Today', items: todayItems });
    if (yesterdayItems.length) groups.push({ label: 'Yesterday', items: yesterdayItems });
    if (olderItems.length) groups.push({ label: 'Earlier', items: olderItems });
    return groups;
  });

  open(n: MoneyNotification): void {
    this.notifService.markAsRead(n.id);
    this.router.navigate(['/money/stocks', n.symbol]);
  }
}
