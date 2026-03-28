import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { VoiceOutreachAgentService, VoiceDashboardKpis, VoiceAgentCampaign, VoiceCall, DailyCallMetric, CallOutcome } from '../voice-outreach-agent.service';

interface ActivityEvent {
  id: string;
  icon: string;
  iconColor: string;
  text: string;
  time: Date;
}

@Component({
  selector: 'app-voice-call-dashboard',
  templateUrl: './voice-call-dashboard.component.html',
  styleUrls: ['./voice-call-dashboard.component.scss'],
  standalone: false,
})
export class VoiceCallDashboardComponent implements OnInit, OnDestroy {
  kpis: VoiceDashboardKpis | null = null;
  campaigns: VoiceAgentCampaign[] = [];
  calls: VoiceCall[] = [];
  dailyMetrics: DailyCallMetric[] = [];
  recentQualified: VoiceCall[] = [];
  private subs: Subscription[] = [];

  outcomeBreakdown: { outcome: string; label: string; count: number; pct: number; color: string }[] = [];

  // ── Campaign Controls ──
  outreachType = 'ai_call';
  leadFilter = 'all';
  outreachRunning = false;

  // ── Live Activity Feed ──
  activityFeed: ActivityEvent[] = [];
  private activityInterval: any = null;

  constructor(
    private service: VoiceOutreachAgentService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.service.getKpis().subscribe(k => this.kpis = k),
      this.service.getCampaigns().subscribe(c => this.campaigns = c),
      this.service.getCalls().subscribe(c => {
        this.calls = c;
        this.recentQualified = c.filter(x => x.outcome === 'qualified_lead' || x.outcome === 'possible_claim').slice(0, 5);
        this.computeOutcomeBreakdown();
      }),
      this.service.getDailyMetrics().subscribe(m => this.dailyMetrics = m),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.activityInterval) clearInterval(this.activityInterval);
  }

  // ── Campaign Controls ──

  startOutreach(): void {
    this.outreachRunning = true;
    this.snackBar.open(`${this.outreachType.replace(/_/g, ' ').toUpperCase()} outreach started — targeting ${this.leadFilter} leads`, '', { duration: 2000 });

    // Simulate live activity feed
    this.activityFeed = [];
    const outcomes: { text: string; icon: string; color: string }[] = [
      { text: 'Calling Maria Gonzalez — 75024, TX', icon: 'phone', color: '#3b82f6' },
      { text: 'Connected — discussing storm damage claim', icon: 'phone_in_talk', color: '#10b981' },
      { text: 'No answer — James Rivera, 75201 TX', icon: 'phone_missed', color: '#6b7280' },
      { text: 'Interested! — Patricia Hernandez wants inspection', icon: 'thumb_up', color: '#10b981' },
      { text: 'Left voicemail — Derek Shaw, 76102 TX', icon: 'voicemail', color: '#8b5cf6' },
      { text: 'Appointment booked — Ana Morales, tomorrow 2pm', icon: 'event_available', color: '#f59e0b' },
      { text: 'Not interested — Tyler Jackson, 73102 OK', icon: 'cancel', color: '#ef4444' },
      { text: 'Calling Sarah Chen — 80202, CO', icon: 'phone', color: '#3b82f6' },
      { text: 'Connected — reviewing hail damage photos', icon: 'phone_in_talk', color: '#10b981' },
      { text: 'Qualified lead! — Emily Foster, $45K estimated', icon: 'star', color: '#00e5ff' },
      { text: 'Call back later — Marcus Lee, after 5pm', icon: 'schedule', color: '#f59e0b' },
      { text: 'Appointment booked — Angela Watts, Friday 10am', icon: 'event_available', color: '#f59e0b' },
    ];

    let idx = 0;
    this.activityInterval = setInterval(() => {
      if (idx >= outcomes.length) {
        clearInterval(this.activityInterval);
        this.activityInterval = null;
        this.outreachRunning = false;
        this.snackBar.open('Outreach batch completed', 'OK', { duration: 3000 });
        return;
      }
      const o = outcomes[idx];
      this.activityFeed.unshift({
        id: `act-${Date.now()}`,
        icon: o.icon,
        iconColor: o.color,
        text: o.text,
        time: new Date(),
      });
      // Keep feed to 20 max
      if (this.activityFeed.length > 20) this.activityFeed.pop();
      idx++;
    }, 1500);
  }

  stopOutreach(): void {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
    this.outreachRunning = false;
    this.snackBar.open('Outreach stopped', 'OK', { duration: 2000 });
  }

  // ── Outcome Breakdown ──

  private computeOutcomeBreakdown(): void {
    const outcomes: { key: CallOutcome; label: string; color: string }[] = [
      { key: 'qualified_lead', label: 'Qualified Lead', color: '#00e676' },
      { key: 'possible_claim', label: 'Possible Claim', color: '#00e5ff' },
      { key: 'call_back_later', label: 'Call Back', color: '#ffd600' },
      { key: 'left_voicemail', label: 'Voicemail', color: '#2979ff' },
      { key: 'not_interested', label: 'Not Interested', color: '#ff1744' },
      { key: 'no_answer', label: 'No Answer', color: '#64748b' },
    ];
    const total = this.calls.length || 1;
    this.outcomeBreakdown = outcomes.map(o => ({
      outcome: o.key, label: o.label,
      count: this.calls.filter(c => c.outcome === o.key).length,
      pct: Math.round((this.calls.filter(c => c.outcome === o.key).length / total) * 100),
      color: o.color,
    }));
  }

  // ── Navigation ──

  navigateTo(path: string): void {
    this.router.navigate(['/app/voice-outreach-agent/' + path]);
  }

  openTimeline(call: VoiceCall): void {
    this.router.navigate(['/app/voice-outreach-agent/timeline', call.id]);
  }

  getMaxDaily(): number {
    return Math.max(...this.dailyMetrics.map(d => d.placed), 1);
  }

  get activeCampaigns(): VoiceAgentCampaign[] {
    return this.campaigns.filter(c => c.status === 'active');
  }

  getConnectionRate(c: VoiceAgentCampaign): number {
    return c.callsPlaced ? Math.round((c.callsConnected / c.callsPlaced) * 100) : 0;
  }

  getOutcomeBadgeClass(outcome: string | null): string {
    if (!outcome) return 'badge-muted';
    const m: Record<string, string> = {
      qualified_lead: 'badge-green', possible_claim: 'badge-cyan', call_back_later: 'badge-yellow',
      left_voicemail: 'badge-blue', not_interested: 'badge-red', no_answer: 'badge-muted',
    };
    return m[outcome] || 'badge-muted';
  }

  formatOutcome(outcome: string): string {
    const m: Record<string, string> = {
      qualified_lead: 'Qualified Lead', possible_claim: 'Possible Claim', call_back_later: 'Call Back',
      left_voicemail: 'Voicemail', not_interested: 'Not Interested', no_answer: 'No Answer',
    };
    return m[outcome] || outcome;
  }

  formatTime(ts: string): string {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  timeAgo(d: Date): string {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  }
}
