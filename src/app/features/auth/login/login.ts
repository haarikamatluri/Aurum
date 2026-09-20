import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ForgotPasswordModal } from '../forgot-password/forgot-password-modal';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, ForgotPasswordModal],
  template: `
    <div class="auth-page">
      <div class="bg-orb bg-orb-1"></div>
      <div class="bg-orb bg-orb-2"></div>

      <div class="auth-card card">
        <div class="brand-row">
          <div class="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <path d="M12 3L3 20h4.5l2-4.5h5l2 4.5H21L12 3z"/>
              <path d="M10 12h4"/>
            </svg>
          </div>
          <span class="brand-name">Aurum</span>
        </div>

        <h1>Welcome back</h1>
        <p class="subtitle">Sign in to keep watching your portfolio move.</p>

        @if (resetSuccessNotice()) {
          <div class="form-success" role="status">{{ resetSuccessNotice() }}</div>
        }

        @if (errorMessage()) {
          <div class="form-error" role="alert">{{ errorMessage() }}</div>
        }

        @if (!twoFactorStep()) {
          <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form">
            <div class="field">
              <label class="field-label" for="email">Email</label>
              <input id="email" type="email" class="input" formControlName="email" autocomplete="email" placeholder="you@example.com" />
            </div>
            <div class="field">
              <div class="field-label-row">
                <label class="field-label" for="password">Password</label>
                <button type="button" class="btn-link-forgot" (click)="showForgotModal.set(true)">
                  Forgot password?
                </button>
              </div>
              <input id="password" type="password" class="input" formControlName="password" autocomplete="current-password" placeholder="••••••••" />
            </div>
            <button type="submit" class="btn btn-primary submit-btn" [disabled]="form.invalid || submitting()">
              {{ submitting() ? 'Signing in…' : 'Sign in' }}
            </button>
          </form>

          @if (auth.googleEnabled()) {
            <div class="divider"><span>or</span></div>
            <div #googleBtn class="google-btn-container"></div>
          }

          <p class="fine-print">
            Don't have an account? <a routerLink="/signup">Create one</a>
          </p>
        } @else {
          <div class="two-factor-box">
            <div class="two-factor-header">
              <div class="security-shield-icon">🛡️</div>
              <h3>Two-Factor Authentication</h3>
              <p>Enter the 6-digit verification code from your Authenticator app (Google Authenticator, Authy, etc.).</p>
            </div>

            <div class="field">
              <label class="field-label" for="totpCode">6-Digit Code</label>
              <input
                id="totpCode"
                type="text"
                class="input totp-input"
                [(ngModel)]="totpCode"
                maxlength="6"
                placeholder="123456"
                autocomplete="one-time-code"
                (keyup.enter)="verifyTotp()"
              />
            </div>

            <button
              type="button"
              class="btn btn-primary submit-btn"
              [disabled]="totpCode.length < 6 || submitting()"
              (click)="verifyTotp()"
            >
              {{ submitting() ? 'Verifying…' : 'Verify & Continue' }}
            </button>

            <button
              type="button"
              class="btn-link-back"
              (click)="cancel2fa()"
            >
              &larr; Back to sign in
            </button>
          </div>
        }
      </div>

      @if (showForgotModal()) {
        <app-forgot-password-modal
          (close)="showForgotModal.set(false)"
          (passwordReset)="onPasswordReset($event)"
        />
      }
    </div>
  `,
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  @ViewChild('googleBtn') private googleBtn?: ElementRef<HTMLDivElement>;

  protected readonly showForgotModal = signal(false);
  protected readonly resetSuccessNotice = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  private googleInitTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (!this.auth.googleEnabled()) return;
    // The GIS script (loaded via <script async defer> in index.html) may not
    // be ready yet — poll briefly until `google` is available, then render.
    this.googleInitTimer = setInterval(() => this.tryRenderGoogleButton(), 200);
  }

  ngOnDestroy(): void {
    if (this.googleInitTimer) {
      clearInterval(this.googleInitTimer);
      this.googleInitTimer = null;
    }
  }

  private tryRenderGoogleButton(): void {
    if (typeof google === 'undefined' || !this.googleBtn) return;
    if (this.googleInitTimer) {
      clearInterval(this.googleInitTimer);
      this.googleInitTimer = null;
    }

    google.accounts.id.initialize({
      client_id: this.auth.googleClientId(),
      callback: (response: { credential: string }) => this.handleGoogleCredential(response.credential),
    });
    
    const containerWidth = this.googleBtn.nativeElement.offsetWidth || 350;
    google.accounts.id.renderButton(this.googleBtn.nativeElement, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: Math.min(Math.max(containerWidth, 280), 380),
    });
  }

  private async handleGoogleCredential(credential: string): Promise<void> {
    this.errorMessage.set(null);
    try {
      await this.auth.loginWithGoogle(credential);
      this.router.navigateByUrl('/money');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  }

  protected readonly twoFactorStep = signal(false);
  protected tempToken: string | null = null;
  totpCode = '';

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      const res = await this.auth.login(email, password);
      if (res.twoFactorRequired && res.tempToken) {
        this.tempToken = res.tempToken;
        this.twoFactorStep.set(true);
        this.totpCode = '';
        return;
      }
      this.router.navigateByUrl('/money');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      this.submitting.set(false);
    }
  }

  async verifyTotp(): Promise<void> {
    if (!this.tempToken || this.totpCode.length < 6 || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.login2fa(this.tempToken, this.totpCode.trim());
      this.router.navigateByUrl('/money');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Invalid 6-digit verification code');
    } finally {
      this.submitting.set(false);
    }
  }

  cancel2fa(): void {
    this.twoFactorStep.set(false);
    this.tempToken = null;
    this.totpCode = '';
    this.errorMessage.set(null);
  }

  onPasswordReset(email: string): void {
    if (email) {
      this.form.patchValue({ email, password: '' });
    }
    this.resetSuccessNotice.set('✓ Password updated successfully! Please sign in with your new password.');
    setTimeout(() => this.resetSuccessNotice.set(null), 6000);
  }
}
