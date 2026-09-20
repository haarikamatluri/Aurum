import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AiAnalystService } from '../../core/services/ai-analyst.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { BrokerSyncService } from '../../core/services/broker-sync.service';
import { BrokerSyncModalComponent } from '../dashboard/broker-sync-modal/broker-sync-modal';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, BrokerSyncModalComponent],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <h1>Settings</h1>
      </div>

      <!-- Realtime Gemini AI Configuration -->
      <section class="settings-section">
        <h2 class="section-title">Google Gemini AI (Realtime Analysis)</h2>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-info">
              <div class="label-with-badge">
                <span class="setting-label">Gemini API Key</span>
                @if (aiService.hasApiKey()) {
                  <span class="status-badge active">🟢 Connected</span>
                } @else {
                  <span class="status-badge inactive">⚪ Not Configured</span>
                }
              </div>
              <span class="setting-desc">
                Enables real-time market analysis, company news sentiment, and risk evaluation via Google Gemini.
              </span>
            </div>
          </div>

          <div class="api-key-box">
            <div class="api-input-wrap">
              <input
                [type]="showKey() ? 'text' : 'password'"
                class="api-input"
                [(ngModel)]="apiKeyInput"
                placeholder="Paste your Gemini API key (e.g. AIzaSy...)"
                autocomplete="off"
              >
              <button type="button" class="btn-toggle-view" (click)="showKey.set(!showKey())" aria-label="Toggle key visibility">
                {{ showKey() ? 'Hide' : 'Show' }}
              </button>
            </div>

            <div class="api-key-actions">
              <button type="button" class="btn-save-key" (click)="saveApiKey()" [disabled]="!apiKeyInput.trim()">
                Save & Connect
              </button>
              @if (aiService.hasApiKey()) {
                <button type="button" class="btn-remove-key" (click)="removeApiKey()">
                  Remove Key
                </button>
              }
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-get-key"
              >
                <span>Get Free Gemini Key</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>

            @if (savedNotice()) {
              <div class="key-success-notice">
                ✓ Gemini API Key saved successfully! Real-time AI Analyst is active.
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Account -->
      <section class="settings-section">
        <h2 class="section-title">Account</h2>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Display Name</span>
              <span class="setting-desc">How your name appears in the app.</span>
            </div>
            @if (editingName()) {
              <div class="edit-inline">
                <input class="inline-input" type="text" [(ngModel)]="nameInput" (keyup.enter)="saveName()" (keyup.escape)="editingName.set(false)" placeholder="Your name" autofocus>
                <button class="btn-save" (click)="saveName()">Save</button>
                <button class="btn-cancel" (click)="editingName.set(false)">Cancel</button>
              </div>
            } @else {
              <div class="edit-row">
                <span class="setting-value">{{ auth.currentUser().name }}</span>
                <button class="btn-edit" (click)="startEditName()">Edit</button>
              </div>
            }
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Email Address</span>
              <span class="setting-desc">{{ auth.currentUser().email || 'Signed in as guest' }}</span>
            </div>
            <button type="button" class="btn-secondary" (click)="logout()">
              Sign Out
            </button>
          </div>
        </div>
      </section>

      <!-- Two-Factor Authentication (2FA / TOTP) -->
      <section class="settings-section">
        <h2 class="section-title">Security & Two-Factor Authentication</h2>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-info">
              <div class="label-with-badge">
                <span class="setting-label">Authenticator App (TOTP)</span>
                @if (auth.currentUser().twoFactorEnabled) {
                  <span class="status-badge active">🛡️ Enabled & Active</span>
                } @else {
                  <span class="status-badge inactive">⚪ Not Configured</span>
                }
              </div>
              <span class="setting-desc">
                Protect your account with RFC 6238 TOTP two-factor authentication (Google Authenticator, Microsoft Authenticator, Authy).
              </span>
            </div>
            @if (auth.currentUser().twoFactorEnabled) {
              <button class="btn-danger-outline" (click)="openDisable2faModal()">
                Disable 2FA
              </button>
            } @else {
              <button class="btn-primary-sm" (click)="openEnable2faModal()">
                Enable 2FA
              </button>
            }
          </div>
        </div>
      </section>

      <!-- Web Push Notifications -->
      <section class="settings-section">
        <h2 class="section-title">Web Push Notifications</h2>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-info">
              <div class="label-with-badge">
                <span class="setting-label">Real-time Background Push</span>
                @if (pushService.isSubscribed()) {
                  <span class="status-badge active">🔔 Subscribed</span>
                } @else {
                  <span class="status-badge inactive">🔕 Inactive</span>
                }
              </div>
              <span class="setting-desc">
                Receive instant 5% price movement notifications on your desktop or mobile even when the browser is closed or running in background.
              </span>
            </div>
            @if (pushService.isSubscribed()) {
              <div class="push-actions">
                <button class="btn-secondary-sm" (click)="testPushNotification()" [disabled]="testingPush()">
                  {{ testingPush() ? 'Sending...' : 'Send Test Alert' }}
                </button>
                <button class="btn-danger-outline" (click)="togglePushSubscription()">
                  Unsubscribe
                </button>
              </div>
            } @else {
              <button class="btn-primary-sm" (click)="togglePushSubscription()" [disabled]="pushService.loading()">
                {{ pushService.loading() ? 'Subscribing...' : 'Enable Web Push' }}
              </button>
            }
          </div>

          @if (pushMessage()) {
            <div class="key-success-notice">{{ pushMessage() }}</div>
          }
        </div>
      </section>

      <!-- Broker Integrations -->
      <section class="settings-section">
        <h2 class="section-title">Broker Integrations</h2>
        <div class="settings-card">
          <!-- Zerodha Kite -->
          <div class="setting-row">
            <div class="setting-info">
              <div class="label-with-badge">
                <span class="setting-label">Zerodha Kite (India)</span>
                @if (brokerService.zerodhaStatus().connected) {
                  <span class="status-badge active">🟢 Connected</span>
                } @else {
                  <span class="status-badge inactive">⚪ Not Connected</span>
                }
              </div>
              <span class="setting-desc">
                Direct portfolio synchronization for NSE / BSE demat holdings and CNC positions.
              </span>
            </div>
            <div class="broker-btns">
              <button class="btn-primary-sm" (click)="openBrokerSync('zerodha')">
                {{ brokerService.zerodhaStatus().connected ? 'Re-sync / Import' : 'Connect Zerodha' }}
              </button>
              @if (brokerService.zerodhaStatus().connected) {
                <button class="btn-danger-outline" (click)="brokerService.disconnectZerodha()">
                  Disconnect
                </button>
              }
            </div>
          </div>

          <!-- Webull -->
          <div class="setting-row">
            <div class="setting-info">
              <div class="label-with-badge">
                <span class="setting-label">Webull Financial (US)</span>
                @if (brokerService.webullStatus().connected) {
                  <span class="status-badge active">🟢 Connected</span>
                } @else {
                  <span class="status-badge inactive">⚪ Not Connected</span>
                }
              </div>
              <span class="setting-desc">
                Direct portfolio synchronization for NASDAQ and NYSE equity holdings and cost basis.
              </span>
            </div>
            <div class="broker-btns">
              <button class="btn-primary-sm" (click)="openBrokerSync('webull')">
                {{ brokerService.webullStatus().connected ? 'Re-sync / Import' : 'Connect Webull' }}
              </button>
              @if (brokerService.webullStatus().connected) {
                <button class="btn-danger-outline" (click)="brokerService.disconnectWebull()">
                  Disconnect
                </button>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- Privacy & Storage -->
      <section class="settings-section">
        <h2 class="section-title">Data Storage & Sync</h2>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Database Persistence</span>
              <span class="setting-desc">
                @if (dbConnected()) {
                  Connected to cloud MongoDB database. Holdings, transactions, and alert states sync across your devices.
                } @else {
                  Running in local offline mode. Data is stored on this device.
                }
              </span>
            </div>
            <span class="setting-badge" [class.badge-cloud]="dbConnected()">
              {{ dbConnected() ? 'Cloud Synced (MongoDB)' : 'Local Storage' }}
            </span>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Clear All Data</span>
              <span class="setting-desc">Remove all portfolio holdings and cached settings from this device.</span>
            </div>
            <button class="btn-danger" (click)="clearData()" id="clear-data-btn">Clear</button>
          </div>
        </div>
      </section>

      <!-- App info -->
      <div class="app-info">
        <span>Aurum — Personal Investment Intelligence</span>
        <span>·</span>
        <span>Google Gemini 2.0 Real-time Analysis</span>
      </div>

      <!-- 2FA Setup Modal -->
      @if (showEnable2faModal()) {
        <div class="modal-backdrop" (click)="close2faModal($event)">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Enable Two-Factor Authentication</h3>
              <button class="close-x" (click)="showEnable2faModal.set(false)">&times;</button>
            </div>
            <div class="modal-body">
              <p class="step-text">1. Scan this QR code in your Authenticator app (Google Authenticator, Authy, or Microsoft Authenticator):</p>
              @if (twoFaQrCode()) {
                <div class="qr-container">
                  <img [src]="twoFaQrCode()" alt="2FA QR Code" class="qr-img" />
                </div>
                <div class="secret-key-wrap">
                  <span class="secret-label">Manual key:</span>
                  <code>{{ twoFaSecret() }}</code>
                </div>
              } @else {
                <div class="loading-qr">Generating secure 2FA key...</div>
              }

              <p class="step-text">2. Enter the 6-digit verification code generated by your app:</p>
              <input
                type="text"
                class="totp-input"
                maxlength="6"
                placeholder="000000"
                [(ngModel)]="verificationCode"
                (keyup.enter)="confirmEnable2fa()"
              />

              @if (twoFaError()) {
                <div class="modal-error">{{ twoFaError() }}</div>
              }
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" (click)="showEnable2faModal.set(false)">Cancel</button>
              <button
                class="btn-save"
                [disabled]="verificationCode.length < 6 || twoFaLoading()"
                (click)="confirmEnable2fa()"
              >
                {{ twoFaLoading() ? 'Verifying...' : 'Verify & Enable' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- 2FA Disable Modal -->
      @if (showDisable2faModal()) {
        <div class="modal-backdrop" (click)="close2faModal($event)">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Disable Two-Factor Authentication</h3>
              <button class="close-x" (click)="showDisable2faModal.set(false)">&times;</button>
            </div>
            <div class="modal-body">
              <p>Please enter your account password to confirm disabling Two-Factor Authentication:</p>
              <input
                type="password"
                class="inline-input full-width"
                placeholder="Your account password"
                [(ngModel)]="disablePassword"
                (keyup.enter)="confirmDisable2fa()"
              />
              @if (twoFaError()) {
                <div class="modal-error">{{ twoFaError() }}</div>
              }
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" (click)="showDisable2faModal.set(false)">Cancel</button>
              <button
                class="btn-danger"
                [disabled]="!disablePassword || twoFaLoading()"
                (click)="confirmDisable2fa()"
              >
                {{ twoFaLoading() ? 'Disabling...' : 'Confirm Disable' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Broker Sync Modal -->
      @if (showBrokerModal()) {
        <app-broker-sync-modal
          (closeModal)="showBrokerModal.set(false)"
          (holdingsImported)="onHoldingsImported($event)"
        />
      }
    </div>
  `,
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly aiService = inject(AiAnalystService);
  protected readonly pushService = inject(PushNotificationService);
  protected readonly brokerService = inject(BrokerSyncService);
  private readonly router = inject(Router);

  // 2FA state
  protected readonly showEnable2faModal = signal(false);
  protected readonly showDisable2faModal = signal(false);
  protected readonly twoFaQrCode = signal<string>('');
  protected readonly twoFaSecret = signal<string>('');
  protected readonly twoFaLoading = signal<boolean>(false);
  protected readonly twoFaError = signal<string>('');
  verificationCode = '';
  disablePassword = '';

  // Push notification test state
  protected readonly testingPush = signal<boolean>(false);
  protected readonly pushMessage = signal<string>('');

  // Broker Sync state
  protected readonly showBrokerModal = signal<boolean>(false);

  protected readonly dbConnected = signal(false);
  protected readonly editingName = signal(false);
  protected nameInput = '';

  protected apiKeyInput = this.aiService.getApiKey();
  protected readonly showKey = signal(false);
  protected readonly savedNotice = signal(false);

  protected readonly notifAlerts = signal(true);

  ngOnInit(): void {
    fetch('/api/db/status')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.connected) {
          this.dbConnected.set(true);
        }
      })
      .catch(() => {});
  }

  startEditName(): void {
    this.nameInput = this.auth.currentUser().name;
    this.editingName.set(true);
  }

  saveName(): void {
    const name = this.nameInput.trim();
    if (name) {
      this.auth.updateUser(name).catch((err) => console.warn('[Settings] Could not save name:', err.message));
    }
    this.editingName.set(false);
  }

  saveApiKey(): void {
    this.aiService.setApiKey(this.apiKeyInput);
    this.savedNotice.set(true);
    setTimeout(() => this.savedNotice.set(false), 4000);
  }

  removeApiKey(): void {
    this.apiKeyInput = '';
    this.aiService.setApiKey('');
    this.savedNotice.set(false);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  clearData(): void {
    if (confirm('Are you sure? This will remove all your portfolio data and API key from this browser.')) {
      [
        'money.holdings',
        'money.transactions',
        'money.alertStates',
        'money.notifications',
        'money.user',
        'money.gemini_api_key',
      ].forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {
          /* ignore */
        }
      });
      window.location.reload();
    }
  }

  // 2FA Handlers
  async openEnable2faModal(): Promise<void> {
    this.twoFaError.set('');
    this.verificationCode = '';
    this.twoFaLoading.set(true);
    this.showEnable2faModal.set(true);
    try {
      const data = await this.auth.generate2fa();
      this.twoFaSecret.set(data.secret);
      this.twoFaQrCode.set(data.qrCode);
    } catch (err: any) {
      this.twoFaError.set(err?.message || 'Could not generate 2FA secret.');
    } finally {
      this.twoFaLoading.set(false);
    }
  }

  async confirmEnable2fa(): Promise<void> {
    if (this.verificationCode.length < 6) return;
    this.twoFaLoading.set(true);
    this.twoFaError.set('');
    try {
      await this.auth.verifyAndEnable2fa(this.twoFaSecret(), this.verificationCode.trim());
      this.showEnable2faModal.set(false);
      this.pushMessage.set('✓ Two-Factor Authentication activated successfully!');
      setTimeout(() => this.pushMessage.set(''), 4000);
    } catch (err: any) {
      this.twoFaError.set(err?.message || 'Verification failed. Please check your code.');
    } finally {
      this.twoFaLoading.set(false);
    }
  }

  openDisable2faModal(): void {
    this.twoFaError.set('');
    this.disablePassword = '';
    this.showDisable2faModal.set(true);
  }

  async confirmDisable2fa(): Promise<void> {
    if (!this.disablePassword) return;
    this.twoFaLoading.set(true);
    this.twoFaError.set('');
    try {
      await this.auth.disable2fa(this.disablePassword);
      this.showDisable2faModal.set(false);
      this.pushMessage.set('Two-Factor Authentication disabled.');
      setTimeout(() => this.pushMessage.set(''), 4000);
    } catch (err: any) {
      this.twoFaError.set(err?.message || 'Failed to disable 2FA.');
    } finally {
      this.twoFaLoading.set(false);
    }
  }

  close2faModal(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.showEnable2faModal.set(false);
      this.showDisable2faModal.set(false);
    }
  }

  // Web Push Handlers
  async togglePushSubscription(): Promise<void> {
    if (this.pushService.isSubscribed()) {
      await this.pushService.unsubscribeUser();
      this.pushMessage.set('Unsubscribed from Web Push alerts.');
    } else {
      const ok = await this.pushService.subscribeUser();
      if (ok) {
        this.pushMessage.set('✓ Web Push notifications enabled! Real-time alerts are active.');
      } else {
        this.pushMessage.set('Could not enable Web Push. Please check browser permission.');
      }
    }
    setTimeout(() => this.pushMessage.set(''), 4000);
  }

  async testPushNotification(): Promise<void> {
    this.testingPush.set(true);
    const ok = await this.pushService.sendTestPush();
    this.testingPush.set(false);
    if (ok) {
      this.pushMessage.set('✓ Test alert dispatched to your device!');
    } else {
      this.pushMessage.set('Failed to send test alert. Make sure push is subscribed.');
    }
    setTimeout(() => this.pushMessage.set(''), 4000);
  }

  // Broker Sync Handlers
  openBrokerSync(broker: 'zerodha' | 'webull'): void {
    this.brokerService.activeBroker.set(broker);
    this.showBrokerModal.set(true);
  }

  onHoldingsImported(count: number): void {
    this.pushMessage.set(`✓ Successfully imported ${count} holdings from your broker account!`);
    setTimeout(() => this.pushMessage.set(''), 5000);
  }
}
