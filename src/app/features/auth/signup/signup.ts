import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

declare const google: any;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { mismatch: true };
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
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

        <h1>Create your account</h1>
        <p class="subtitle">Track your holdings and get notified every 5% move.</p>

        @if (errorMessage()) {
          <div class="form-error" role="alert">{{ errorMessage() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form">
          <div class="field">
            <label class="field-label" for="name">Name</label>
            <input id="name" type="text" class="input" formControlName="name" autocomplete="name" placeholder="Your name" />
          </div>
          <div class="field">
            <label class="field-label" for="email">Email</label>
            <input id="email" type="email" class="input" formControlName="email" autocomplete="email" placeholder="you@example.com" />
          </div>
          <div class="field">
            <label class="field-label" for="password">Password</label>
            <input id="password" type="password" class="input" formControlName="password" autocomplete="new-password" placeholder="At least 8 characters" />
          </div>
          <div class="field">
            <label class="field-label" for="confirmPassword">Confirm password</label>
            <input id="confirmPassword" type="password" class="input" formControlName="confirmPassword" autocomplete="new-password" placeholder="••••••••" />
            @if (hasPasswordMismatch) {
              <span class="field-error">Passwords don't match</span>
            }
          </div>
          <button type="submit" class="btn btn-primary submit-btn" [disabled]="form.invalid || submitting()">
            {{ submitting() ? 'Creating account…' : 'Create account' }}
          </button>
        </form>

        @if (auth.googleEnabled()) {
          <div class="divider"><span>or</span></div>
          <div #googleBtn class="google-btn-container"></div>
        }

        <p class="fine-print">
          Already have an account? <a routerLink="/login">Sign in</a>
        </p>
      </div>
    </div>
  `,
  styleUrl: './signup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupPage implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  @ViewChild('googleBtn') private googleBtn?: ElementRef<HTMLDivElement>;

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected get hasPasswordMismatch(): boolean {
    return !!(this.form.errors?.['mismatch'] && this.form.get('confirmPassword')?.touched);
  }

  private googleInitTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (!this.auth.googleEnabled()) return;
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

    const containerWidth = this.googleBtn.nativeElement.offsetWidth || 370;
    google.accounts.id.renderButton(this.googleBtn.nativeElement, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signup_with',
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

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    const { name, email, password } = this.form.getRawValue();
    try {
      await this.auth.signup(name, email, password);
      this.router.navigateByUrl('/money');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Could not create your account');
    } finally {
      this.submitting.set(false);
    }
  }
}
