// ============================================================================
// Money — Notification Models
// ============================================================================

export type NotificationDirection = 'UP' | 'DOWN';

export interface MoneyNotification {
  id: string;
  holdingId: string;
  symbol: string;
  companyName: string;
  direction: NotificationDirection;
  thresholdPct: number;       // e.g. 5, 10, -5, -10
  price: number;              // Price when alert fired
  referencePrice: number;     // Reference price used for calculation
  message: string;
  isRead: boolean;
  createdAt: string;
}
