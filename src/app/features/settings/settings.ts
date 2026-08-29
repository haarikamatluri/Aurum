import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AiAnalystService } from '../../core/services/ai-analyst.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
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

      <!-- Notifications -->
      <section class="settings-section">
        <h2 class="section-title">Notifications</h2>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">5% Movement Alerts</span>
              <span class="setting-desc">Notify when stocks cross 5% thresholds (up or down).</span>
            </div>
            <div class="toggle" [class.on]="notifAlerts()" (click)="notifAlerts.set(!notifAlerts())" role="switch" [attr.aria-checked]="notifAlerts()">
              <div class="toggle-thumb"></div>
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
    </div>
  `,
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly aiService = inject(AiAnalystService);
  private readonly router = inject(Router);

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
}
