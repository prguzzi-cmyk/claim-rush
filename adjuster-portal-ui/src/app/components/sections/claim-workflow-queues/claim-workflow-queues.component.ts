import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ClaimService } from 'src/app/services/claim.service';
import { EstimatingService } from 'src/app/services/estimating.service';
import { UserService } from 'src/app/services/user.service';
import { CommandCenterEngineService } from 'src/app/shared/services/command-center-engine.service';
import {
  CommandCenterClaimView,
  CommandCenterMetrics,
  ActionQueue,
  ClaimActionStatus,
  ACTION_STATUS_META,
  CommandCenterRole,
  CommandCenterFilter,
} from 'src/app/shared/models/command-center.model';

@Component({
  selector: 'app-claim-workflow-queues',
  templateUrl: './claim-workflow-queues.component.html',
  styleUrls: ['./claim-workflow-queues.component.scss'],
  standalone: false,
})
export class ClaimWorkflowQueuesComponent implements OnInit {

  loading = true;
  metrics: CommandCenterMetrics | null = null;
  queues: ActionQueue[] = [];
  allClaims: CommandCenterClaimView[] = [];

  currentRole: CommandCenterRole = 'owner';
  currentUserId: string | null = null;

  /** Max claims shown per queue card before "View All". */
  readonly QUEUE_PREVIEW_LIMIT = 5;

  constructor(
    private claimService: ClaimService,
    private estimatingService: EstimatingService,
    private userService: UserService,
    private engine: CommandCenterEngineService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.userService.currentUser.subscribe((user: any) => {
      if (user) {
        this.currentUserId = user.id;
        const role = (user.role || '').toLowerCase();
        if (role.includes('admin') || role.includes('super') || role.includes('owner')) {
          this.currentRole = 'owner';
        } else if (role.includes('rvp') || role.includes('regional') || role.includes('manager')) {
          this.currentRole = 'rvp';
        } else {
          this.currentRole = 'agent';
        }
      }
    });
    this.loadData();
  }

  loadData(): void {
    this.loading = true;

    // Use the recovery dashboard endpoint as the data source — it already
    // aggregates claims with financial data across all estimate projects.
    this.estimatingService.getClaimRecoveryDashboard().subscribe({
      next: (data: any) => {
        const rawClaims = data?.claims || [];

        // Build CommandCenterClaimView for each claim using available data
        const views: CommandCenterClaimView[] = rawClaims.map((raw: any) =>
          this.buildViewFromRecoveryData(raw)
        );

        // Apply role filter
        const filter = this.buildFilter();
        const filtered = this.engine.applyFilter(views, filter);

        this.allClaims = filtered;
        this.queues = this.engine.getActiveQueues(this.engine.buildActionQueues(filtered));
        this.metrics = this.engine.computeMetrics(filtered);
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  private buildFilter(): CommandCenterFilter {
    return {
      role: this.currentRole,
      adjusterId: this.currentRole === 'agent' ? this.currentUserId : null,
      teamIds: [],
      actionStatus: null,
      phase: null,
    };
  }

  /**
   * Build a CommandCenterClaimView from the recovery dashboard data.
   * This avoids N+1 API calls — uses the aggregated data already loaded.
   */
  private buildViewFromRecoveryData(raw: any): CommandCenterClaimView {
    const aciTotal = raw.aci_total || 0;
    const carrierTotal = raw.carrier_total || 0;
    const recovered = raw.recovered_amount || 0;
    const recoverable = raw.recoverable_amount || 0;
    const recoveryPct = aciTotal > 0 ? (recovered / aciTotal) * 100 : 0;
    const supplementTotal = Math.max(aciTotal - carrierTotal, 0);

    // Infer action status from available data
    const status = (raw.recovery_status || '').toLowerCase();
    let actionStatus: ClaimActionStatus = 'needs_estimate';

    if (status === 'paid_closed' || status === 'closed') {
      actionStatus = 'claim_closed';
    } else if (recovered > 0 && recoveryPct >= 95) {
      actionStatus = 'payment_received';
    } else if (recovered > 0 && recovered < aciTotal) {
      actionStatus = 'awaiting_payment';
    } else if (status === 'supplement_sent' || status === 'supplement_requested') {
      actionStatus = 'supplement_submitted';
    } else if (supplementTotal > 0 && carrierTotal > 0) {
      actionStatus = 'supplement_required';
    } else if (status === 'carrier_review' || status === 'negotiation') {
      actionStatus = 'awaiting_carrier_response';
    } else if (aciTotal === 0) {
      actionStatus = 'needs_estimate';
    }

    const daysSince = raw.last_activity_date
      ? Math.floor((Date.now() - new Date(raw.last_activity_date).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      claimId: raw.claim_id || '',
      claimNumber: raw.claim_number || raw.project_name || '',
      refString: raw.ref_string || '',
      clientName: raw.client_name || '',
      carrierName: raw.carrier_name || '',
      propertyAddress: raw.property_address || '',
      assignedAdjusterId: raw.assigned_adjuster_id || null,
      assignedAdjusterName: raw.assigned_adjuster_name || null,
      currentPhase: raw.claim_phase || raw.recovery_status || '',
      actionStatus,
      recoveryStatus: raw.recovery_status || 'estimating',
      engagementStatus: daysSince !== null && daysSince > 14 ? 'stalled' : 'active',
      aciEstimate: aciTotal,
      carrierEstimate: carrierTotal,
      supplementTotal,
      totalPaid: recovered,
      recoveryPercent: recoveryPct,
      totalTasks: 0,
      overdueTasks: 0,
      pendingTasks: 0,
      unreadCount: 0,
      lastCommunicationDate: null,
      signals: {
        hasUnreadCommunications: false,
        hasOverdueTasks: false,
        isStalled: daysSince !== null && daysSince > 14,
        hasNewPayment: recovered > 0,
        hasNewCarrierResponse: false,
        daysSinceLastActivity: daysSince,
      },
      createdAt: raw.created_at || '',
      lastActivityDate: raw.last_activity_date || raw.created_at || null,
    };
  }

  // ── Template helpers ──────────────────────────────────────────

  openClaim(claim: CommandCenterClaimView): void {
    if (claim.claimId) {
      this.router.navigate(['/app/claim', claim.claimId]);
    }
  }

  getQueuePreview(queue: ActionQueue): CommandCenterClaimView[] {
    return queue.claims
      .sort((a, b) => (b.signals.daysSinceLastActivity || 0) - (a.signals.daysSinceLastActivity || 0))
      .slice(0, this.QUEUE_PREVIEW_LIMIT);
  }

  getPriorityColor(status: ClaimActionStatus): string {
    const priority = ACTION_STATUS_META[status]?.priority || 5;
    if (priority === 1) return '#c62828';
    if (priority === 2) return '#e65100';
    if (priority === 3) return '#f9a825';
    return '#4caf50';
  }

  getPriorityLabel(status: ClaimActionStatus): string {
    const priority = ACTION_STATUS_META[status]?.priority || 5;
    if (priority === 1) return 'P1';
    if (priority === 2) return 'P2';
    if (priority === 3) return 'P3';
    return 'P4';
  }

  formatDaysAgo(days: number | null): string {
    if (days === null) return '-';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days}d ago`;
  }

  fmtCurrency(val: number): string {
    if (val == null) return '$0';
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}
