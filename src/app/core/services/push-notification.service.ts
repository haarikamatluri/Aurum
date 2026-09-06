import { Injectable, signal } from '@angular/core';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  readonly isSupported = signal<boolean>(
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  );
  readonly isSubscribed = signal<boolean>(false);
  readonly permission = signal<NotificationPermission>('default');
  readonly loading = signal<boolean>(false);

  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    if (this.isSupported()) {
      this.initServiceWorker();
    }
  }

  private async initServiceWorker(): Promise<void> {
    try {
      this.permission.set(Notification.permission);
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      const existingSub = await this.swRegistration.pushManager.getSubscription();
      this.isSubscribed.set(!!existingSub);
    } catch (err) {
      console.warn('[PushNotificationService] SW registration failed:', err);
    }
  }

  async subscribeUser(): Promise<boolean> {
    if (!this.isSupported()) return false;
    this.loading.set(true);

    try {
      // 1. Request browser notification permission
      const perm = await Notification.requestPermission();
      this.permission.set(perm);
      if (perm !== 'granted') {
        this.loading.set(false);
        return false;
      }

      if (!this.swRegistration) {
        this.swRegistration = await navigator.serviceWorker.ready;
      }

      // 2. Fetch VAPID public key from backend
      const keyRes = await fetch('/api/notifications/vapid-public-key');
      if (!keyRes.ok) throw new Error('Failed to retrieve VAPID public key');
      const { publicKey } = await keyRes.json();
      if (!publicKey) throw new Error('VAPID public key empty');

      // 3. Subscribe with PushManager
      const convertedKey = urlBase64ToUint8Array(publicKey);
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });

      // 4. Send subscription object to backend
      const subRes = await fetch('/api/notifications/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      if (subRes.ok) {
        this.isSubscribed.set(true);
        this.loading.set(false);
        return true;
      }
    } catch (err) {
      console.error('[PushNotificationService] Subscription failed:', err);
    }

    this.loading.set(false);
    return false;
  }

  async unsubscribeUser(): Promise<boolean> {
    if (!this.isSupported()) return false;
    this.loading.set(true);

    try {
      if (!this.swRegistration) {
        this.swRegistration = await navigator.serviceWorker.ready;
      }
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
      this.isSubscribed.set(false);
      this.loading.set(false);
      return true;
    } catch (err) {
      console.error('[PushNotificationService] Unsubscribe failed:', err);
      this.loading.set(false);
      return false;
    }
  }

  async sendTestPush(): Promise<boolean> {
    try {
      const res = await fetch('/api/notifications/test-push', { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }
}
