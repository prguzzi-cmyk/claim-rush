import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { VoiceCampaignService } from 'src/app/services/voice-campaign.service';
import {
  VoiceCampaign,
  VoiceCampaignStatus,
  VoiceCallLog,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
  CAMPAIGN_STATUS_COLORS,
  CALL_STATUS_ICONS,
  CALL_STATUS_COLORS,
} from 'src/app/models/voice-campaign.model';
import { VoiceLeadSelectorDialogComponent } from '../voice-lead-selector-dialog/voice-lead-selector-dialog.component';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-voice-campaign-dashboard',
  templateUrl: './voice-campaign-dashboard.component.html',
  styleUrls: ['./voice-campaign-dashboard.component.scss'],
  standalone: false,
  animations: [
    trigger('detailExpand', [
      state('collapsed,void', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class VoiceCampaignDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  campaigns: VoiceCampaign[] = [];
  loading = true;
  loadError = false;
  statusFilter = '';
  campaignSearchTerm = '';
  actionInProgress: string | null = null; // campaign ID currently being acted on
  lastRefreshTime = Date.now();
  isDataStale = false;

  // KPIs
  totalCampaigns = 0;
  activeCampaigns = 0;
  totalCalls = 0;
  totalAnswered = 0;
  totalBooked = 0;
  overallConversion = 0;

  // Campaign table
  displayedColumns = [
    'name', 'status', 'progress', 'total_leads_targeted', 'total_calls_placed',
    'total_calls_answered', 'total_appointments_booked', 'conversion', 'actions',
  ];
  dataSource = new MatTableDataSource<VoiceCampaign>();
  expandedCampaign: VoiceCampaign | null = null;

  // Call logs for expanded campaign
  campaignCallLogs: VoiceCallLog[] = [];
  loadingCallLogs = false;
  callLogColumns = ['lead_name', 'phone_number', 'status', 'duration', 'outcome', 'created_at', 'call_actions'];

  // Recent activity
  recentCalls: VoiceCallLog[] = [];
  loadingRecent = false;
  recentColumns = ['lead_name', 'phone_number', 'status', 'duration', 'outcome', 'created_at', 'call_actions'];
  recentDataSource = new MatTableDataSource<VoiceCallLog>();

  @ViewChild('campaignPaginator') campaignPaginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild('recentPaginator') recentPaginator: MatPaginator;

  constructor(
    private campaignService: VoiceCampaignService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (data: VoiceCampaign, filter: string) => {
      return (data.name || '').toLowerCase().includes(filter)
        || (data.description || '').toLowerCase().includes(filter);
    };
    this.loadCampaigns();
    this.loadRecentActivity();
    this.startAutoRefresh();
  }

  applyCampaignSearch(): void {
    this.dataSource.filter = this.campaignSearchTerm.trim().toLowerCase();
    if (this.campaignPaginator) this.campaignPaginator.firstPage();
  }

  clearCampaignSearch(): void {
    this.campaignSearchTerm = '';
    this.dataSource.filter = '';
    if (this.campaignPaginator) this.campaignPaginator.firstPage();
  }

  private startAutoRefresh(): void {
    interval(30000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.refreshData();
    });
    // Mark data as stale after 5 minutes without successful refresh
    interval(60000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (Date.now() - this.lastRefreshTime > 5 * 60 * 1000) {
        this.isDataStale = true;
      }
    });
  }

  private refreshData(): void {
    const status = this.statusFilter || undefined;
    this.campaignService.list(status).pipe(takeUntil(this.destroy$)).subscribe({
      next: (campaigns) => {
        this.campaigns = campaigns;
        this.dataSource.data = campaigns;
        this.computeKPIs();
        this.lastRefreshTime = Date.now();
        this.isDataStale = false;
      },
      error: () => {}, // Keep last-known-good data on silent refresh failure
    });
    this.campaignService.getCallLogs().pipe(takeUntil(this.destroy$)).subscribe({
      next: (logs) => {
        this.recentCalls = logs.slice(0, 50);
        this.recentDataSource.data = this.recentCalls;
      },
      error: () => {}, // Keep last-known-good data on silent refresh failure
    });
  }

  loadCampaigns(): void {
    this.loading = true;
    this.loadError = false;
    const status = this.statusFilter || undefined;
    this.campaignService.list(status).pipe(takeUntil(this.destroy$)).subscribe({
      next: (campaigns) => {
        this.campaigns = campaigns;
        this.dataSource.data = campaigns;
        setTimeout(() => {
          this.dataSource.paginator = this.campaignPaginator;
          this.dataSource.sort = this.sort;
        });
        this.computeKPIs();
        this.lastRefreshTime = Date.now();
        this.isDataStale = false;
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load campaigns', 'OK', { duration: 3000 });
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  loadRecentActivity(): void {
    this.loadingRecent = true;
    this.campaignService.getCallLogs().pipe(takeUntil(this.destroy$)).subscribe({
      next: (logs) => {
        this.recentCalls = logs.slice(0, 50);
        this.recentDataSource.data = this.recentCalls;
        setTimeout(() => {
          this.recentDataSource.paginator = this.recentPaginator;
        });
        this.loadingRecent = false;
      },
      error: () => {
        this.snackBar.open('Failed to load recent activity', 'OK', { duration: 3000 });
        this.loadingRecent = false;
      },
    });
  }

  private computeKPIs(): void {
    this.totalCampaigns = this.campaigns.length;
    this.activeCampaigns = this.campaigns.filter(c => c.status === VoiceCampaignStatus.ACTIVE).length;
    this.totalCalls = this.campaigns.reduce((sum, c) => sum + c.total_calls_placed, 0);
    this.totalAnswered = this.campaigns.reduce((sum, c) => sum + c.total_calls_answered, 0);
    this.totalBooked = this.campaigns.reduce((sum, c) => sum + c.total_appointments_booked, 0);
    this.overallConversion = this.totalCalls > 0 ? Math.round(this.totalBooked / this.totalCalls * 100) : 0;
  }

  getCampaignHealth(campaign: VoiceCampaign): { color: string; label: string } | null {
    if (campaign.status === 'draft' || campaign.total_calls_placed < 5) return null;
    const answerRate = campaign.total_calls_placed > 0
      ? campaign.total_calls_answered / campaign.total_calls_placed * 100
      : 0;
    if (answerRate >= 40) return { color: '#4caf50', label: 'Healthy' };
    if (answerRate >= 20) return { color: '#ff9800', label: 'Fair' };
    return { color: '#f44336', label: 'Low answer rate' };
  }

  getConversionRate(campaign: VoiceCampaign): number {
    if (campaign.total_calls_placed === 0) return 0;
    return Math.round(campaign.total_appointments_booked / campaign.total_calls_placed * 100);
  }

  getProgressPercent(campaign: VoiceCampaign): number {
    if (!campaign.total_leads_targeted || campaign.total_leads_targeted === 0) return 0;
    return Math.round(campaign.total_calls_placed / campaign.total_leads_targeted * 100);
  }

  getProgressColor(campaign: VoiceCampaign): string {
    const pct = this.getProgressPercent(campaign);
    if (pct >= 100) return '#4caf50';
    if (pct >= 50) return '#2196f3';
    return '#ff9800';
  }

  getProjectedDays(campaign: VoiceCampaign): number | null {
    if (campaign.status !== 'active' || !campaign.total_leads_targeted) return null;
    const remaining = campaign.total_leads_targeted - campaign.total_calls_placed;
    if (remaining <= 0) return null;
    const maxPerDay = campaign.max_calls_per_day || 100;
    return Math.ceil(remaining / maxPerDay);
  }

  getStatusColor(status: string): string {
    return CAMPAIGN_STATUS_COLORS[status] || '#9e9e9e';
  }

  getCallStatusIcon(status: string): string {
    return CALL_STATUS_ICONS[status] || 'schedule';
  }

  getCallStatusColor(status: string): string {
    return CALL_STATUS_COLORS[status] || '#bdbdbd';
  }

  manualRefresh(): void {
    this.loadCampaigns();
    this.loadRecentActivity();
  }

  onStatusFilterChange(): void {
    this.loadCampaigns();
  }

  // ── Campaign Actions ──

  navigateToBuilder(): void {
    this.router.navigate(['/app/outreach/campaigns/new']);
  }

  startCampaign(campaign: VoiceCampaign, event: Event): void {
    event.stopPropagation();
    const dialogRef = this.dialog.open(VoiceLeadSelectorDialogComponent, {
      width: '800px',
      maxHeight: '80vh',
    });

    dialogRef.afterClosed().subscribe(selectedLeads => {
      if (selectedLeads && selectedLeads.length > 0) {
        this.actionInProgress = campaign.id;
        const leadIds = selectedLeads.map((l: any) => l.id);
        this.campaignService.launch(campaign.id, { lead_ids: leadIds })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.actionInProgress = null;
              this.snackBar.open(
                `Campaign "${campaign.name}" launched with ${leadIds.length} leads`,
                'OK', { duration: 4000 },
              );
              this.loadCampaigns();
              this.loadRecentActivity();
            },
            error: () => {
              this.actionInProgress = null;
              this.snackBar.open('Failed to launch campaign', 'Retry', { duration: 5000 })
                .onAction().subscribe(() => this.startCampaign(campaign, event));
            },
          });
      }
    });
  }

  resumeCampaign(campaign: VoiceCampaign, event: Event): void {
    event.stopPropagation();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Resume Campaign',
        message: `Resume "${campaign.name}" and continue calling leads?`,
        confirmLabel: 'Resume',
        color: 'primary',
      },
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.actionInProgress = campaign.id;
      this.campaignService.resume(campaign.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.actionInProgress = null;
          this.snackBar.open(`Campaign "${campaign.name}" resumed`, 'OK', { duration: 3000 });
          this.loadCampaigns();
          this.loadRecentActivity();
        },
        error: () => {
          this.actionInProgress = null;
          this.snackBar.open('Failed to resume campaign', 'Retry', { duration: 5000 })
            .onAction().subscribe(() => this.resumeCampaign(campaign, event));
        },
      });
    });
  }

  pauseCampaign(campaign: VoiceCampaign, event: Event): void {
    event.stopPropagation();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Pause Campaign',
        message: `Pause "${campaign.name}"? Active calls will complete but no new calls will be placed. You can resume later.`,
        confirmLabel: 'Pause',
        color: 'warn',
      },
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.actionInProgress = campaign.id;
      this.campaignService.pause(campaign.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.actionInProgress = null;
          this.snackBar.open(`Campaign "${campaign.name}" paused`, 'OK', { duration: 3000 });
          this.loadCampaigns();
          this.loadRecentActivity();
        },
        error: () => {
          this.actionInProgress = null;
          this.snackBar.open('Failed to pause campaign', 'Retry', { duration: 5000 })
            .onAction().subscribe(() => this.pauseCampaign(campaign, event));
        },
      });
    });
  }

  editCampaign(campaign: VoiceCampaign, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/app/outreach/campaigns', campaign.id]);
  }

  deleteCampaign(campaign: VoiceCampaign, event: Event): void {
    event.stopPropagation();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Campaign',
        message: `Are you sure you want to delete "${campaign.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        color: 'warn',
      },
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.actionInProgress = campaign.id;
      this.campaignService.delete(campaign.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.actionInProgress = null;
          this.snackBar.open(`Campaign "${campaign.name}" deleted`, 'OK', { duration: 3000 });
          this.loadCampaigns();
          this.loadRecentActivity();
        },
        error: () => {
          this.actionInProgress = null;
          this.snackBar.open('Failed to delete campaign', 'OK', { duration: 3000 });
        },
      });
    });
  }

  duplicateCampaign(campaign: VoiceCampaign, event: Event): void {
    event.stopPropagation();
    this.actionInProgress = campaign.id;
    const duplicate = {
      name: `${campaign.name} (Copy)`,
      description: campaign.description,
      script_template: campaign.script_template,
      lead_source_filter: campaign.lead_source_filter,
      territory_state_filter: campaign.territory_state_filter,
      incident_type_filter: campaign.incident_type_filter,
      call_window_start: campaign.call_window_start,
      call_window_end: campaign.call_window_end,
      call_window_timezone: campaign.call_window_timezone,
      max_retries: campaign.max_retries,
      retry_delay_minutes: campaign.retry_delay_minutes,
      max_calls_per_day: campaign.max_calls_per_day,
    };
    this.campaignService.create(duplicate).pipe(takeUntil(this.destroy$)).subscribe({
      next: (created) => {
        this.actionInProgress = null;
        this.snackBar.open(`Campaign duplicated as "${created.name}"`, 'OK', { duration: 3000 });
        this.loadCampaigns();
      },
      error: () => {
        this.actionInProgress = null;
        this.snackBar.open('Failed to duplicate campaign', 'Retry', { duration: 5000 })
          .onAction().subscribe(() => this.duplicateCampaign(campaign, event));
      },
    });
  }

  viewCampaignDetail(campaign: VoiceCampaign, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/app/outreach/campaigns', campaign.id, 'detail']);
  }

  viewAnalytics(campaign: VoiceCampaign, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/app/outreach/analytics'], { queryParams: { campaignId: campaign.id } });
  }

  // ── Expandable Row ──

  toggleExpand(campaign: VoiceCampaign): void {
    if (this.expandedCampaign === campaign) {
      this.expandedCampaign = null;
      this.campaignCallLogs = [];
    } else {
      this.expandedCampaign = campaign;
      this.loadCampaignCallLogs(campaign.id);
    }
  }

  private loadCampaignCallLogs(campaignId: string): void {
    this.loadingCallLogs = true;
    this.campaignService.getCallLogs({ campaign_id: campaignId })
      .pipe(takeUntil(this.destroy$))
      .subscribe(logs => {
        this.campaignCallLogs = logs;
        this.loadingCallLogs = false;
      });
  }

  // ── Call Log Helpers ──

  getOutcomeLabel(outcome: string): string {
    return OUTCOME_LABELS[outcome] || outcome || '—';
  }

  getOutcomeColor(outcome: string): string {
    return OUTCOME_COLORS[outcome] || '#9e9e9e';
  }

  viewTranscript(callLog: VoiceCallLog, event?: Event): void {
    if (event) event.stopPropagation();
    this.router.navigate(['/app/outreach/transcripts', callLog.id]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
