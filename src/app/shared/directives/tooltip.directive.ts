import { Directive, ElementRef, HostListener, OnDestroy, inject, input } from '@angular/core';

/**
 * Accessible hover/focus tooltip for unfamiliar financial terms (RSI, Beta, drawdown, ...).
 * Usage: <span appTooltip="Relative Strength Index — momentum oscillator from 0-100.">RSI</span>
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true,
  host: { '[attr.tabindex]': '0', '[attr.aria-describedby]': 'null' },
})
export class TooltipDirective implements OnDestroy {
  readonly appTooltip = input<string>('', { alias: 'appTooltip' });
  private readonly el = inject(ElementRef<HTMLElement>);
  private tipEl: HTMLDivElement | null = null;

  @HostListener('mouseenter')
  @HostListener('focus')
  show(): void {
    const text = this.appTooltip();
    if (!text || this.tipEl) return;
    const tip = document.createElement('div');
    tip.className = 'app-tooltip';
    tip.textContent = text;
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    this.tipEl = tip;

    const rect = this.el.nativeElement.getBoundingClientRect();
    const top = rect.top - tip.offsetHeight - 8 + window.scrollY;
    const left = rect.left + rect.width / 2 - tip.offsetWidth / 2 + window.scrollX;
    tip.style.top = `${Math.max(top, 8)}px`;
    tip.style.left = `${Math.max(left, 8)}px`;
    requestAnimationFrame(() => tip.classList.add('visible'));
  }

  @HostListener('mouseleave')
  @HostListener('blur')
  hide(): void {
    this.tipEl?.remove();
    this.tipEl = null;
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
