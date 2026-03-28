import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { VoiceCampaignService } from 'src/app/services/voice-campaign.service';
import {
  VoiceCampaign,
  VoiceCallLog,
  VoiceCampaignAnalytics,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
  CAMPAIGN_STATUS_COLORS,
  CALL_STATUS_ICONS,
  CALL_STATUS_COLORS,
} from 'src/app/models/voice-campaign.model';
import { VoiceLeadSelectorDialogComponent } from '../voice-lead-selector-dialog/voice-lead-selector-dialog.component';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-voice-campaign-detail',
  templateUrl: './voice-campaign-detail.component.html',
  styleUrls: ['./voice-campaign-detail.component.scss'],
  standalone: false,
})
export class VoiceCampaignDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  loading = true;
  actionInProgress = false;
  campaign: VoiceCampaign | null = null;

  // Cost & duration stats
  totalCost = 0;
  totalDuration = 0;

  // Call logs
  callLogs: VoiceCallLog[] = [];
  callLogDataSource = new MatTableDataSource<VoiceCallLog>();
  callLogColumns = ['lead_name', 'phone_number', 'status', 'duration', 'outcome', 'created_at', 'actions'];
  callLogSearchTerm = '';
  callLogOutcomeFilter = '';
  outcomeOptions = Object.entries(OUTCOME_LABELS).map(([value, label]) => ({ value, label }));

  // Analytics
  analytics: VoiceCampaignAnalytics = {
    total_calls: 0,
    calls_answered: 0,
    conversion_rate: 0,
    avg_duration_seconds: 0,
    outcome_breakdown: {},
    daily_trend: [],
  };
  outcomeEntries: Array<{ key: string; label: string; count: number; color: string; percent: number }> = [];

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private campaignService: VoiceCampaignService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.callLogDataSource.filterPredicate = (log: VoiceCallLog, _filter: string) => {
      const search = this.callLogSearchTerm.trim().toLowerCase();
      const searchMatch = !search
        || (log.lead_name || '').toLowerCase().includes(search)
        || (log.phone_number || '').includes(search);
      const outcomeMatch = !this.callLogOutcomeFilter || log.outcome === this.callLogOutcomeFilter;
      return searchMatch && outcomeMatch;
    };
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCampaign(id);
      this.loadCallLogs(id);
      this.loadAnalytics(id);
    }
  }

  applyCallLogFilters(): void {
    this.callLogDataSource.filter = `${this.callLogSearchTerm}|${this.callLogOutcomeFilter}`;
    if (this.paginator) this.paginator.firstPage();
  }

  private loadCampaign(id: string): void {
    this.campaignService.getById(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (c) => {
        this.campaign = c;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private loadCallLogs(campaignId: string): void {
    this.campaignService.getCallLogs({ campaign_id: campaignId })
      .pipe(takeUntil(this.destroy$))
      .subscribe(logs => {
        this.callLogs = logs;
        this.callLogDataSource.data = logs;
        this.totalCost = logs.reduce((sum, l) => sum + (l.cost_cents || 0), 0);
        this.totalDuration = logs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
        setTimeout(() => {
          this.callLogDataSource.paginator = this.paginator;
          this.callLogDataSource.sort = this.sort;
        });
      });
  }

  private loadAnalytics(campaignId: string): void {
    this.campaignService.getAnalytics(campaignId).pipe(takeUntil(this.destroy$)).subscribe(a => {
      this.analytics = a;
      this.buildOutcomeEntries();
    });
  }

  private buildOutcomeEntries(): void {
    const breakdown = this.analytics.outcome_breakdown;
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0) || 1;
    this.outcomeEntries = Object.entries(breakdown).map(([key, count]) => ({
      key,
      label: OUTCOME_LABELS[key] || key,
      count,
      color: OUTCOME_COLORS[key] || '#9e9e9e',
      percent: Math.round(count / total * 100),
    })).sort((a, b) => b.count - a.count);
  }

  getProgressPercent(): number {
    if (!this.campaign?.total_leads_targeted) return 0;
    return Math.round(this.campaign.total_calls_placed / this.campaign.total_leads_targeted * 100);
  }

  getEstimatedCompletion(): { remaining: number; estDate: string } | null {
    if (!this.campaign || this.campaign.status !== 'active') return null;
    const remaining = (this.campaign.total_leads_targeted || 0) - (this.campaign.total_calls_placed || 0);
    if (remaining <= 0) return null;
    const maxPerDay = this.campaign.max_calls_per_day || 100;
    const daysNeeded = Math.ceil(remaining / maxPerDay);
    const est = new Date();
    est.setDate(est.getDate() + daysNeeded);
    return { remaining, estDate: est.toLocaleDateString() };
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

  getOutcomeLabel(outcome: string): string {
    return OUTCOME_LABELS[outcome] || outcome || '—';
  }

  getOutcomeColor(outcome: string): string {
    return OUTCOME_COLORS[outcome] || '#9e9e9e';
  }

  getAnswerRate(): number {
    if (this.analytics.total_calls === 0) return 0;
    return Math.round(this.analytics.calls_answered / this.analytics.total_calls * 100);
  }

  // ── Daily Trend ──

  getTrendBarHeight(count: number): number {
    if (!this.analytics.daily_trend.length) return 0;
    if (count === 0) return 0;
    const max = Math.max(...this.analytics.daily_trend.map(d => d.calls), 1);
    return Math.max(5, Math.round((count / max) * 100));
  }

  formatTrendDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // ── Campaign Actions ──

  launchCampaign(): void {
    if (!this.campaign) return;
    const dialogRef = this.dialog.open(VoiceLeadSelectorDialogComponent, {
      width: '800px',
      maxHeight: '80vh',
    });
    dialogRef.afterClosed().subscribe(selectedLeads => {
      if (selectedLeads && selectedLeads.length > 0) {
        this.actionInProgress = true;
        const leadIds = selectedLeads.map((l: any) => l.id);
        this.campaignService.launch(this.campaign!.id, { lead_ids: leadIds })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.actionInProgress = false;
              this.snackBar.open(`Campaign launched with ${leadIds.length} leads`, 'OK', { duration: 4000 });
              this.reloadAll();
            },
            error: () => {
              this.actionInProgress = false;
              this.snackBar.open('Failed to launch campaign', 'Retry', { duration: 5000 })
                .onAction().subscribe(() => this.launchCampaign());
            },
          });
      }
    });
  }

  pauseCampaign(): void {
    if (!this.campaign) return;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Pause Campaign',
        message: `Pause "${this.campaign.name}"? Active calls will complete but no new calls will be placed.`,
        confirmLabel: 'Pause',
        color: 'warn',
      },
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.actionInProgress = true;
      this.campaignService.pause(this.campaign!.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.actionInProgress = false;
          this.snackBar.open('Campaign paused', 'OK', { duration: 3000 });
          this.reloadAll();
        },
        error: () => {
          this.actionInProgress = false;
          this.snackBar.open('Failed to pause campaign', 'Retry', { duration: 5000 })
            .onAction().subscribe(() => this.pauseCampaign());
        },
      });
    });
  }

  resumeCampaign(): void {
    if (!this.campaign) return;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Resume Campaign',
        message: `Resume "${this.campaign.name}" and continue calling leads?`,
        confirmLabel: 'Resume',
        color: 'primary',
      },
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.actionInProgress = true;
      this.campaignService.resume(this.campaign!.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.actionInProgress = false;
          this.snackBar.open('Campaign resumed', 'OK', { duration: 3000 });
          this.reloadAll();
        },
        error: () => {
          this.actionInProgress = false;
          this.snackBar.open('Failed to resume campaign', 'Retry', { duration: 5000 })
            .onAction().subscribe(() => this.resumeCampaign());
        },
      });
    });
  }

  deleteCampaign(): void {
    if (!this.campaign) return;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Campaign',
        message: `Are you sure you want to delete "${this.campaign.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        color: 'warn',
      },
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.actionInProgress = true;
      this.campaignService.delete(this.campaign!.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.snackBar.open(`Campaign "${this.campaign!.name}" deleted`, 'OK', { duration: 3000 });
          this.goBack();
        },
        error: () => {
          this.actionInProgress = false;
          this.snackBar.open('Failed to delete campaign', 'OK', { duration: 3000 });
        },
      });
    });
  }

  editCampaign(): void {
    if (!this.campaign) return;
    this.router.navigate(['/app/outreach/campaigns', this.campaign.id]);
  }

  private reloadAll(): void {
    const id = this.campaign?.id;
    if (id) {
      this.loadCampaign(id);
      this.loadCallLogs(id);
      this.loadAnalytics(id);
    }
  }

  formatCost(cents: number): string {
    if (!cents) return '$0.00';
    return '$' + (cents / 100).toFixed(2);
  }

  exportCallLogs(): void {
    if (this.callLogs.length === 0) return;
    const headers = ['Lead', 'Phone', 'Status', 'Outcome', 'Duration (s)', 'Date'];
    const rows = this.callLogs.map(log => [
      log.lead_name || 'Unknown',
      log.phone_number || '',
      log.status || '',
      this.getOutcomeLabel(log.outcome || ''),
      log.duration_seconds ?? 0,
      log.created_at ? new Date(log.created_at).toLocaleString() : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.campaign?.name || 'campaign'}-call-logs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  viewTranscript(log: VoiceCallLog): void {
    this.router.navigate(['/app/outreach/transcripts', log.id]);
  }

  goBack(): void {
    this.router.navigate(['/app/outreach/voice']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
