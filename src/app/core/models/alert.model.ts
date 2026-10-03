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
  threshold: number;          // e.g. 5, 10, -5, -10 (The highest trigger)
  thresholdsCrossed: number[];// e.g. [5, 10, 15]
  movementPercent: number;    // Actual percentage movement
  price: number;              // Price when alert fired
  referencePrice: number;     // Reference price used for calculation
  message: string;
  isRead: boolean;
  createdAt: string;
}
