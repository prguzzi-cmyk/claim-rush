import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import {
  CommissionBucket,
  FinancialDetailView,
  LedgerTransactionType,
} from 'src/app/models/commission-engine.model';
import { CommissionEngineService } from 'src/app/services/commission-engine.service';

export interface FinancialDetailDialogData {
  userId: string;
  userDisplayName?: string;
}

/**
 * Full financial detail — the ONLY place where interest/carrying cost is foregrounded
 * and where the complete 5-bucket breakdown per claim is shown.
 */
@Component({
  selector: 'app-financial-detail-dialog',
  templateUrl: './financial-detail-dialog.component.html',
  styleUrls: ['./financial-detail-dialog.component.scss'],
  standalone: false,
})
export class FinancialDetailDialogComponent implements OnInit {
  detail$!: Observable<FinancialDetailView>;

  readonly TX = LedgerTransactionType;
  readonly BUCKET = CommissionBucket;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: FinancialDetailDialogData,
    private readonly engine: CommissionEngineService,
    private readonly dialogRef: MatDialogRef<FinancialDetailDialogComponent>,
  ) {}

  ngOnInit(): void {
    this.detail$ = this.engine.getFinancialDetail(this.data.userId);
  }

  close(): void { this.dialogRef.close(); }

  typeLabel(t: LedgerTransactionType): string {
    switch (t) {
      case LedgerTransactionType.COMMISSION_EARNED: return 'Commission earned';
      case LedgerTransactionType.PAYOUT_ISSUED: return 'Payout issued';
      case LedgerTransactionType.ADVANCE_ISSUED: return 'Advance support';
      case LedgerTransactionType.INTEREST_APPLIED: return 'Interest / carrying cost';
      case LedgerTransactionType.REPAYMENT_OFFSET: return 'Repayment offset';
      case LedgerTransactionType.ADJUSTMENT: return 'Adjustment';
    }
  }

  typeClass(t: LedgerTransactionType): string {
    switch (t) {
      case LedgerTransactionType.ADVANCE_ISSUED: return 'tx--advance';
      case LedgerTransactionType.INTEREST_APPLIED: return 'tx--interest';
      case LedgerTransactionType.REPAYMENT_OFFSET: return 'tx--offset';
      case LedgerTransactionType.ADJUSTMENT: return 'tx--adjust';
      case LedgerTransactionType.COMMISSION_EARNED: return 'tx--earned';
      case LedgerTransactionType.PAYOUT_ISSUED: return 'tx--payout';
    }
  }
}
