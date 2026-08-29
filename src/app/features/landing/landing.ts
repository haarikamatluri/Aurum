import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="landing-page">
      <!-- Navbar -->
      <header class="navbar">
        <div class="navbar-container">
          <!-- Logo -->
          <div class="logo">
            <div class="logo-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span class="logo-text">Money</span>
          </div>

          <!-- Nav Links -->
          <nav class="nav-links">
            <a href="#features" class="nav-link">Features</a>
            <a href="#markets" class="nav-link">Markets</a>
            <a href="#how-it-works" class="nav-link">How it Works</a>
            <a href="#pricing" class="nav-link">Pricing</a>
            <div class="nav-dropdown-trigger">
              <a href="#resources" class="nav-link">Resources</a>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </nav>

          <!-- Auth Actions -->
          <div class="nav-actions">
            <a routerLink="/login" class="btn-login">Log in</a>
            <button class="btn-get-started" (click)="enter()" id="nav-get-started-btn">Get Started</button>
          </div>
        </div>
      </header>

      <!-- Main Hero Area -->
      <main class="hero-section">
        <!-- Background SVG Trend Line -->
        <div class="hero-chart-bg" aria-hidden="true">
          <svg viewBox="0 0 1440 400" fill="none" preserveAspectRatio="none" class="chart-svg-line">
            <path
              d="M 0,260 L 15,250 L 30,255 L 45,245 L 60,260 L 80,240 L 95,248 L 120,230 L 140,240 L 160,225 L 180,245 L 205,210 L 230,200 L 250,220 L 275,190 L 300,210 L 325,200 L 350,220 L 375,250 L 400,270 L 430,260 L 460,250 L 490,260 L 525,230 L 550,245 L 575,225 L 600,240 L 640,290 L 675,300 L 710,290 L 740,310 L 780,300 L 820,270 L 860,285 L 900,265 L 940,280 L 975,240 L 1010,255 L 1050,210 L 1090,230 L 1125,180 L 1160,200 L 1200,160 L 1240,190 L 1280,140 L 1320,165 L 1360,120 L 1400,140 L 1435,100"
              stroke="#00C076"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <!-- Endpoint Marker -->
            <circle cx="1435" cy="100" r="5" fill="#00C076" stroke="#FFFFFF" stroke-width="2" />
          </svg>

          <!-- Floating Stock Cards -->
          <!-- 1. Top Left: RELIANCE -->
          <div class="floating-stock-card card-reliance">
            <div class="stock-head">
              <span class="stock-symbol">RELIANCE</span>
            </div>
            <div class="stock-body">
              <span class="stock-exchange">NSE</span>
              <span class="stock-pnl positive">+2.45% ▲</span>
            </div>
          </div>

          <!-- 2. Bottom Left: AAPL -->
          <div class="floating-stock-card card-aapl">
            <div class="stock-head">
              <span class="stock-symbol">AAPL</span>
            </div>
            <div class="stock-body">
              <span class="stock-exchange">NASDAQ</span>
              <span class="stock-pnl positive">+1.92% ▲</span>
            </div>
          </div>

          <!-- 3. Top Right: TCS -->
          <div class="floating-stock-card card-tcs">
            <div class="stock-head">
              <span class="stock-symbol">TCS</span>
            </div>
            <div class="stock-body">
              <span class="stock-exchange">NSE</span>
              <span class="stock-pnl negative">-1.34% ▼</span>
            </div>
          </div>

          <!-- 4. Bottom Right: MSFT -->
          <div class="floating-stock-card card-msft">
            <div class="stock-head">
              <span class="stock-symbol">MSFT</span>
            </div>
            <div class="stock-body">
              <span class="stock-exchange">NASDAQ</span>
              <span class="stock-pnl positive">+3.18% ▲</span>
            </div>
          </div>
        </div>

        <!-- Center Hero Content -->
        <div class="hero-content">
          <!-- Pill Badge -->
          <div class="pill-badge">
            <span class="pill-dot"></span>
            <span>Personal Investment Monitor</span>
          </div>

          <!-- Title with Editorial Typography -->
          <h1 class="hero-headline">
            Know When<br>
            Your <span class="accent-text">Stocks Move</span>
          </h1>

          <!-- Subtitle -->
          <p class="hero-description">
            Monitor your investments. Get notified every 5%.<br>
            Ask AI when you need answers.
          </p>

          <!-- CTA Button -->
          <div class="cta-block">
            <button class="btn-hero-cta" (click)="enter()" id="hero-get-started-btn">
              <span>Get Started</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
            <p class="sign-in-prompt">
              Already have an account? <a routerLink="/login" class="sign-in-link">Sign in</a>
            </p>
          </div>
        </div>

        <!-- 3 Horizontal Feature Cards -->
        <section class="features-grid" id="features">
          <!-- Card 1: 5% Movement Alerts -->
          <div class="feature-card">
            <div class="feature-icon-wrapper icon-green">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div class="feature-text">
              <h3 class="feature-title">5% Movement Alerts</h3>
              <p class="feature-desc">Get notified the moment any stock crosses a 5% threshold.</p>
            </div>
          </div>

          <!-- Card 2: Your Portfolio -->
          <div class="feature-card">
            <div class="feature-icon-wrapper icon-blue">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
              </svg>
            </div>
            <div class="feature-text">
              <h3 class="feature-title">Your Portfolio</h3>
              <p class="feature-desc">Track all your holdings in one place and know what it's worth.</p>
            </div>
          </div>

          <!-- Card 3: AI Analyst -->
          <div class="feature-card">
            <div class="feature-icon-wrapper icon-purple">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div class="feature-text">
              <h3 class="feature-title">AI Analyst</h3>
              <p class="feature-desc">Ask about any stock for real-time sentiment and key risk factors.</p>
            </div>
          </div>
        </section>

        <!-- Markets / Exchanges Trust Bar -->
        <section class="trust-bar-section" id="markets">
          <div class="trust-divider">
            <span class="trust-label">Trusted by investors tracking markets across the globe</span>
          </div>
          <div class="logos-row">
            <!-- NSE -->
            <div class="market-logo-item">
              <svg viewBox="0 0 100 32" height="26" class="market-logo-svg">
                <g fill="none" fill-rule="evenodd">
                  <circle cx="16" cy="16" r="12" fill="#E65100" />
                  <path d="M 8,16 L 24,16 M 16,8 L 16,24" stroke="#FFFFFF" stroke-width="2.5" />
                  <text x="36" y="21" fill="#0F172A" font-size="16" font-weight="900" font-family="system-ui, sans-serif" letter-spacing="1">NSE</text>
                </g>
              </svg>
            </div>

            <!-- BSE -->
            <div class="market-logo-item">
              <svg viewBox="0 0 100 32" height="26" class="market-logo-svg">
                <g fill="none" fill-rule="evenodd">
                  <path d="M 8,24 C 8,24 16,26 16,14 C 16,6 24,6 24,6 C 24,6 18,12 22,18 C 24,21 21,26 14,26 Z" fill="#F59E0B" />
                  <text x="34" y="21" fill="#0F172A" font-size="16" font-weight="900" font-family="system-ui, sans-serif" font-style="italic" letter-spacing="1">BSE</text>
                </g>
              </svg>
            </div>

            <!-- Nasdaq -->
            <div class="market-logo-item">
              <svg viewBox="0 0 120 32" height="26" class="market-logo-svg">
                <g fill="none" fill-rule="evenodd">
                  <path d="M 6,24 L 14,6 L 22,24 L 18,24 L 14,14 L 10,24 Z" fill="#0284C7" />
                  <text x="28" y="21" fill="#0F172A" font-size="16" font-weight="800" font-family="system-ui, sans-serif">Nasdaq</text>
                </g>
              </svg>
            </div>

            <!-- NYSE -->
            <div class="market-logo-item">
              <svg viewBox="0 0 100 32" height="26" class="market-logo-svg">
                <g fill="none" fill-rule="evenodd">
                  <rect x="6" y="6" width="3" height="18" fill="#0284C7" />
                  <rect x="12" y="6" width="3" height="18" fill="#0284C7" />
                  <rect x="18" y="6" width="3" height="18" fill="#0284C7" />
                  <text x="28" y="21" fill="#0F172A" font-size="16" font-weight="900" font-family="system-ui, sans-serif" letter-spacing="1">NYSE</text>
                </g>
              </svg>
            </div>

            <!-- Global Markets -->
            <div class="market-logo-item">
              <svg viewBox="0 0 140 32" height="26" class="market-logo-svg">
                <g fill="none" fill-rule="evenodd">
                  <circle cx="14" cy="16" r="10" stroke="#00B37E" stroke-width="2" />
                  <ellipse cx="14" cy="16" rx="5" ry="10" stroke="#00B37E" stroke-width="1.5" />
                  <line x1="4" y1="16" x2="24" y2="16" stroke="#00B37E" stroke-width="1.5" />
                  <text x="32" y="15" fill="#0F172A" font-size="10" font-weight="800" font-family="system-ui, sans-serif" letter-spacing="0.5">GLOBAL</text>
                  <text x="32" y="24" fill="#64748B" font-size="9" font-weight="700" font-family="system-ui, sans-serif" letter-spacing="0.5">MARKETS</text>
                </g>
              </svg>
            </div>
          </div>
        </section>
      </main>
    </div>
  `,
  styleUrl: './landing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  constructor(private router: Router) {}

  enter(): void {
    this.router.navigate(['/signup']);
  }
}
