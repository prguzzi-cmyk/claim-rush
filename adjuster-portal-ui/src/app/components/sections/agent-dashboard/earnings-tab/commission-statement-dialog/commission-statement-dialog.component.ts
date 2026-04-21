import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  LedgerTransactionType,
  StatementBranding,
  StatementPeriod,
  StatementPeriodType,
  StatementView,
} from 'src/app/models/commission-engine.model';
import { CommissionEngineService } from 'src/app/services/commission-engine.service';
import { DEFAULT_STATEMENT_BRANDING } from 'src/app/config/statement-branding';

export interface CommissionStatementDialogData {
  userId: string;
  userDisplayName?: string;
  /** Optional branding override for multi-brand deployments. Defaults to ACI. */
  branding?: StatementBranding;
}

@Component({
  selector: 'app-commission-statement-dialog',
  templateUrl: './commission-statement-dialog.component.html',
  styleUrls: ['./commission-statement-dialog.component.scss'],
  standalone: false,
})
export class CommissionStatementDialogComponent implements OnInit {
  readonly branding: StatementBranding;
  readonly TX = LedgerTransactionType;

  selectedPeriod: StatementPeriodType = 'month';
  customStart: string = '';
  customEnd: string = '';

  period!: StatementPeriod;
  statement$!: Observable<StatementView>;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CommissionStatementDialogData,
    private readonly engine: CommissionEngineService,
    private readonly dialogRef: MatDialogRef<CommissionStatementDialogComponent>,
  ) {
    this.branding = data.branding ?? DEFAULT_STATEMENT_BRANDING;
  }

  ngOnInit(): void {
    // Default anchor: today. Default period: month-to-date.
    const today = new Date().toISOString();
    this.customStart = this.toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.customEnd = this.toDateInput(new Date());
    this.setPeriod('month', today);
  }

  setPeriod(type: StatementPeriodType, anchorIso?: string): void {
    this.selectedPeriod = type;
    const anchor = anchorIso ?? new Date().toISOString();

    if (type === 'custom') {
      if (!this.customStart || !this.customEnd) return;
      this.period = this.engine.buildPeriod(
        'custom',
        anchor,
        new Date(this.customStart).toISOString(),
        new Date(this.customEnd + 'T23:59:59').toISOString(),
      );
    } else {
      this.period = this.engine.buildPeriod(type, anchor);
    }
    this.statement$ = this.engine.getStatement(this.data.userId, this.period);
  }

  applyCustomRange(): void {
    this.setPeriod('custom');
  }

  close(): void { this.dialogRef.close(); }

  /** Use browser's print dialog — the @media print CSS renders a clean, vector-sharp PDF. */
  printStatement(): void {
    window.print();
  }

  /** Download a structured PDF via jsPDF + autotable. */
  downloadPdf(statement: StatementView): void {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const brand = this.branding;
    const pageWidth = doc.internal.pageSize.getWidth();
    const accent = brand.accent_hex || '#00C2FF';
    const rgb = this.hexToRgb(accent);

    // Header band
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(0, 0, pageWidth, 6, 'F');

    // Title block
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(brand.company_name, 40, 50);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    brand.address_lines.slice(1).forEach((line, i) => {
      doc.text(line, 40, 68 + i * 14);
    });

    // Right-aligned document meta
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(22);
    doc.text('Commission Statement', pageWidth - 40, 50, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(`Period: ${statement.period.label}`, pageWidth - 40, 68, { align: 'right' });
    doc.text(`Generated: ${new Date(statement.generated_at).toLocaleString()}`, pageWidth - 40, 82, { align: 'right' });

    // Agent block
    let cursor = 120;
    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    doc.setLineWidth(1.5);
    doc.line(40, cursor - 10, pageWidth - 40, cursor - 10);

    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('Prepared for', 40, cursor + 6);
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(statement.user_name, 40, cursor + 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(statement.user_role, 40, cursor + 40);
    cursor += 70;

    // Summary table
    autoTable(doc, {
      startY: cursor,
      head: [['Summary', 'Amount']],
      body: [
        ['Opening Balance', this.money(statement.opening_balance)],
        ['Earned Through Period End', this.money(statement.total_earned)],
        ['Paid Through Period End', this.money(statement.total_paid)],
        ['Advances Through Period End', this.money(statement.advances_issued)],
        ['Closing Balance', this.money(statement.closing_balance)],
        ['1099 YTD (Taxable Disbursements)', this.money(statement.taxable_1099_ytd)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      styles: { fontSize: 10, cellPadding: 6 },
    });

    cursor = (doc as any).lastAutoTable.finalY + 24;

    // Claim detail table
    if (statement.claim_details.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text('Claim Detail', 40, cursor);
      autoTable(doc, {
        startY: cursor + 8,
        head: [['Claim #', 'Client', 'Stage', 'Earned', 'Paid', 'Advances']],
        body: statement.claim_details.map(c => [
          c.claim_ref, c.client_name, c.stage_label,
          this.money(c.earned_in_period), this.money(c.paid_in_period), this.money(c.advances_in_period),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255] },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
        styles: { fontSize: 9, cellPadding: 5 },
      });
      cursor = (doc as any).lastAutoTable.finalY + 24;
    }

    // Transaction ledger
    if (statement.transactions.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text('Transaction History', 40, cursor);
      autoTable(doc, {
        startY: cursor + 8,
        head: [['Date', 'Type', 'Claim', 'Amount', 'Memo']],
        body: statement.transactions.map(t => [
          new Date(t.date).toLocaleDateString(),
          t.type_label,
          t.claim_ref ?? '',
          this.money(t.amount),
          t.memo ?? '',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255] },
        columnStyles: { 3: { halign: 'right' } },
        styles: { fontSize: 9, cellPadding: 4 },
      });
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(brand.footer_tagline, 40, h - 24);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 40, h - 24, { align: 'right' });
    }

    const filename = `${brand.company_short}-Commission-Statement-${this.safe(statement.user_name)}-${this.safe(statement.period.label)}.pdf`;
    doc.save(filename);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }

  private money(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
  }

  private safe(s: string): string {
    return s.replace(/[^A-Za-z0-9\-]+/g, '_');
  }

  private toDateInput(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** For template: tone class per transaction type (keeps typing tight). */
  rowClass(t: LedgerTransactionType): string {
    switch (t) {
      case LedgerTransactionType.COMMISSION_EARNED: return 'row-earned';
      case LedgerTransactionType.PAYOUT_ISSUED: return 'row-paid';
      case LedgerTransactionType.ADVANCE_ISSUED: return 'row-advance';
      case LedgerTransactionType.INTEREST_APPLIED: return 'row-interest';
      case LedgerTransactionType.REPAYMENT_OFFSET: return 'row-offset';
      case LedgerTransactionType.ADJUSTMENT: return 'row-adjust';
    }
  }
}
