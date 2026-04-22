import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  ClaimRowDTO,
  ClaimTwoSectionBreakdownDTO,
  CommissionEngineDataService,
} from 'src/app/services/commission-engine-data.service';

export interface RecordSettlementDialogData {
  claim: ClaimRowDTO;
}

/**
 * Settlement intake. Captures actual gross fee and settlement date, then
 * fires the backend's existing record_gross_fee path (writes COMMISSION_EARNED
 * rows for House, WA, RVP, CP via the 4-scenario dispatcher). On success,
 * shows the split breakdown inline so the operator sees the money flow.
 *
 * ADJUSTER_COMPENSATION is NOT auto-fired in this dialog — per the
 * architecture decision, adjuster comp is emitted manually via
 * POST /v1/commission/adjuster-comp until an adjuster-assignment UI exists.
 */
@Component({
  selector: 'app-record-settlement-dialog',
  templateUrl: './record-settlement-dialog.component.html',
  styleUrls: ['./record-settlement-dialog.component.scss'],
  standalone: false,
})
export class RecordSettlementDialogComponent implements OnInit {
  // Form state
  grossFee: number | null = null;
  settlementDate = new Date().toISOString().slice(0, 10);
  notes = '';

  saving = false;
  errorText: string | null = null;
  breakdown: ClaimTwoSectionBreakdownDTO | null = null;
  done = false;

  get claim(): ClaimRowDTO { return this.data.claim; }

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: RecordSettlementDialogData,
    private readonly engine: CommissionEngineDataService,
    private readonly dialogRef: MatDialogRef<RecordSettlementDialogComponent, ClaimTwoSectionBreakdownDTO | null>,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    // Pre-fill with expected gross if already set on the claim.
    if (this.claim.gross_fee && this.claim.gross_fee > 0) {
      this.grossFee = this.claim.gross_fee;
    }
  }

  canSubmit(): boolean {
    return !this.saving && !this.done && !!this.grossFee && this.grossFee > 0;
  }

  submit(): void {
    if (!this.canSubmit() || !this.grossFee) return;
    this.saving = true;
    this.errorText = null;

    const ts = this.settlementDate
      ? new Date(`${this.settlementDate}T12:00:00Z`).toISOString()
      : undefined;

    this.engine.recordGrossFee$(this.claim.id, this.grossFee, ts).subscribe({
      next: _updated => {
        this.engine.getClaimBreakdown$(this.claim.id).subscribe({
          next: b => {
            this.saving = false;
            this.done = true;
            this.breakdown = b;
            this.snack.open(
              `Settlement recorded — ${this.claim.claim_number}`,
              'Dismiss',
              { duration: 4000 },
            );
          },
          error: err => {
            this.saving = false;
            // Settlement succeeded but breakdown fetch failed — still
            // close-able, just no inline summary.
            this.errorText = `Settled, but breakdown fetch failed: ${err?.error?.detail || err?.message}`;
            this.done = true;
          },
        });
      },
      error: err => {
        this.saving = false;
        this.errorText = err?.error?.detail || err?.message || String(err);
      },
    });
  }

  close(): void {
    this.dialogRef.close(this.breakdown);
  }

  recipientLabel(bucket: string): string {
    if (bucket === 'WRITING_AGENT') return this.claim.writing_agent_name || 'Team Member';
    if (bucket === 'RVP_OVERRIDE') return this.claim.rvp_name || 'RVP Override';
    if (bucket === 'CP_OVERRIDE') return this.claim.cp_name || 'CP Override';
    return bucket;
  }
}
