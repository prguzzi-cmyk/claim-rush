import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, switchMap } from 'rxjs';

import {
  AgentProfileDTO,
  AgentProfileDataService,
} from 'src/app/services/agent-profile-data.service';
import {
  CommissionEngineDataService,
  PayoutDTO,
} from 'src/app/services/commission-engine-data.service';
import { AgentSimpleEarningsView } from 'src/app/models/commission-engine.model';

export interface IssuePayoutDialogData {
  agentId?: string;
}

/**
 * Issue Payout dialog with atomic advance-offset.
 *
 * Displays two read-only balance tiles (remaining + outstanding advances)
 * before the amount input, so the operator can see exactly what's available
 * and what's owed before deciding.
 *
 * When the "Auto-offset advances" checkbox is on, the backend emits both
 * PAYOUT_ISSUED and REPAYMENT_OFFSET in a single transaction — the ledger
 * can't end up half-written on failure.
 */
@Component({
  selector: 'app-issue-payout-dialog',
  templateUrl: './issue-payout-dialog.component.html',
  styleUrls: ['./issue-payout-dialog.component.scss'],
  standalone: false,
})
export class IssuePayoutDialogComponent implements OnInit {
  agents: AgentProfileDTO[] = [];

  form = {
    agent_id: '' as string,
    amount: null as number | null,
    method: 'ACH' as string,
    reference: '',
    notes: '',
    offset_advances: true,
  };

  readonly methods = ['ACH', 'CHECK', 'WIRE', 'MANUAL'];

  earnings: AgentSimpleEarningsView | null = null;
  outstandingAdvance = 0;
  loading = true;
  loadingBalances = false;
  saving = false;
  errorText: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: IssuePayoutDialogData | null,
    private readonly agentData: AgentProfileDataService,
    private readonly engine: CommissionEngineDataService,
    private readonly dialogRef: MatDialogRef<IssuePayoutDialogComponent, PayoutDTO | null>,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.agentData.list$().subscribe({
      next: list => {
        const eligible = new Set(['AGENT', 'RVP', 'CP']);
        this.agents = list
          .filter(a => eligible.has(a.user_role))
          .sort((a, b) => a.agent_number.localeCompare(b.agent_number));
        if (this.data?.agentId) {
          this.form.agent_id = this.data.agentId;
          this.loadBalancesFor(this.data.agentId);
        }
        this.loading = false;
      },
      error: err => {
        this.errorText = err?.error?.detail || err?.message || String(err);
        this.loading = false;
      },
    });
  }

  showAgentPicker(): boolean { return !this.data?.agentId; }

  selectedAgent(): AgentProfileDTO | null {
    return this.agents.find(a => a.user_id === this.form.agent_id) ?? null;
  }

  onAgentChange(): void {
    this.earnings = null;
    this.outstandingAdvance = 0;
    if (this.form.agent_id) this.loadBalancesFor(this.form.agent_id);
  }

  private loadBalancesFor(userId: string): void {
    this.loadingBalances = true;
    forkJoin({
      earnings: this.engine.getAgentSimpleEarnings$(userId),
      advance: this.engine.getAdvanceBalance$(userId),
    }).subscribe({
      next: ({ earnings, advance }) => {
        this.earnings = earnings;
        this.outstandingAdvance = advance.outstanding;
        this.loadingBalances = false;
      },
      error: err => {
        this.errorText = err?.error?.detail || err?.message || String(err);
        this.loadingBalances = false;
      },
    });
  }

  remainingBalance(): number {
    return this.earnings?.remaining_balance ?? 0;
  }

  projectedOffset(): number {
    const amt = this.form.amount ?? 0;
    if (!this.form.offset_advances || amt <= 0) return 0;
    return Math.min(amt, this.outstandingAdvance);
  }

  netToAgent(): number {
    const amt = this.form.amount ?? 0;
    return Math.max(0, amt - this.projectedOffset());
  }

  amountTooHigh(): boolean {
    return this.form.amount != null && this.form.amount > this.remainingBalance();
  }

  canSubmit(): boolean {
    return !this.saving &&
      !!this.form.agent_id &&
      this.form.amount !== null &&
      this.form.amount > 0 &&
      !this.amountTooHigh();
  }

  submit(): void {
    if (!this.canSubmit() || this.form.amount == null) return;
    this.saving = true;
    this.errorText = null;

    this.engine.issuePayout$({
      user_id: this.form.agent_id,
      amount: this.form.amount,
      method: this.form.method,
      reference: this.form.reference.trim() || null,
      offset_advances: this.form.offset_advances,
    }).subscribe({
      next: p => {
        this.saving = false;
        const who = this.selectedAgent()?.user_name ?? 'agent';
        this.snack.open(
          `Payout of $${p.amount.toFixed(2)} issued to ${who}`,
          'Dismiss',
          { duration: 4000 },
        );
        this.dialogRef.close(p);
      },
      error: err => {
        this.saving = false;
        this.errorText = err?.error?.detail || err?.message || String(err);
      },
    });
  }

  cancel(): void { this.dialogRef.close(null); }
}
