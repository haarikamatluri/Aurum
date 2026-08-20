import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from '../../../shared/ui/modal/modal';
import { StockService } from '../../../core/services/stock.service';
import { TransactionAction, TransactionDraft } from '../../../core/models/portfolio.model';

const ACTIONS: TransactionAction[] = ['Buy', 'Sell', 'Dividend', 'Transfer'];

/** Reactive-forms transaction entry modal with inline validation. */
@Component({
  selector: 'app-transaction-modal',
  standalone: true,
  imports: [ReactiveFormsModule, Modal],
  template: `
    <app-modal [open]="open()" title="Add Transaction" (close)="close.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" class="tx-form">
        <div class="field">
          <label class="field-label" for="action">Action</label>
          <select id="action" class="select" formControlName="action">
            @for (a of actions; track a) { <option [value]="a">{{ a }}</option> }
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="symbol">Symbol</label>
          <select id="symbol" class="select" formControlName="symbol" [class.invalid]="invalid('symbol')">
            <option value="" disabled>Select a symbol</option>
            @for (s of symbols; track s) { <option [value]="s">{{ s }}</option> }
          </select>
          @if (invalid('symbol')) { <span class="field-error">Symbol is required.</span> }
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field-label" for="quantity">Quantity</label>
            <input id="quantity" type="number" class="input" formControlName="quantity" min="0.0001" step="any" [class.invalid]="invalid('quantity')" />
            @if (invalid('quantity')) { <span class="field-error">Quantity must be greater than 0.</span> }
          </div>
          <div class="field">
            <label class="field-label" for="price">Price</label>
            <input id="price" type="number" class="input" formControlName="price" min="0" step="any" [class.invalid]="invalid('price')" />
            @if (invalid('price')) { <span class="field-error">Price must be 0 or greater.</span> }
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field-label" for="fees">Fees</label>
            <input id="fees" type="number" class="input" formControlName="fees" min="0" step="any" />
          </div>
          <div class="field">
            <label class="field-label" for="date">Date</label>
            <input id="date" type="date" class="input" formControlName="date" [class.invalid]="invalid('date')" />
            @if (invalid('date')) { <span class="field-error">Date is required.</span> }
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="notes">Notes (optional)</label>
          <textarea id="notes" class="input" rows="2" formControlName="notes"></textarea>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-outline" (click)="close.emit()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Transaction</button>
        </div>
      </form>
    </app-modal>
  `,
  styles: [
    `
      .tx-form { display: flex; flex-direction: column; gap: var(--space-4); }
      .field-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-4); }
      .form-actions { display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-2); }
      @media (max-width: 420px) { .field-row { grid-template-columns: minmax(0, 1fr); } }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionModal {
  private readonly fb = inject(FormBuilder);
  private readonly stockService = inject(StockService);

  readonly open = input<boolean>(false);
  readonly close = output<void>();
  readonly save = output<TransactionDraft>();

  protected readonly actions = ACTIONS;
  protected readonly symbols = this.stockService.allSymbols();

  protected readonly form = this.fb.nonNullable.group({
    action: ['Buy' as TransactionAction, Validators.required],
    symbol: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.0001)]],
    price: [0, [Validators.required, Validators.min(0)]],
    fees: [0, [Validators.min(0)]],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    notes: [''],
  });

  invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.save.emit({
      action: raw.action,
      symbol: raw.symbol,
      quantity: Number(raw.quantity),
      price: Number(raw.price),
      fees: Number(raw.fees) || 0,
      date: new Date(raw.date).toISOString(),
      notes: raw.notes || undefined,
    });
    this.form.reset({ action: 'Buy', symbol: '', quantity: 1, price: 0, fees: 0, date: new Date().toISOString().slice(0, 10), notes: '' });
  }
}
