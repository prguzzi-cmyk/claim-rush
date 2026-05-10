import { Component, OnDestroy, OnInit } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import {
  ActionLead,
  ActionNotification,
  ActionQueueResponse,
  DashboardMetrics,
  LeadTimelineResponse,
  OperationsService,
  TickerEvent,
  TickerResponse,
} from 'src/app/services/operations.service';

@Component({
  selector: 'app-mission-control',
  templateUrl: './mission-control.component.html',
  styleUrls: ['./mission-control.component.scss'],
  standalone: false,
})
export class MissionControlComponent implements OnInit, OnDestroy {
  metrics: DashboardMetrics | null = null;
  tickerEvents: TickerEvent[] = [];
  actionLeads: ActionLead[] = [];
  actionNotifications: ActionNotification[] = [];
  selectedLeadId: string | null = null;
  selectedTimeline: LeadTimelineResponse | null = null;

  lookbackHours = 24;
  asOf: string | null = null;
  loading = false;
  loadError: string | null = null;

  private pollSub: Subscription | null = null;
  private tickerPollSub: Subscription | null = null;

  // Decision-color map used by template
  severityClass: Record<string, string> = {
    critical: 'sev-critical',
    engagement: 'sev-engagement',
    info: 'sev-info',
    warning: 'sev-warning',
    muted: 'sev-muted',
  };

  constructor(private ops: OperationsService) {}

  ngOnInit(): void {
    this.refreshAll();
    // Dashboard metrics + action queue every 15s
    this.pollSub = interval(15000)
      .pipe(switchMap(() => this.ops.dashboardMetrics(this.lookbackHours)))
      .subscribe({
        next: (m) => { this.metrics = m; this.asOf = m.as_of; },
        error: () => {},
      });
    // Ticker every 5s for live feel
    this.tickerPollSub = interval(5000)
      .pipe(switchMap(() => this.ops.ticker(80)))
      .subscribe({
        next: (r: TickerResponse) => { this.tickerEvents = r.events; },
        error: () => {},
      });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.tickerPollSub?.unsubscribe();
  }

  refreshAll(): void {
    this.loading = true;
    this.loadError = null;
    this.ops.dashboardMetrics(this.lookbackHours).subscribe({
      next: (m) => { this.metrics = m; this.asOf = m.as_of; this.loading = false; },
      error: (e) => { this.loadError = 'metrics load failed'; this.loading = false; },
    });
    this.ops.ticker(80).subscribe({
      next: (r) => (this.tickerEvents = r.events),
      error: () => {},
    });
    this.ops.actionQueue({ limit: 25 }).subscribe({
      next: (q) => {
        this.actionLeads = q.leads_needing_followup;
        this.actionNotifications = q.notifications;
      },
      error: () => {},
    });
  }

  changeLookback(h: number): void {
    this.lookbackHours = h;
    this.refreshAll();
  }

  openLead(leadId: string): void {
    this.selectedLeadId = leadId;
    this.selectedTimeline = null;
    this.ops.leadTimeline(leadId).subscribe({
      next: (t) => (this.selectedTimeline = t),
      error: () => (this.loadError = `failed to load lead ${leadId}`),
    });
  }

  closeLead(): void {
    this.selectedLeadId = null;
    this.selectedTimeline = null;
  }

  // Format helpers
  priorityClass(score: number | null | undefined): string {
    if (score == null) return 'pri-none';
    if (score >= 90) return 'pri-critical';
    if (score >= 70) return 'pri-high';
    if (score >= 40) return 'pri-med';
    return 'pri-low';
  }

  agoLabel(iso: string | null | undefined): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    const sec = Math.max(0, (Date.now() - then) / 1000);
    if (sec < 60) return `${Math.round(sec)}s`;
    if (sec < 3600) return `${Math.round(sec / 60)}m`;
    if (sec < 86400) return `${Math.round(sec / 3600)}h`;
    return `${Math.round(sec / 86400)}d`;
  }

  decisionEntries(): Array<{ key: string; value: number }> {
    if (!this.metrics) return [];
    return Object.entries(this.metrics.by_decision)
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }
}
