import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ForgotPasswordModal } from '../forgot-password/forgot-password-modal';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ForgotPasswordModal],
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
    google.accounts.id.renderButton(this.googleBtn.nativeElement, { theme: 'filled_black', size: 'large', width: 280 });
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

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email, password);
      this.router.navigateByUrl('/money');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      this.submitting.set(false);
    }
  }

  onPasswordReset(email: string): void {
    if (email) {
      this.form.patchValue({ email, password: '' });
    }
    this.resetSuccessNotice.set('✓ Password updated successfully! Please sign in with your new password.');
    setTimeout(() => this.resetSuccessNotice.set(null), 6000);
  }
}
