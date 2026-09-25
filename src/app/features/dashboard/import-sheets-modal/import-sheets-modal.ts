import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal, computed, input, HostBinding } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import * as XLSX from 'xlsx';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { AddHoldingRequest, MarketRegion, CurrencyCode } from '../../../core/models/portfolio.model';

export interface ParsedStockRow {
  id: string;
  symbol: string;
  companyName: string;
  market: MarketRegion;
  currency: CurrencyCode;
  exchange: string;
  shares: number;
  purchasePrice: number;
  totalInvested: number;
  purchaseDate?: string;
  isValid: boolean;
  errorMessage?: string;
  selected: boolean;
}

@Component({
  selector: 'app-import-sheets-modal',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="overlay" (click)="!isEmbedded() && close.emit()">
      <div class="modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-left">
            <div class="header-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <h2 id="modal-title">Import Stocks from Excel or CSV</h2>
              <p class="modal-subtitle">Upload your spreadsheet to batch-import holdings into your portfolio</p>
            </div>
          </div>
          <button type="button" class="close-btn" (click)="close.emit()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- Step 1: Upload Dropzone & Instructions -->
          @if (!hasFile()) {
            <div
              class="dropzone"
              [class.dragover]="isDragging()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
              (click)="fileInput.click()"
            >
              <input
                #fileInput
                type="file"
                accept=".xlsx, .xls, .csv"
                (change)="onFileSelected($event)"
                class="hidden-input"
              />
              <div class="drop-icon-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="32" height="32">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div class="drop-text">
                <strong>Click to browse</strong> or drag & drop your spreadsheet here
              </div>
              <div class="drop-sub">
                Supports <code>.xlsx</code>, <code>.xls</code>, or <code>.csv</code> sheets
              </div>

              <div class="format-badges">
                <span class="fmt-badge">📊 Excel (.xlsx)</span>
                <span class="fmt-badge">📄 CSV (.csv)</span>
                <span class="fmt-badge">📈 Historical Exports</span>
              </div>
            </div>

            <!-- Expected Format & Template Download Box -->
            <div class="template-box">
              <div class="template-left">
                <div class="template-title">Supported Columns & Format:</div>
                <div class="template-desc">
                  Required columns: <strong>Symbol</strong>, <strong>Shares</strong>, <strong>Bought Price</strong>.
                  Optional: <strong>Company Name</strong>, <strong>Market</strong> (US / IN), <strong>Date</strong>.
                </div>
              </div>
              <button type="button" class="btn-download-sample" (click)="downloadSampleTemplate($event)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>Download Sample Sheet</span>
              </button>
            </div>
          } @else {
            <!-- Step 2: Uploaded File Summary & Preview Table -->
            <div class="uploaded-summary-bar">
              <div class="file-meta">
                <div class="file-icon">📊</div>
                <div class="file-details">
                  <span class="file-name">{{ fileName() }}</span>
                  <span class="file-stats">
                    {{ parsedRows().length }} rows processed · {{ validCount() }} valid to import
                  </span>
                </div>
              </div>

              <button type="button" class="btn-change-file" (click)="resetFile()">
                Change File
              </button>
            </div>

            <!-- Summary Stats Pills -->
            <div class="stats-pills-row">
              <div class="stat-pill pill-valid">
                <span class="dot"></span>
                <span>{{ validCount() }} Ready to Import</span>
              </div>
              @if (errorCount() > 0) {
                <div class="stat-pill pill-error">
                  <span class="dot"></span>
                  <span>{{ errorCount() }} Invalid / Skipped</span>
                </div>
              }
              <div class="stat-pill pill-market">
                <span>Default Market:</span>
                <div class="mini-market-toggle">
                  <button
                    type="button"
                    [class.active]="defaultMarket() === 'IN'"
                    (click)="setDefaultMarket('IN')"
                  >
                    🇮🇳 India
                  </button>
                  <button
                    type="button"
                    [class.active]="defaultMarket() === 'US'"
                    (click)="setDefaultMarket('US')"
                  >
                    🇺🇸 US
                  </button>
                </div>
              </div>
            </div>

            <!-- Preview Table -->
            <div class="table-container">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th class="th-cb">
                      <input
                        type="checkbox"
                        [checked]="allSelected()"
                        (change)="toggleSelectAll($event)"
                        title="Select All Valid Stocks"
                      />
                    </th>
                    <th class="th-status">Status</th>
                    <th class="th-sym">Symbol</th>
                    <th class="th-name">Company</th>
                    <th class="th-mkt">Market</th>
                    <th class="th-num">Shares</th>
                    <th class="th-num">Bought Price</th>
                    <th class="th-num">Total Cost</th>
                    <th class="th-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of parsedRows(); track r.id) {
                    <tr class="preview-row" [class.invalid-row]="!r.isValid" [class.row-selected]="r.selected">
                      <td class="td-cb">
                        <input
                          type="checkbox"
                          [(ngModel)]="r.selected"
                          [disabled]="!r.isValid"
                          (change)="updateSelection()"
                        />
                      </td>
                      <td class="td-status">
                        @if (r.isValid) {
                          <span class="status-badge valid" title="Ready to import">✓ Valid</span>
                        } @else {
                          <span class="status-badge error" [title]="r.errorMessage || 'Invalid row'">
                            ⚠️ {{ r.errorMessage || 'Error' }}
                          </span>
                        }
                      </td>
                      <td class="td-sym">
                        <strong>{{ r.symbol }}</strong>
                      </td>
                      <td class="td-name">
                        <span class="company-ellipsis">{{ r.companyName }}</span>
                      </td>
                      <td class="td-mkt">
                        <span class="mkt-tag" [class.mkt-in]="r.market === 'IN'">
                          {{ r.market === 'IN' ? '🇮🇳 IN' : '🇺🇸 US' }}
                        </span>
                      </td>
                      <td class="td-num tabular-nums">
                        {{ r.shares }}
                      </td>
                      <td class="td-num tabular-nums">
                        {{ r.market === 'IN' ? '₹' : '$' }}{{ r.purchasePrice | number:'1.2-2' }}
                      </td>
                      <td class="td-num tabular-nums font-semibold">
                        {{ r.market === 'IN' ? '₹' : '$' }}{{ r.totalInvested | number:'1.2-2' }}
                      </td>
                      <td class="td-actions">
                        <button type="button" class="btn-remove-row" (click)="removeRow(r.id)" title="Remove this row">
                          ×
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <!-- Footer Actions -->
        <div class="modal-footer">
          <button type="button" class="btn-cancel" (click)="close.emit()">
            Cancel
          </button>

          @if (hasFile()) {
            <button
              type="button"
              class="btn-import-confirm"
              [disabled]="selectedValidCount() === 0 || isImporting()"
              (click)="confirmImport()"
            >
              @if (isImporting()) {
                <span>Importing...</span>
              } @else {
                <span>Confirm & Import {{ selectedValidCount() }} Stocks</span>
              }
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './import-sheets-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportSheetsModal {
  isEmbedded = input<boolean>(false);
  @HostBinding('class.embedded-mode') get embedded() { return this.isEmbedded(); }

  @Output() close = new EventEmitter<void>();
  @Output() imported = new EventEmitter<{ count: number }>();

  private readonly portfolio = inject(PortfolioService);

  protected readonly hasFile = signal(false);
  protected readonly fileName = signal('');
  protected readonly isDragging = signal(false);
  protected readonly isImporting = signal(false);
  protected readonly defaultMarket = signal<MarketRegion>('IN');

  protected readonly parsedRows = signal<ParsedStockRow[]>([]);

  protected readonly validCount = computed(() => {
    return this.parsedRows().filter((r) => r.isValid).length;
  });

  protected readonly errorCount = computed(() => {
    return this.parsedRows().filter((r) => !r.isValid).length;
  });

  protected readonly selectedValidCount = computed(() => {
    return this.parsedRows().filter((r) => r.isValid && r.selected).length;
  });

  protected readonly allSelected = computed(() => {
    const valid = this.parsedRows().filter((r) => r.isValid);
    return valid.length > 0 && valid.every((r) => r.selected);
  });

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  setDefaultMarket(m: MarketRegion): void {
    this.defaultMarket.set(m);
    // Re-evaluate rows where market was not explicitly specified in the file
    this.parsedRows.update((rows) =>
      rows.map((r) => {
        const currency: CurrencyCode = m === 'IN' ? 'INR' : 'USD';
        const exchange = m === 'IN' ? 'NSE' : 'NASDAQ';
        return {
          ...r,
          market: m,
          currency,
          exchange,
        };
      })
    );
  }

  resetFile(): void {
    this.hasFile.set(false);
    this.fileName.set('');
    this.parsedRows.set([]);
  }

  toggleSelectAll(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.parsedRows.update((rows) =>
      rows.map((r) => (r.isValid ? { ...r, selected: checked } : r))
    );
  }

  updateSelection(): void {
    this.parsedRows.update((rows) => [...rows]);
  }

  removeRow(id: string): void {
    this.parsedRows.update((rows) => rows.filter((r) => r.id !== id));
  }

  async processFile(file: File): Promise<void> {
    const validExts = ['.xlsx', '.xls', '.csv'];
    const name = file.name.toLowerCase();
    const isSupported = validExts.some((ext) => name.endsWith(ext));

    if (!isSupported) {
      alert('Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }

    this.fileName.set(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        alert('Spreadsheet is empty.');
        return;
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        alert('No data rows found in the sheet.');
        return;
      }

      const parsed = this.parseRawRows(rawRows);
      this.parsedRows.set(parsed);
      this.hasFile.set(true);
    } catch (err: any) {
      console.error('Error parsing sheet:', err);
      alert('Failed to read sheet: ' + (err.message || 'Check file format.'));
    }
  }

  private parseRawRows(rawRows: any[]): ParsedStockRow[] {
    const defMkt = this.defaultMarket();

    return rawRows.map((row, idx) => {
      // Find field names case-insensitively
      const keys = Object.keys(row);
      const getVal = (candidates: string[]): string => {
        for (const k of keys) {
          const cleanK = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const c of candidates) {
            if (cleanK === c || cleanK.includes(c)) {
              return String(row[k] || '').trim();
            }
          }
        }
        return '';
      };

      const rawSym = getVal(['symbol', 'ticker', 'stock', 'code', 'name']);
      const rawCompany = getVal(['companyname', 'company', 'name', 'desc']);
      const rawMarket = getVal(['market', 'country', 'region', 'exchange']).toUpperCase();
      const rawShares = getVal(['shares', 'qty', 'quantity', 'units', 'volume']);
      const rawPrice = getVal(['boughtprice', 'purchaseprice', 'avgprice', 'price', 'cost', 'buyprice', 'rate']);
      const rawDate = getVal(['date', 'purchasedate', 'boughtdate']);

      const cleanSym = rawSym.replace(/[^a-zA-Z0-9.\-_]/g, '').toUpperCase();
      const shares = parseFloat(rawShares.replace(/,/g, ''));
      const price = parseFloat(rawPrice.replace(/[$,₹, ]/g, ''));

      // Determine market
      let market: MarketRegion = defMkt;
      if (rawMarket.includes('IN') || rawMarket.includes('INDIA') || rawMarket.includes('NSE') || rawMarket.includes('BSE') || cleanSym.endsWith('.NS') || cleanSym.endsWith('.BO')) {
        market = 'IN';
      } else if (rawMarket.includes('US') || rawMarket.includes('USA') || rawMarket.includes('NASDAQ') || rawMarket.includes('NYSE')) {
        market = 'US';
      }

      const currency: CurrencyCode = market === 'IN' ? 'INR' : 'USD';
      const exchange = market === 'IN' ? 'NSE' : 'NASDAQ';

      // Validation
      let isValid = true;
      let errorMessage = '';

      if (!cleanSym) {
        isValid = false;
        errorMessage = 'Missing symbol';
      } else if (isNaN(shares) || shares <= 0) {
        isValid = false;
        errorMessage = 'Invalid shares';
      } else if (isNaN(price) || price <= 0) {
        isValid = false;
        errorMessage = 'Invalid price';
      }

      return {
        id: `parsed-${idx}-${Date.now()}`,
        symbol: cleanSym,
        companyName: rawCompany || cleanSym,
        market,
        currency,
        exchange,
        shares: isNaN(shares) ? 0 : shares,
        purchasePrice: isNaN(price) ? 0 : price,
        totalInvested: !isNaN(shares) && !isNaN(price) ? shares * price : 0,
        purchaseDate: rawDate || new Date().toISOString().split('T')[0],
        isValid,
        errorMessage,
        selected: isValid,
      };
    });
  }

  downloadSampleTemplate(e: Event): void {
    e.stopPropagation();

    const sampleData = [
      {
        'Symbol': 'NVDA',
        'Company Name': 'NVIDIA Corporation',
        'Market': 'US',
        'Shares': 10,
        'Bought Price': 128.50,
        'Date': '2026-08-15',
      },
      {
        'Symbol': 'AAPL',
        'Company Name': 'Apple Inc.',
        'Market': 'US',
        'Shares': 15,
        'Bought Price': 225.00,
        'Date': '2026-08-20',
      },
      {
        'Symbol': 'RELIANCE',
        'Company Name': 'Reliance Industries Ltd',
        'Market': 'IN',
        'Shares': 25,
        'Bought Price': 2980.00,
        'Date': '2026-08-10',
      },
      {
        'Symbol': 'TATAMOTORS',
        'Company Name': 'Tata Motors Ltd',
        'Market': 'IN',
        'Shares': 50,
        'Bought Price': 960.00,
        'Date': '2026-08-12',
      },
      {
        'Symbol': 'TSLA',
        'Company Name': 'Tesla, Inc.',
        'Market': 'US',
        'Shares': 8,
        'Bought Price': 215.40,
        'Date': '2026-08-25',
      },
      {
        'Symbol': 'TCS',
        'Company Name': 'Tata Consultancy Services',
        'Market': 'IN',
        'Shares': 12,
        'Bought Price': 4210.00,
        'Date': '2026-08-18',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Holdings');

    // Download CSV
    XLSX.writeFile(wb, 'aurum_holdings_sample.csv');
  }

  async confirmImport(): Promise<void> {
    const validRows = this.parsedRows().filter((r) => r.isValid && r.selected);
    if (validRows.length === 0) return;

    this.isImporting.set(true);

    try {
      const requests: AddHoldingRequest[] = validRows.map((r) => ({
        symbol: r.symbol,
        companyName: r.companyName,
        exchange: r.exchange,
        market: r.market,
        currency: r.currency,
        shares: r.shares,
        purchasePrice: r.purchasePrice,
        purchaseDate: r.purchaseDate,
      }));

      this.portfolio.addHoldingsBulk(requests);
      this.imported.emit({ count: requests.length });
      this.close.emit();
    } catch (err: any) {
      console.error('Import error:', err);
      alert('Error importing holdings: ' + err.message);
    } finally {
      this.isImporting.set(false);
    }
  }
}
