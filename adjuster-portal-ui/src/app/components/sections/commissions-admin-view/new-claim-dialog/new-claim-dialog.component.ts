import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  AgentProfileDTO,
  AgentProfileDataService,
} from 'src/app/services/agent-profile-data.service';
import {
  ClaimDTO,
  CommissionEngineDataService,
  CreateClaimPayload,
} from 'src/app/services/commission-engine-data.service';
import { US_STATES } from 'src/app/config/us-states';

interface HierarchyPreview {
  team_member: { name: string; agent_number: string; role: string } | null;
  rvp: { name: string; agent_number: string } | null;
  cp: { name: string; agent_number: string } | null;
}

/**
 * Admin "+ New Claim" dialog.
 *
 * User-facing terminology: "Team Member" (the DB column is still
 * writing_agent_id — the rename is label-only).
 *
 * Required: client name, team member, street address, city, state, ZIP.
 * Auto-assigned by the backend:
 *   1. claim_number (RIN-YYMM-XXXX)
 *   2. rvp_id / cp_id via User.manager_id walker (first RVP / first CP
 *      ancestor of the writing team member)
 * Commission splits do NOT fire at intake — they fire at settlement.
 */
@Component({
  selector: 'app-new-claim-dialog',
  templateUrl: './new-claim-dialog.component.html',
  styleUrls: ['./new-claim-dialog.component.scss'],
  standalone: false,
})
export class NewClaimDialogComponent implements OnInit {
  form = {
    client_name: '',
    // J2 — required at intake; no default; drives bidirectional
    // divergence detection in J3.
    claim_type: '' as '' | 'residential' | 'commercial',
    // Structured address (street / city / state / zip required).
    // No separate unit field — operators append to street_address.
    street_address: '',
    city: '',
    state: '',
    zip: '',
    writing_agent_id: '',
    carrier: '',
    loss_date: '' as string | null,
    loss_type: '' as string | '',
    estimate_amount: null as number | null,
    notes: '',
  };

  readonly lossTypes = ['FIRE', 'WATER', 'WIND', 'STORM', 'THEFT', 'OTHER'];
  readonly states = US_STATES;
  readonly ZIP_RE = /^\d{5}(-\d{4})?$/;
  readonly ESTIMATE_MAX = 10_000_000;   // $10M sanity cap for currency input

  /** Today's date in YYYY-MM-DD, used as the max-date guard on Loss Date. */
  readonly todayIso: string = new Date().toISOString().slice(0, 10);

  agents: AgentProfileDTO[] = [];
  loading = true;
  saving = false;
  errorText: string | null = null;

  constructor(
    private readonly agentData: AgentProfileDataService,
    private readonly engineData: CommissionEngineDataService,
    private readonly dialogRef: MatDialogRef<NewClaimDialogComponent, ClaimDTO | null>,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.agentData.list$().subscribe({
      next: list => {
        const eligible = new Set(['AGENT', 'RVP', 'CP']);
        this.agents = list
          .filter(a => eligible.has(a.user_role))
          .sort((a, b) => a.agent_number.localeCompare(b.agent_number));
        this.loading = false;
      },
      error: err => {
        this.errorText = err?.error?.detail || err?.message || String(err);
        this.loading = false;
      },
    });
  }

  hierarchyPreview(): HierarchyPreview {
    const wa = this.agents.find(a => a.user_id === this.form.writing_agent_id);
    if (!wa) return { team_member: null, rvp: null, cp: null };

    // Simulate the server walker: first RVP / first CP in the directory
    // filtered by the selected member's role context. Preview only —
    // the actual walk happens server-side against User.manager_id.
    const role = wa.user_role.toUpperCase();
    let rvp: AgentProfileDTO | undefined;
    let cp: AgentProfileDTO | undefined;

    if (role === 'AGENT') {
      rvp = this.agents.find(a => a.user_role === 'RVP');
      cp = this.agents.find(a => a.user_role === 'CP');
    } else if (role === 'RVP') {
      cp = this.agents.find(a => a.user_role === 'CP');
    }
    // CP writer = no overrides above.

    return {
      team_member: { name: wa.user_name, agent_number: wa.agent_number, role: wa.user_role },
      rvp: rvp ? { name: rvp.user_name, agent_number: rvp.agent_number } : null,
      cp: cp ? { name: cp.user_name, agent_number: cp.agent_number } : null,
    };
  }

  scenarioBadge(): string {
    const h = this.hierarchyPreview();
    if (!h.team_member) return '';
    const role = h.team_member.role.toUpperCase();
    if (role === 'CP') return 'S1 · CP writes solo';
    if (role === 'RVP') return 'S2 · RVP writes';
    if (h.rvp && h.cp) return 'S3 · Full chain (Team Member 70 / RVP 10 / CP 20)';
    if (!h.rvp && h.cp) return 'S4 · Direct CP (Team Member 70 / CP 30)';
    return 'Team member writes — no overrides resolved';
  }

  zipValid(): boolean {
    return !this.form.zip || this.ZIP_RE.test(this.form.zip.trim());
  }

  lossDateValid(): boolean {
    // Empty is allowed (field is optional). Non-empty must be <= today.
    if (!this.form.loss_date) return true;
    return this.form.loss_date <= this.todayIso;
  }

  canSubmit(): boolean {
    return !this.saving &&
      !!this.form.client_name.trim() &&
      !!this.form.claim_type &&
      !!this.form.writing_agent_id &&
      !!this.form.street_address.trim() &&
      !!this.form.city.trim() &&
      !!this.form.state &&
      !!this.form.zip.trim() &&
      this.zipValid() &&
      this.lossDateValid();
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.saving = true;
    this.errorText = null;

    const payload: CreateClaimPayload = {
      client_name: this.form.client_name.trim(),
      claim_type: this.form.claim_type as 'residential' | 'commercial',
      writing_agent_id: this.form.writing_agent_id,
      street_address: this.form.street_address.trim(),
      city: this.form.city.trim(),
      state: this.form.state,
      zip: this.form.zip.trim(),
      carrier: this.form.carrier.trim() || null,
      loss_date: this.form.loss_date || null,
      loss_type: (this.form.loss_type || null) as CreateClaimPayload['loss_type'],
      notes: this.form.notes.trim() || null,
      estimate_amount: this.form.estimate_amount != null ? this.form.estimate_amount : null,
    };

    this.engineData.createClaim$(payload).subscribe({
      next: claim => {
        this.saving = false;
        this.snack.open(
          `Claim ${claim.claim_number} created for ${claim.client_name}`,
          'Dismiss',
          { duration: 4000 },
        );
        this.dialogRef.close(claim);
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
