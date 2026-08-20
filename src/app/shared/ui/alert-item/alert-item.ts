import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertItem } from '../../../core/models/alert.model';
import { Icon } from '../icon/icon';
import { RelativeTimePipe } from '../../pipes/relative-time.pipe';

const SEVERITY_ICON: Record<string, string> = { critical: 'alert-triangle', warning: 'alert-triangle', info: 'info', success: 'check-circle' };

/** Single alert row — used on the Alerts page and could be reused in a future notification feed. */
@Component({
  selector: 'app-alert-item',
  standalone: true,
  imports: [RouterLink, Icon, RelativeTimePipe],
  template: `
    <div class="alert-row" [class]="'sev-' + alert().severity" [class.read]="alert().read">
      <div class="alert-icon"><app-icon [name]="icon()" [size]="16" /></div>
      <div class="alert-body">
        <div class="alert-top">
          @if (alert().symbol) {
            <a [routerLink]="['/stocks', alert().symbol]" class="alert-subject">{{ alert().subject }}</a>
          } @else {
            <span class="alert-subject">{{ alert().subject }}</span>
          }
          <span class="badge badge-neutral">{{ alert().category }}</span>
          <span class="alert-time">{{ alert().timestamp | relativeTime }}</span>
        </div>
        <p class="alert-message">{{ alert().message }}</p>
      </div>
      <div class="alert-actions">
        @if (!alert().read) {
          <button type="button" class="icon-btn" title="Mark as read" (click)="markRead.emit(alert().id)"><app-icon name="check" [size]="13" /></button>
        }
        <button type="button" class="icon-btn" title="Dismiss" (click)="dismiss.emit(alert().id)"><app-icon name="x" [size]="13" /></button>
      </div>
    </div>
  `,
  styleUrl: './alert-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertItemComponent {
  readonly alert = input.required<AlertItem>();
  readonly markRead = output<string>();
  readonly dismiss = output<string>();

  protected icon(): string {
    return SEVERITY_ICON[this.alert().severity] ?? 'info';
  }
}
