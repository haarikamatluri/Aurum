import { TestBed } from '@angular/core/testing';
import { MonitoringService } from './monitoring.service';
import { PortfolioService } from './portfolio.service';
import { NotificationService } from './notification.service';
import { MarketRegion, CurrencyCode } from '../models/portfolio.model';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MonitoringService - Alert Movement Calculation', () => {
  let service: MonitoringService;
  let notifSpy: any;
  let portSpy: any;

  beforeEach(() => {
    notifSpy = {
      addNotification: vi.fn(),
      notifications: vi.fn().mockReturnValue([]),
      unreadCount: vi.fn().mockReturnValue(0),
      markAllRead: vi.fn(),
      markAsRead: vi.fn(),
      getForSymbol: vi.fn().mockReturnValue([])
    };
    
    portSpy = {
      getHoldingBySymbol: vi.fn(),
      updatePrice: vi.fn(),
      holdings: vi.fn().mockReturnValue([])
    };

    portSpy.getHoldingBySymbol.mockReturnValue({
      id: 'h1',
      symbol: 'TEST',
      companyName: 'Test Inc',
      market: 'US' as MarketRegion,
      currency: 'USD' as CurrencyCode,
      avgPurchasePrice: 100,
    });

    service = new (MonitoringService as any)();
    (service as any).portfolio = portSpy;
    (service as any).notifications = notifSpy;
  });

  afterEach(() => {
    service.stopMonitoring();
  });

  it('TEST 1: reference = 100, current = 105, expected movement = +5%', () => {
    service.processPriceUpdate('TEST', 105);
    expect(notifSpy.addNotification).toHaveBeenCalled();
    const notif = notifSpy.addNotification.mock.calls[0][0];
    expect(notif.movementPercent).toBe(5);
    expect(notif.direction).toBe('UP');
    expect(notif.thresholdsCrossed).toEqual([5]);
  });

  it('TEST 2: reference = 100, current = 110, expected movement = +10%', () => {
    service.processPriceUpdate('TEST', 110);
    const notif = notifSpy.addNotification.mock.calls[notifSpy.addNotification.mock.calls.length - 1][0];
    expect(notif.movementPercent).toBe(10);
    expect(notif.direction).toBe('UP');
    expect(notif.thresholdsCrossed).toEqual([5, 10]);
  });

  it('TEST 3: reference = 100, current = 118, expected movement = +18%', () => {
    service.processPriceUpdate('TEST', 118);
    const notif = notifSpy.addNotification.mock.calls[notifSpy.addNotification.mock.calls.length - 1][0];
    expect(notif.movementPercent).toBeCloseTo(18, 2);
    expect(notif.direction).toBe('UP');
    expect(notif.thresholdsCrossed).toEqual([5, 10, 15]);
  });

  it('TEST 4: reference = 100, current = 95, expected movement = -5%', () => {
    service.processPriceUpdate('TEST', 95);
    const notif = notifSpy.addNotification.mock.calls[notifSpy.addNotification.mock.calls.length - 1][0];
    expect(notif.movementPercent).toBe(-5);
    expect(notif.direction).toBe('DOWN');
    expect(notif.thresholdsCrossed).toEqual([-5]);
  });

  it('TEST 5: reference = 100, current = 82, expected movement = -18%', () => {
    service.processPriceUpdate('TEST', 82);
    const notif = notifSpy.addNotification.mock.calls[notifSpy.addNotification.mock.calls.length - 1][0];
    expect(notif.movementPercent).toBeCloseTo(-18, 2);
    expect(notif.direction).toBe('DOWN');
    expect(notif.thresholdsCrossed).toEqual([-5, -10, -15]);
  });

  it('TEST 6: reference = 195.40, current = 377.94, expects actual movement instead of sum', () => {
    service.initAlertState('h1', 'TSLA', 195.40, 'US', 'USD');
    service.updateReferencePrice('h1', 195.40);
    service.processPriceUpdate('TEST', 377.94);
    
    const expectedMovement = ((377.94 - 195.40) / 195.40) * 100;
    
    const notif = notifSpy.addNotification.mock.calls[notifSpy.addNotification.mock.calls.length - 1][0];
    expect(notif.movementPercent).toBeCloseTo(expectedMovement, 2);
    expect(notif.direction).toBe('UP');
    expect(notif.message).toContain(`Price moved up by ${Math.abs(expectedMovement).toFixed(2)}% today`);
  });

  it('TEST 7: Multiple alert evaluations over time do not sum cumulatively', () => {
    service.processPriceUpdate('TEST', 105);
    let notif = notifSpy.addNotification.mock.calls[notifSpy.addNotification.mock.calls.length - 1][0];
    expect(notif.movementPercent).toBe(5);

    service.processPriceUpdate('TEST', 110);
    notif = notifSpy.addNotification.mock.calls[notifSpy.addNotification.mock.calls.length - 1][0];
    expect(notif.movementPercent).toBe(10);

    service.processPriceUpdate('TEST', 115);
    notif = notifSpy.addNotification.mock.calls[notifSpy.addNotification.mock.calls.length - 1][0];
    expect(notif.movementPercent).toBe(15);
    expect(notif.message).toContain('15.00%');
  });

  it('TEST 8: Direction reversal', () => {
    service.processPriceUpdate('TEST', 110);
    let notif = notifSpy.addNotification.mock.calls[notifSpy.addNotification.mock.calls.length - 1][0];
    expect(notif.movementPercent).toBe(10);

    // Dropping from 110 to 103 means it went from +10% to +3% relative to reference (100).
    service.processPriceUpdate('TEST', 103);
    
    service.processPriceUpdate('TEST', 90);
    notif = notifSpy.addNotification.mock.calls[notifSpy.addNotification.mock.calls.length - 1][0];
    expect(notif.movementPercent).toBe(-10);
    expect(notif.direction).toBe('DOWN');
  });
});
