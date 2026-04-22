import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  AgentProfileDTO,
  AgentProfileDataService,
} from 'src/app/services/agent-profile-data.service';
import {
  AdvanceDTO,
  AdvanceStatsDTO,
  ClaimRowDTO,
  CommissionEngineDataService,
} from 'src/app/services/commission-engine-data.service';
import {
  ADVANCE_SCHEDULE,
  computeTierAmount,
} from 'src/app/config/advance-schedule';

export interface IssueAdvanceDialogData {
  /** When present, the dialog pre-fills to this agent and hides the picker. */
  agentId?: string;
}

/**
 * Issue Advance dialog — tier-driven, cap-enforced.
 *
 * Flow:
 *  1. Operator selects (or arrives with) a team member.
 *  2. Operator picks a claim. The claim's estimate_amount drives the
 *     schedule tier lookup ($10k-50k → $250, etc.).
 *  3. Two live tiles show week + lifetime cap utilization for this
 *     member. Red when at/over cap.
 *  4. Amount field is locked to the tier amount unless admin-override
 *     is toggled. Claims under $10k have no tier — override is required
 *     and the field is free-text.
 *  5. Pre-submit validation blocks when:
 *      · one-advance-per-claim rule violated
 *      · week_total + amount > $5,000
 *      · lifetime_total + amount > $25,000
 *     Backend re-enforces the same rules — dialog is the first gate only.
 */
@Component({
  selector: 'app-issue-advance-dialog',
  templateUrl: './issue-advance-dialog.component.html',
  styleUrls: ['./issue-advance-dialog.component.scss'],
  standalone: false,
})
export class IssueAdvanceDialogComponent implements OnInit {
  readonly schedule = ADVANCE_SCHEDULE;

  agents: AgentProfileDTO[] = [];
  allClaims: ClaimRowDTO[] = [];

  form = {
    agent_id: '' as string,
    amount: null as number | null,
    claim_id: null as string | null,
    notes: '',
    acknowledge: false,
    admin_override: false,
  };

  stats: AdvanceStatsDTO | null = null;
  loading = true;
  statsLoading = false;
  saving = false;
  errorText: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: IssueAdvanceDialogData | null,
    private readonly agentData: AgentProfileDataService,
    private readonly engine: CommissionEngineDataService,
    private readonly dialogRef: MatDialogRef<IssueAdvanceDialogComponent, AdvanceDTO | null>,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    forkJoin({
      agents: this.agentData.list$(),
      claims: this.engine.listClaims$(),
    }).subscribe({
      next: ({ agents, claims }) => {
        const eligible = new Set(['AGENT', 'RVP', 'CP', 'ADJUSTER']);
        this.agents = agents
          .filter(a => eligible.has(a.user_role))
          .sort((a, b) => a.agent_number.localeCompare(b.agent_number));
        this.allClaims = claims;
        if (this.data?.agentId) {
          this.form.agent_id = this.data.agentId;
          this.refreshStats();
        }
        this.loading = false;
      },
      error: err => {
        this.errorText = err?.error?.detail || err?.message || String(err);
        this.loading = false;
      },
    });
  }

  // ─── Selectors ────────────────────────────────────────────────────────

  showAgentPicker(): boolean { return !this.data?.agentId; }

  selectedAgent(): AgentProfileDTO | null {
    return this.agents.find(a => a.user_id === this.form.agent_id) ?? null;
  }

  claimsForSelectedAgent(): ClaimRowDTO[] {
    if (!this.form.agent_id) return [];
    return this.allClaims
      .filter(c => c.writing_agent_id === this.form.agent_id && c.stage !== 'PAID');
  }

  selectedClaim(): ClaimRowDTO | null {
    if (!this.form.claim_id) return null;
    return this.allClaims.find(c => c.id === this.form.claim_id) ?? null;
  }

  estimate(): number | null {
    return this.selectedClaim()?.estimate_amount ?? null;
  }

  tierAmount(): number | null {
    return computeTierAmount(this.estimate());
  }

  isUnderMinimum(): boolean {
    const est = this.estimate();
    if (est == null) return false;
    return est > 0 && est < this.schedule.tiers[0].min;
  }

  // ─── Events ───────────────────────────────────────────────────────────

  onAgentChange(): void {
    this.form.claim_id = null;
    this.form.amount = null;
    this.stats = null;
    this.refreshStats();
  }

  onClaimChange(): void {
    this.form.admin_override = false;
    this.form.amount = this.tierAmount();
    this.refreshStats();
  }

  toggleOverride(): void {
    this.form.admin_override = !this.form.admin_override;
    if (!this.form.admin_override) {
      this.form.amount = this.tierAmount();
    }
  }

  private refreshStats(): void {
    if (!this.form.agent_id) { this.stats = null; return; }
    this.statsLoading = true;
    this.engine
      .getAdvanceStats$(this.form.agent_id, this.form.claim_id || undefined)
      .pipe(catchError(() => of(null)))
      .subscribe(s => {
        this.stats = s as AdvanceStatsDTO | null;
        this.statsLoading = false;
      });
  }

  // ─── Validation ───────────────────────────────────────────────────────

  weekUsed(): number { return this.stats?.week_total ?? 0; }
  weekCap(): number { return this.stats?.weekly_cap ?? this.schedule.weeklyCapPerMember; }
  lifetimeUsed(): number { return this.stats?.lifetime_total ?? 0; }
  lifetimeCap(): number { return this.stats?.lifetime_cap ?? this.schedule.lifetimeCapPerMember; }

  weekAtCap(): boolean { return this.weekUsed() >= this.weekCap(); }
  lifetimeAtCap(): boolean { return this.lifetimeUsed() >= this.lifetimeCap(); }

  validationError(): string | null {
    if (!this.form.agent_id) return null;
    const amt = this.form.amount ?? 0;
    if (amt <= 0) return null;

    if (this.stats?.this_claim_has_advance) {
      return 'This claim already has an advance — only one advance per claim.';
    }
    if (this.weekUsed() + amt > this.weekCap()) {
      return `Weekly cap exceeded — $${this.weekUsed()} already issued this week, `
        + `requested would bring total to $${this.weekUsed() + amt} (cap $${this.weekCap()}).`;
    }
    if (this.lifetimeUsed() + amt > this.lifetimeCap()) {
      return `Lifetime cap exceeded — $${this.lifetimeUsed()} lifetime, `
        + `requested would bring total to $${this.lifetimeUsed() + amt} (cap $${this.lifetimeCap()}).`;
    }
    if (this.isUnderMinimum() && !this.form.admin_override) {
      return `Estimate is below the lowest tier ($${this.schedule.tiers[0].min}). `
        + `Toggle admin override to issue a discretionary amount.`;
    }
    return null;
  }

  canSubmit(): boolean {
    if (this.saving) return false;
    if (!this.form.agent_id) return false;
    if (this.form.amount == null || this.form.amount <= 0) return false;
    if (!this.form.notes.trim()) return false;
    if (!this.form.acknowledge) return false;
    if (this.validationError() !== null) return false;
    return true;
  }

  // ─── Submit ───────────────────────────────────────────────────────────

  submit(): void {
    if (!this.canSubmit() || this.form.amount == null) return;
    this.saving = true;
    this.errorText = null;

    this.engine.issueAdvance$({
      user_id: this.form.agent_id,
      amount: this.form.amount,
      notes: this.form.notes.trim(),
      claim_id: this.form.claim_id || null,
      admin_override: this.form.admin_override,
    }).subscribe({
      next: adv => {
        this.saving = false;
        const agent = this.selectedAgent();
        const whoLabel = agent ? agent.user_name : 'team member';
        this.snack.open(
          `Advance of $${adv.amount.toFixed(2)} issued to ${whoLabel}`,
          'Dismiss',
          { duration: 4000 },
        );
        this.dialogRef.close(adv);
      },
      error: err => {
        this.saving = false;
        this.errorText = err?.error?.detail || err?.message || String(err);
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
