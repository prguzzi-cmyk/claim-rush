import { Component, OnInit } from '@angular/core';
import { BehaviorSubject, Observable, map, shareReplay, switchMap } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import {
  AdminOverviewView,
  User,
} from 'src/app/models/commission-engine.model';
import { CommissionEngineService } from 'src/app/services/commission-engine.service';
import {
  ClaimRowDTO,
  CommissionEngineDataService,
} from 'src/app/services/commission-engine-data.service';
import { CommissionStatementDialogComponent } from '../agent-dashboard/earnings-tab/commission-statement-dialog/commission-statement-dialog.component';
import { CompPlanDialogComponent } from './comp-plan-dialog/comp-plan-dialog.component';
import { NewClaimDialogComponent } from './new-claim-dialog/new-claim-dialog.component';
import { RecordSettlementDialogComponent } from './record-settlement-dialog/record-settlement-dialog.component';
import { IssueAdvanceDialogComponent } from './issue-advance-dialog/issue-advance-dialog.component';
import { IssuePayoutDialogComponent } from './issue-payout-dialog/issue-payout-dialog.component';

/**
 * Admin / RIN House view.
 * Reuses EarningsTabComponent to drill into any team member.
 * Same engine, admin-level visibility (all users, house share roll-up).
 */
@Component({
  selector: 'app-commissions-admin-view',
  templateUrl: './commissions-admin-view.component.html',
  styleUrls: ['./commissions-admin-view.component.scss'],
  standalone: false,
})
export class CommissionsAdminViewComponent implements OnInit {
  overview$!: Observable<AdminOverviewView>;
  selectedUser$!: Observable<User | undefined>;
  claims$!: Observable<ClaimRowDTO[]>;
  private claimsRefresh$ = new BehaviorSubject<void>(undefined);

  selectedUserId: string | null = null;

  readonly TERMINAL_STAGE = 'PAID';

  constructor(
    private readonly engine: CommissionEngineService,
    private readonly engineData: CommissionEngineDataService,
    private readonly dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.overview$ = this.engine.getAdminOverview().pipe(shareReplay(1));
    this.claims$ = this.claimsRefresh$.pipe(
      switchMap(() => this.engineData.listClaims$()),
    );
    this.refreshSelected();
  }

  stageToneClass(stage: string): string {
    if (stage === 'PAID') return 'stg-paid';
    if (stage === 'SETTLEMENT_REACHED') return 'stg-settled';
    if (stage === 'LITIGATION' || stage === 'APPRAISAL') return 'stg-escalated';
    if (stage === 'NEGOTIATION' || stage === 'CARRIER_REVIEW') return 'stg-active';
    return 'stg-open';
  }

  canRecordSettlement(claim: ClaimRowDTO): boolean {
    return claim.stage !== this.TERMINAL_STAGE;
  }

  /** Count of claims whose carrier estimate diverges materially from the firm
   *  estimate per the policy in src/app/config/estimate-divergence.ts. Used by
   *  the aggregate banner above the claims table. */
  flaggedDivergenceCount(claims: ClaimRowDTO[]): number {
    return claims.filter(c => c.estimate_divergence_flagged).length;
  }

  /** Human-readable summary for the banner: "$10,000 lower (20% gap)". */
  divergenceSummary(claim: ClaimRowDTO): string {
    const dollars = claim.estimate_divergence_dollars ?? 0;
    const pct = claim.estimate_divergence_percentage ?? 0;
    return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })} lower `
         + `(${pct.toFixed(0)}% gap)`;
  }

  openRecordSettlement(claim: ClaimRowDTO, event: Event): void {
    event.stopPropagation();
    const ref = this.dialog.open(RecordSettlementDialogComponent, {
      width: '680px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'record-settlement-dialog-panel',
      data: { claim },
      autoFocus: false,
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.claimsRefresh$.next();
        this.overview$ = this.engine.getAdminOverview().pipe(shareReplay(1));
        this.refreshSelected();
      }
    });
  }

  private refreshSelected(): void {
    this.selectedUser$ = this.overview$.pipe(
      map(o => {
        const row = o.rows.find(r => r.user_id === this.selectedUserId);
        if (!row) return undefined;
        return {
          id: row.user_id,
          name: row.user_name,
          org_role: row.org_role,
          avatar_initials: row.user_name
            .split(' ')
            .map(s => s[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase(),
        } as User;
      }),
    );
  }

  selectUser(userId: string): void {
    this.selectedUserId = userId;
    this.refreshSelected();
  }

  clearSelection(): void {
    this.selectedUserId = null;
    this.refreshSelected();
  }

  openStatementFor(userId: string, userName: string, event: MouseEvent): void {
    event.stopPropagation();
    this.dialog.open(CommissionStatementDialogComponent, {
      width: '1080px',
      maxWidth: '98vw',
      maxHeight: '94vh',
      panelClass: 'statement-dialog-panel',
      data: { userId, userDisplayName: userName },
      autoFocus: false,
    });
  }

  openCompPlan(): void {
    this.dialog.open(CompPlanDialogComponent, {
      width: '880px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'comp-plan-dialog-panel',
      autoFocus: false,
    });
  }

  openIssueAdvanceFor(userId: string, event: Event): void {
    event.stopPropagation();
    const ref = this.dialog.open(IssueAdvanceDialogComponent, {
      width: '680px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'issue-advance-dialog-panel',
      data: { agentId: userId },
      autoFocus: false,
    });
    ref.afterClosed().subscribe(adv => {
      if (adv) {
        this.overview$ = this.engine.getAdminOverview().pipe(shareReplay(1));
        this.refreshSelected();
      }
    });
  }

  openIssuePayoutFor(userId: string, event: Event): void {
    event.stopPropagation();
    const ref = this.dialog.open(IssuePayoutDialogComponent, {
      width: '720px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'issue-payout-dialog-panel',
      data: { agentId: userId },
      autoFocus: false,
    });
    ref.afterClosed().subscribe(p => {
      if (p) {
        this.overview$ = this.engine.getAdminOverview().pipe(shareReplay(1));
        this.refreshSelected();
      }
    });
  }

  openNewClaim(): void {
    const ref = this.dialog.open(NewClaimDialogComponent, {
      width: '720px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'new-claim-dialog-panel',
      autoFocus: false,
    });
    ref.afterClosed().subscribe(created => {
      if (created) {
        this.claimsRefresh$.next();
        this.overview$ = this.engine.getAdminOverview().pipe(shareReplay(1));
        this.refreshSelected();
      }
    });
  }
}
