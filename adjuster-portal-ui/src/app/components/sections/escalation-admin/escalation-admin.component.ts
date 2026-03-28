import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  EscalationAdminService,
  ActiveEscalationSummary,
  EscalationStatusResponse,
  EscalationAttempt,
} from '../../../services/escalation-admin.service';

@Component({
  selector: 'app-escalation-admin',
  templateUrl: './escalation-admin.component.html',
  styleUrls: ['./escalation-admin.component.scss'],
  standalone: false,
})
export class EscalationAdminComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  // Data
  escalations: ActiveEscalationSummary[] = [];
  loading = true;
  isLiveData = false;
  totalCount = 0;
  pageSize = 50;
  currentPage = 0;

  // Detail panel
  selectedEscalation: ActiveEscalationSummary | null = null;
  detailData: EscalationStatusResponse | null = null;
  detailLoading = false;
  detailPanelOpen = false;

  // Escalation level labels
  readonly levelLabels: Record<number, string> = {
    1: 'Agent 1',
    2: 'Agent 2',
    3: 'Agent 3',
    4: 'Chapter President',
    5: 'Home Office',
    6: 'State Pool',
  };

  readonly statusColors: Record<string, string> = {
    new: '#3b82f6',
    ai_call_initiated: '#8b5cf6',
    connected_live: '#10b981',
    transferred: '#059669',
    escalated: '#f97316',
    queued_quiet_hours: '#eab308',
    closed_signed: '#22c55e',
    closed_not_interested: '#6b7280',
  };

  constructor(
    private escalationService: EscalationAdminService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadEscalations();
    this.refreshInterval = setInterval(() => this.loadEscalations(), 30000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  loadEscalations(): void {
    this.loading = true;
    this.escalationService.listActive(this.pageSize, this.currentPage * this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.escalations = data;
          this.totalCount = data.length;
          this.loading = false;
          this.isLiveData = true;
        },
        error: () => {
          this.loading = false;
          this.isLiveData = false;
          this.escalations = [];
        },
      });
  }

  openDetail(escalation: ActiveEscalationSummary): void {
    this.selectedEscalation = escalation;
    this.detailPanelOpen = true;
    this.detailLoading = true;
    this.detailData = null;

    this.escalationService.getStatus(escalation.lead_id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.detailData = data;
          this.detailLoading = false;
        },
        error: () => {
          this.detailLoading = false;
          this.snackBar.open('Failed to load escalation details', '', { duration: 3000 });
        },
      });
  }

  closeDetail(): void {
    this.detailPanelOpen = false;
    this.selectedEscalation = null;
    this.detailData = null;
  }

  resolveEscalation(trackerId: string): void {
    this.escalationService.resolve(trackerId, 'manual_close')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Escalation resolved', '', { duration: 3000 });
          this.closeDetail();
          this.loadEscalations();
        },
        error: () => {
          this.snackBar.open('Failed to resolve escalation', '', { duration: 3000 });
        },
      });
  }

  refresh(): void {
    this.loadEscalations();
    this.snackBar.open('Escalations refreshed', '', { duration: 2000 });
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || '#6b7280';
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getLevelLabel(level: number): string {
    return this.levelLabels[level] || `Level ${level}`;
  }

  getLevelColor(level: number): string {
    if (level <= 2) return '#3b82f6';
    if (level === 3) return '#f97316';
    if (level === 4) return '#ef4444';
    if (level === 5) return '#dc2626';
    return '#991b1b';
  }

  getTransferStatusColor(status: string): string {
    switch (status) {
      case 'answered': return '#10b981';
      case 'ringing': case 'initiated': return '#eab308';
      case 'no_answer': case 'busy': case 'timeout': return '#f97316';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  }

  getTimeAgo(dateStr: string | null): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  getElapsedTime(dateStr: string | null): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    if (hours > 0) return `${hours}h ${remainMins}m`;
    return `${mins}m`;
  }

  getNotificationIcons(attempt: EscalationAttempt): string[] {
    const icons: string[] = [];
    if (attempt.sms_sent) icons.push('sms');
    if (attempt.email_sent) icons.push('email');
    if (attempt.in_app_sent) icons.push('notifications');
    return icons;
  }
}
