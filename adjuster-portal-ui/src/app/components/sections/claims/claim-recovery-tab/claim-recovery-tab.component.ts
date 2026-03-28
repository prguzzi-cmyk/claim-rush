import { Component, Input, OnInit } from '@angular/core';
import { Claim } from 'src/app/models/claim.model';
import { ClaimPayment } from 'src/app/models/payment-claim.model';
import { ClaimService } from 'src/app/services/claim.service';
import { ClaimMetricsService } from 'src/app/shared/services/claim-metrics.service';
import { ClaimFinancialSnapshot, ClaimStatusSnapshot } from 'src/app/shared/models/claim-financials.model';
import { getActivityIcon, getActivityColor, getActivityLabel } from 'src/app/models/claim-activity.model';

@Component({
  selector: 'app-claim-recovery-tab',
  templateUrl: './claim-recovery-tab.component.html',
  styleUrls: ['./claim-recovery-tab.component.scss'],
  standalone: false
})
export class ClaimRecoveryTabComponent implements OnInit {

  @Input() claim: Claim;

  // ── Shared engine outputs ──────────────────────────────────────────────────
  financials: ClaimFinancialSnapshot | null = null;
  status: ClaimStatusSnapshot | null = null;

  // ── Local data (not part of the shared engine) ─────────────────────────────
  recentPayments: ClaimPayment[] = [];
  recentActivities: any[] = [];

  loading = true;

  // Activity helpers
  getActivityIcon = getActivityIcon;
  getActivityColor = getActivityColor;
  getActivityLabel = getActivityLabel;

  constructor(
    private claimService: ClaimService,
    private claimMetrics: ClaimMetricsService,
  ) {}

  ngOnInit(): void {
    if (!this.claim?.id) return;
    this.loadData();
  }

  loadData(): void {
    this.loading = true;

    // ── 1. Central engine: financial + status metrics ─────────────────────
    this.claimMetrics.getMetrics(this.claim).subscribe(
      (metrics) => {
        this.financials = metrics.financials;
        this.status = metrics.status;
        this.loading = false;
      },
      () => { this.loading = false; }
    );

    // ── 2. Local data: recent payments (not part of financial engine) ─────
    this.claimService.getClaimPayments(this.claim.id, {
      page: 1, size: 5, sort_by: 'payment_date', order_by: 'desc'
    }).subscribe((res: any) => {
      this.recentPayments = res?.items || [];
    });

    // ── 3. Local data: recent activities for the feed ────────────────────
    this.claimService.getClaimTimeline(this.claim.id).subscribe((events: any[]) => {
      this.recentActivities = (events || []).slice(0, 5);
    });
  }

  fmtCurrency(val: number): string {
    if (val == null) return '$0.00';
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get recoveryProgressPct(): number {
    return this.financials?.recoveryPercent ?? 0;
  }

  get progressBarColor(): string {
    if (this.recoveryProgressPct >= 75) return 'primary';
    if (this.recoveryProgressPct >= 50) return 'accent';
    return 'warn';
  }

  get progressBarClass(): string {
    if (this.recoveryProgressPct >= 75) return 'progress-green';
    if (this.recoveryProgressPct >= 50) return 'progress-blue';
    if (this.recoveryProgressPct >= 25) return 'progress-orange';
    return 'progress-red';
  }

  get assignedAdjusterName(): string {
    if (this.claim?.assigned_user) {
      return `${this.claim.assigned_user.first_name || ''} ${this.claim.assigned_user.last_name || ''}`.trim();
    }
    return '-';
  }

  get lastActivityDate(): string {
    if (this.recentActivities.length > 0) {
      return this.recentActivities[0].timestamp;
    }
    return null;
  }
}
