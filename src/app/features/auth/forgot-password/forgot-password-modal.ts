import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="fp-title">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-left">
            <h2 id="fp-title">Reset Password</h2>
          </div>
          <button type="button" class="close-btn" (click)="close.emit()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          @if (step() === 1) {
            <!-- Step 1: Enter Email -->
            <p class="step-desc">
              Enter your account's email address. We'll generate a secure 6-digit verification code to reset your password.
            </p>

            @if (errorMessage()) {
              <div class="form-error" role="alert">{{ errorMessage() }}</div>
            }

            <form (ngSubmit)="onRequestCode()" class="step-form">
              <div class="field">
                <label for="reset-email" class="field-label">Email Address</label>
                <input
                  id="reset-email"
                  type="email"
                  class="field-input"
                  placeholder="you@example.com"
                  [(ngModel)]="email"
                  name="email"
                  required
                  autocomplete="email"
                  autofocus
                >
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="close.emit()">Cancel</button>
                <button type="submit" class="btn-primary" [disabled]="!email.trim() || submitting()">
                  {{ submitting() ? 'Sending Code…' : 'Send Reset Code' }}
                </button>
              </div>
            </form>
          } @else if (step() === 2) {
            <!-- Step 2: Enter Code & New Password -->
            <p class="step-desc">
              Verification code generated for <strong>{{ email }}</strong>. Enter the 6-digit code and your new password below.
            </p>

            @if (generatedCode()) {
              <div class="code-banner">
                <div class="code-banner-header">
                  <span class="code-label">🔑 Your 6-Digit Reset Code:</span>
                  <button type="button" class="btn-autofill" (click)="autofillCode()">Apply to Input</button>
                </div>
                <div class="code-display">{{ generatedCode() }}</div>
                <span class="code-expiry">Expires in 15 minutes</span>
              </div>
            }

            @if (errorMessage()) {
              <div class="form-error" role="alert">{{ errorMessage() }}</div>
            }

            <form (ngSubmit)="onResetPassword()" class="step-form">
              <div class="field">
                <label for="reset-code" class="field-label">6-Digit Verification Code</label>
                <input
                  id="reset-code"
                  type="text"
                  class="field-input field-input-mono field-code"
                  placeholder="e.g. 849201"
                  [(ngModel)]="code"
                  name="code"
                  maxlength="6"
                  required
                  autocomplete="one-time-code"
                  autofocus
                >
              </div>

              <div class="field">
                <label for="new-password" class="field-label">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  class="field-input"
                  placeholder="At least 8 characters"
                  [(ngModel)]="newPassword"
                  name="newPassword"
                  minlength="8"
                  required
                  autocomplete="new-password"
                >
              </div>

              <div class="field">
                <label for="confirm-new-password" class="field-label">Confirm New Password</label>
                <input
                  id="confirm-new-password"
                  type="password"
                  class="field-input"
                  placeholder="••••••••"
                  [(ngModel)]="confirmPassword"
                  name="confirmPassword"
                  required
                  autocomplete="new-password"
                >
                @if (confirmPassword && newPassword !== confirmPassword) {
                  <span class="field-error-inline">Passwords do not match</span>
                }
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="step.set(1)">Back</button>
                <button type="submit" class="btn-primary" [disabled]="!canSubmitReset() || submitting()">
                  {{ submitting() ? 'Updating…' : 'Update Password' }}
                </button>
              </div>
            </form>
          } @else {
            <!-- Step 3: Success -->
            <div class="success-box">
              <div class="success-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="#00B37E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="28" height="28">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h3>Password Reset Successful!</h3>
              <p>Your password has been updated. You can now sign in to your Aurum account.</p>
              <button type="button" class="btn-primary btn-full" (click)="onSuccessDone()">
                Back to Sign In
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './forgot-password-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordModal {
  @Output() close = new EventEmitter<void>();
  @Output() passwordReset = new EventEmitter<string>();

  private readonly auth = inject(AuthService);

  protected readonly step = signal<1 | 2 | 3>(1);
  protected email = '';
  protected code = '';
  protected newPassword = '';
  protected confirmPassword = '';
  protected readonly generatedCode = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected autofillCode(): void {
    if (this.generatedCode()) {
      this.code = this.generatedCode()!;
    }
  }

  protected canSubmitReset(): boolean {
    return (
      this.code.trim().length === 6 &&
      this.newPassword.length >= 8 &&
      this.newPassword === this.confirmPassword
    );
  }

  protected async onRequestCode(): Promise<void> {
    if (!this.email.trim() || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);

    try {
      const res = await this.auth.requestPasswordReset(this.email.trim());
      if (res.code) {
        this.generatedCode.set(res.code);
        this.code = res.code;
      }
      this.step.set(2);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Could not request password reset');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async onResetPassword(): Promise<void> {
    if (!this.canSubmitReset() || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);

    try {
      await this.auth.resetPassword(this.email.trim(), this.code.trim(), this.newPassword);
      this.step.set(3);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      this.submitting.set(false);
    }
  }

  protected onSuccessDone(): void {
    this.passwordReset.emit(this.email);
    this.close.emit();
  }
}
