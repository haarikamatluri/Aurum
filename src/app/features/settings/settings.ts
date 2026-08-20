import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { InvestorObjectiveOptions, InvestmentHorizonOptions, RiskToleranceOptions } from './settings.constants';
import { NotificationSettings, ThemePreference } from '../../core/models/user.model';
import { Icon } from '../../shared/ui/icon/icon';

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: string }[] = [
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'system', label: 'System', icon: 'monitor' },
];

const NOTIFICATION_ROWS: { key: keyof NotificationSettings; label: string; description: string }[] = [
  { key: 'priceAlerts', label: 'Price Alerts', description: 'Notify me when a holding crosses a price threshold.' },
  { key: 'marketAlerts', label: 'Market Alerts', description: 'Notify me about significant index or volatility moves.' },
  { key: 'portfolioAlerts', label: 'Portfolio Alerts', description: 'Notify me about concentration, drawdown, and risk changes.' },
  { key: 'dailyBriefing', label: 'Daily Briefing', description: 'Send a daily AI-generated summary of my portfolio and the market.' },
  { key: 'aiAlerts', label: 'AI Alerts', description: 'Notify me when the AI Analyst detects a noteworthy pattern.' },
];

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);

  protected readonly riskToleranceOptions = RiskToleranceOptions;
  protected readonly horizonOptions = InvestmentHorizonOptions;
  protected readonly objectiveOptions = InvestorObjectiveOptions;
  protected readonly themeOptions = THEME_OPTIONS;
  protected readonly notificationRows = NOTIFICATION_ROWS;

  protected readonly savedProfile = signal(false);
  protected readonly savedNotifications = signal(false);

  protected readonly profileForm = this.fb.nonNullable.group({
    riskTolerance: [this.userService.investorProfile().riskTolerance, Validators.required],
    investmentHorizon: [this.userService.investorProfile().investmentHorizon, Validators.required],
    primaryObjective: [this.userService.investorProfile().primaryObjective, Validators.required],
    maxDrawdownTolerancePct: [this.userService.investorProfile().maxDrawdownTolerancePct, [Validators.required, Validators.min(1), Validators.max(90)]],
  });

  protected readonly notifications = signal<NotificationSettings>(this.userService.notifications());
  protected readonly targetAllocations = this.userService.investorProfile().targetAllocations;

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    const raw = this.profileForm.getRawValue();
    this.userService.saveInvestorProfile({ ...this.userService.investorProfile(), ...raw }).subscribe(() => {
      this.savedProfile.set(true);
      setTimeout(() => this.savedProfile.set(false), 2200);
    });
  }

  toggleNotification(key: keyof NotificationSettings): void {
    this.notifications.update((n) => ({ ...n, [key]: !n[key] }));
    this.userService.saveNotificationSettings(this.notifications()).subscribe(() => {
      this.savedNotifications.set(true);
      setTimeout(() => this.savedNotifications.set(false), 1600);
    });
  }

  setTheme(pref: ThemePreference): void {
    this.theme.setPreference(pref);
  }
}
