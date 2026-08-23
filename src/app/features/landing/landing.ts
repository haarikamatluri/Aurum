import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [],
  template: `
    <div class="landing">
      <!-- Background decoration -->
      <div class="bg-orb bg-orb-1"></div>
      <div class="bg-orb bg-orb-2"></div>

      <!-- Header -->
      <header class="landing-header">
        <div class="logo">
          <div class="logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span class="logo-text">Money</span>
        </div>
      </header>

      <!-- Hero Section (Auto-fits 100vh) -->
      <main class="hero">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="badge-dot"></span>
            Personal Investment Monitor
          </div>

          <h1 class="hero-title">
            Know When Your<br>
            <span class="title-accent">Stocks Move.</span>
          </h1>

          <p class="hero-subtitle">
            Monitor your investments. Get notified every 5%.<br>
            Ask AI when you need answers.
          </p>

          <div class="cta-wrap">
            <button class="cta-btn" (click)="enter()" id="enter-money-btn">
              <span>Money Creates Money</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
            <p class="cta-note">No account required. Start instantly.</p>
          </div>
        </div>

        <!-- Compact Feature Cards Row -->
        <div class="features">
          <div class="feature-card">
            <div class="feature-top">
              <div class="feature-icon feature-icon-blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <h3>5% Movement Alerts</h3>
            </div>
            <p>Get notified the moment any stock crosses a 5% threshold.</p>
          </div>

          <div class="feature-card">
            <div class="feature-top">
              <div class="feature-icon feature-icon-green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <h3>Your Portfolio</h3>
            </div>
            <p>Add your holdings. Track what you've invested and what it's worth.</p>
          </div>

          <div class="feature-card">
            <div class="feature-top">
              <div class="feature-icon feature-icon-purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h3>AI Analyst</h3>
            </div>
            <p>Ask about any stock for real-time sentiment and key risk factors.</p>
          </div>
        </div>
      </main>

      <!-- Minimal Footer -->
      <footer class="landing-footer">
        <p>Money provides investment monitoring for informational purposes only. Not financial advice.</p>
      </footer>
    </div>
  `,
  styleUrl: './landing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  constructor(private router: Router) {}

  enter(): void {
    this.router.navigate(['/money']);
  }
}
