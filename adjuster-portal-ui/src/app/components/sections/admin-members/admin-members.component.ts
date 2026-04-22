import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Observable, switchMap } from 'rxjs';

import {
  AdminMembersDataService,
  InviteRole,
  MemberRowDTO,
} from 'src/app/services/admin-members-data.service';

/**
 * Admin > Members — the regularization onboarding board.
 *
 * Lists every existing user grouped by onboarding status. Operators can:
 *   - Invite a new member (creates user + UPASign charter + invite email)
 *   - Re-fire the invite email for someone still pending_charter
 *   - Manually mark a W-9 as received (advances pending_w9 → active)
 *
 * Charter signing happens through the UPASign signing UI (separate route);
 * the resulting status flip is computed server-side via the agreement_service
 * hook and reflected here on the next refresh.
 */
@Component({
  selector: 'app-admin-members',
  templateUrl: './admin-members.component.html',
  styleUrls: ['./admin-members.component.scss'],
  standalone: false,
})
export class AdminMembersComponent implements OnInit {
  members$!: Observable<MemberRowDTO[]>;
  private refresh$ = new BehaviorSubject<void>(undefined);

  showInvite = false;
  inviteForm: { email: string; full_name: string; role: InviteRole } = {
    email: '',
    full_name: '',
    role: 'agent',
  };
  saving = false;
  errorText: string | null = null;

  constructor(
    private readonly data: AdminMembersDataService,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.members$ = this.refresh$.pipe(
      switchMap(() => this.data.list$()),
    );
  }

  openInvite(): void {
    this.inviteForm = { email: '', full_name: '', role: 'agent' };
    this.errorText = null;
    this.showInvite = true;
  }

  cancelInvite(): void { this.showInvite = false; }

  canSubmitInvite(): boolean {
    return !this.saving
      && !!this.inviteForm.email.trim()
      && !!this.inviteForm.full_name.trim();
  }

  submitInvite(): void {
    if (!this.canSubmitInvite()) return;
    this.saving = true;
    this.errorText = null;
    this.data.invite$({
      email: this.inviteForm.email.trim(),
      full_name: this.inviteForm.full_name.trim(),
      role: this.inviteForm.role,
    }).subscribe({
      next: result => {
        this.saving = false;
        this.showInvite = false;
        this.snack.open(
          `Invited ${this.inviteForm.full_name} — signing URL: ${result.signing_url}`,
          'Dismiss',
          { duration: 8000 },
        );
        this.refresh$.next();
      },
      error: err => {
        this.saving = false;
        this.errorText = err?.error?.detail || err?.message || String(err);
      },
    });
  }

  resendInvite(member: MemberRowDTO): void {
    this.data.resendInvite$(member.user_id).subscribe({
      next: result => {
        this.snack.open(
          `Invite resent — signing URL: ${result.signing_url}`,
          'Dismiss',
          { duration: 8000 },
        );
      },
      error: err => {
        this.snack.open(
          `Resend failed: ${err?.error?.detail || err?.message}`,
          'OK',
          { duration: 5000 },
        );
      },
    });
  }

  markW9Received(member: MemberRowDTO): void {
    if (!confirm(`Mark W-9 as received for ${member.full_name}? They'll be moved to ACTIVE.`)) return;
    this.data.markW9Received$(member.user_id).subscribe({
      next: () => {
        this.snack.open(`${member.full_name} marked active.`, 'Dismiss', { duration: 4000 });
        this.refresh$.next();
      },
      error: err => {
        this.snack.open(
          `Failed: ${err?.error?.detail || err?.message}`,
          'OK',
          { duration: 5000 },
        );
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  statusToneClass(status: string): string {
    if (status === 'pending_charter') return 'st-pending-charter';
    if (status === 'pending_w9') return 'st-pending-w9';
    if (status === 'active') return 'st-active';
    return 'st-other';
  }

  statusLabel(status: string): string {
    if (status === 'pending_charter') return 'Pending Charter';
    if (status === 'pending_w9') return 'Pending W-9';
    if (status === 'active') return 'Active';
    return status;
  }

  countBy(members: MemberRowDTO[], status: string): number {
    return members.filter(m => m.status === status).length;
  }
}
