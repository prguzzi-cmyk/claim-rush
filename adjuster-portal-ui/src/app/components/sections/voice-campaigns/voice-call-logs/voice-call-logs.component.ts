import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { VoiceCampaignService } from 'src/app/services/voice-campaign.service';
import {
  VoiceCampaign,
  VoiceCallLog,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
  CALL_STATUS_ICONS,
  CALL_STATUS_COLORS,
} from 'src/app/models/voice-campaign.model';

@Component({
  selector: 'app-voice-call-logs',
  templateUrl: './voice-call-logs.component.html',
  styleUrls: ['./voice-call-logs.component.scss'],
  standalone: false,
})
export class VoiceCallLogsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  loading = true;
  loadError = false;
  callLogs: VoiceCallLog[] = [];
  campaigns: VoiceCampaign[] = [];

  displayedColumns = ['lead_name', 'phone_number', 'campaign', 'duration', 'status', 'outcome', 'retries', 'cost', 'created_at', 'actions'];
  dataSource = new MatTableDataSource<VoiceCallLog>();

  outcomeFilter = '';
  campaignFilter = '';
  searchTerm = '';
  outcomeOptions = Object.entries(OUTCOME_LABELS).map(([value, label]) => ({ value, label }));

  // Summary stats
  totalCalls = 0;
  completedCalls = 0;
  avgDuration = 0;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private campaignService: VoiceCampaignService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (data: VoiceCallLog, filter: string) => {
      return (data.lead_name || '').toLowerCase().includes(filter)
        || (data.phone_number || '').includes(filter);
    };
    this.loadCampaigns();
    this.loadCallLogs();
  }

  loadCampaigns(): void {
    this.campaignService.list().pipe(takeUntil(this.destroy$)).subscribe(campaigns => {
      this.campaigns = campaigns;
    });
  }

  loadCallLogs(): void {
    this.loading = true;
    this.loadError = false;
    const filters: any = {};
    if (this.campaignFilter) filters.campaign_id = this.campaignFilter;
    if (this.outcomeFilter) filters.outcome = this.outcomeFilter;
    this.campaignService.getCallLogs(filters).pipe(takeUntil(this.destroy$)).subscribe({
      next: (logs) => {
        this.callLogs = logs;
        this.dataSource.data = logs;
        setTimeout(() => {
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
        });
        this.computeStats();
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load call logs', 'Retry', { duration: 5000 })
          .onAction().subscribe(() => this.loadCallLogs());
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  private computeStats(): void {
    this.totalCalls = this.callLogs.length;
    this.completedCalls = this.callLogs.filter(c => c.status === 'completed').length;
    const totalDuration = this.callLogs.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    this.avgDuration = this.totalCalls > 0 ? Math.round(totalDuration / this.totalCalls) : 0;
  }

  getCampaignName(log: VoiceCallLog): string {
    if (!log.campaign_id) return '—';
    const campaign = this.campaigns.find(c => c.id === log.campaign_id);
    return campaign?.name || '—';
  }

  getOutcomeLabel(outcome: string): string {
    return OUTCOME_LABELS[outcome] || outcome || '—';
  }

  getOutcomeColor(outcome: string): string {
    return OUTCOME_COLORS[outcome] || '#9e9e9e';
  }

  getCallStatusIcon(status: string): string {
    return CALL_STATUS_ICONS[status] || 'schedule';
  }

  getCallStatusColor(status: string): string {
    return CALL_STATUS_COLORS[status] || '#bdbdbd';
  }

  viewTranscript(log: VoiceCallLog): void {
    this.router.navigate(['/app/outreach/transcripts', log.id]);
  }

  onFilterChange(): void {
    this.searchTerm = '';
    this.dataSource.filter = '';
    if (this.paginator) this.paginator.firstPage();
    this.loadCallLogs();
  }

  applySearch(): void {
    this.dataSource.filter = this.searchTerm.trim().toLowerCase();
    if (this.paginator) this.paginator.firstPage();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.dataSource.filter = '';
  }

  clearAllFilters(): void {
    this.campaignFilter = '';
    this.outcomeFilter = '';
    this.searchTerm = '';
    this.dataSource.filter = '';
    this.loadCallLogs();
  }

  formatCost(cents: number): string {
    if (!cents) return '—';
    return '$' + (cents / 100).toFixed(2);
  }

  getExportCount(): number {
    return this.dataSource.filteredData?.length || this.callLogs.length;
  }

  exportCSV(): void {
    const headers = ['Lead Name', 'Phone', 'Campaign', 'Duration (s)', 'Status', 'Outcome', 'Retries', 'Cost', 'Date'];
    const data = this.dataSource.filteredData.length ? this.dataSource.filteredData : this.callLogs;
    const rows = data.map(log => [
      log.lead_name || 'Unknown',
      log.phone_number || '',
      this.getCampaignName(log),
      log.duration_seconds?.toString() || '0',
      log.status || '',
      this.getOutcomeLabel(log.outcome || ''),
      (log.retry_count || 0).toString(),
      this.formatCost(log.cost_cents || 0),
      log.created_at ? new Date(log.created_at).toLocaleString() : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
