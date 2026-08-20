import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AlertService } from '../../core/services/alert.service';
import { AlertCategory, AlertItem } from '../../core/models/alert.model';
import { Severity } from '../../core/models/common.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../core/models/common.model';
import { AlertItemComponent } from '../../shared/ui/alert-item/alert-item';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';

const CATEGORY_FILTERS: (AlertCategory | 'All')[] = ['All', 'Price', 'Technical', 'Portfolio', 'Market', 'News', 'Events', 'Prediction'];
const SECTIONS: { severity: Severity; title: string }[] = [
  { severity: 'critical', title: 'Critical' },
  { severity: 'warning', title: 'Warnings' },
  { severity: 'info', title: 'Information' },
  { severity: 'success', title: 'Resolved' },
];

@Component({
  selector: 'app-alerts-page',
  standalone: true,
  imports: [AlertItemComponent, Skeleton, ErrorState, EmptyState],
  templateUrl: './alerts.html',
  styleUrl: './alerts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPage implements OnInit {
  private readonly alertService = inject(AlertService);

  protected readonly resource = signal<Resource<AlertItem[]>>(resourceLoading());
  protected readonly categoryFilter = signal<AlertCategory | 'All'>('All');
  protected readonly categoryFilters = CATEGORY_FILTERS;
  protected readonly sections = SECTIONS;

  protected readonly filtered = computed(() => {
    const list = this.resource().data ?? [];
    return this.categoryFilter() === 'All' ? list : list.filter((a) => a.category === this.categoryFilter());
  });

  bySeverity(severity: Severity): AlertItem[] {
    return this.filtered().filter((a) => a.severity === severity);
  }

  ngOnInit(): void {
    this.load();
    this.alertService.alerts$.subscribe((alerts) => this.resource.set(resourceSuccess(alerts)));
  }

  load(): void {
    this.resource.set(resourceLoading(this.resource().data));
    this.alertService.getAlerts().subscribe({
      next: (data) => this.resource.set(resourceSuccess(data)),
      error: () => this.resource.set(resourceError('Unable to load alerts.')),
    });
  }

  markRead(id: string): void {
    this.alertService.markRead(id).subscribe();
  }

  dismiss(id: string): void {
    this.alertService.dismiss(id).subscribe();
  }

  markAllRead(): void {
    this.alertService.markAllRead().subscribe();
  }
}
