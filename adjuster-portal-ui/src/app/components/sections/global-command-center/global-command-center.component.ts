import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { IncidentFeedService, NormalizedIncident } from 'src/app/services/incident-feed.service';
import { PlatformMetricsService, PlatformMetrics, AdjusterMetric } from 'src/app/services/platform-metrics.service';
import { PlatformActivityService, PlatformActivityEvent } from 'src/app/services/platform-activity.service';
import { EstimatingService } from 'src/app/services/estimating.service';
import { ClaimRecoveryEngineService } from 'src/app/shared/services/claim-recovery-engine.service';
import { ClaimOpportunityEngineService } from 'src/app/shared/services/claim-opportunity-engine.service';
import { PotentialClaimRow, ClaimOpportunity, OpportunityMetrics, PRIORITY_META, ACTION_META, SCORING_FACTOR_META, DEFAULT_SCORING_WEIGHTS } from 'src/app/shared/models/claim-opportunity.model';
import { ClaimRecoveryRecord, RecoveryDashboardMetrics, RECOVERY_STATUS_META, RecoveryStatus } from 'src/app/shared/models/claim-recovery-metrics.model';
import { MatSnackBar } from '@angular/material/snack-bar';

interface TickerEvent { emoji: string; text: string; }
interface KpiCard { label: string; value: number; icon: string; trend: 'up' | 'down' | 'flat'; change: number; color: string; }

@Component({
  selector: 'app-global-command-center',
  templateUrl: './global-command-center.component.html',
  styleUrls: ['./global-command-center.component.scss'],
  standalone: false,
})
export class GlobalCommandCenterComponent implements OnInit, OnDestroy {

  private subs: Subscription[] = [];
  loading = true;
  loadError: string | null = null;
  lastUpdated = '';

  tickerEvents: TickerEvent[] = [];
  incidents: NormalizedIncident[] = [];
  selectedIncident: NormalizedIncident | null = null;
  kpiCards: KpiCard[] = [];
  adjusterRows: AdjusterMetric[] = [];
  adjLeadsToday = 0; adjCallsCompleted = 0; adjIntakes = 0; adjSigned = 0; adjConvRate = 0;
  totalClaimsOpen = 0; totalRecoveryValue = 0; carrierTotal = 0; aciTotal = 0; recoveryGap = 0;
  recoveryBarData: any[] = [];
  colorScheme = { domain: ['#ff6d00', '#00e5ff'] };
  activityFeed: PlatformActivityEvent[] = [];

  // Claim Recovery Dashboard
  recoveryClaims: ClaimRecoveryRecord[] = [];
  recoverySortField: keyof ClaimRecoveryRecord = 'totalRecoveryAboveCarrier';
  recoverySortDir: 'asc' | 'desc' = 'desc';
  recoveryStatusMeta = RECOVERY_STATUS_META;

  // High Probability Claims
  highProbClaims: PotentialClaimRow[] = [];
  oppMinScore = 60;
  oppLoading = false;
  private oppPollSub: Subscription | null = null;

  // Claim Opportunity Intelligence
  opportunities: ClaimOpportunity[] = [];
  opportunityMetrics: OpportunityMetrics | null = null;
  priorityMeta = PRIORITY_META;
  actionMeta = ACTION_META;
  showAllOpportunities = false;
  selectedOpp: ClaimOpportunity | null = null;

  constructor(
    private incidentFeed: IncidentFeedService,
    private platformMetrics: PlatformMetricsService,
    private platformActivity: PlatformActivityService,
    private estimatingService: EstimatingService,
    private recoveryEngine: ClaimRecoveryEngineService,
    private claimOpportunity: ClaimOpportunityEngineService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void {
    console.log('[GlobalCC] ngOnInit → starting services');
    this.incidentFeed.startPolling(30000);
    this.platformMetrics.startPolling(30000);
    this.platformActivity.startPolling(10000);

    // Safety timeout: force loading=false after 12s to prevent endless spinner
    setTimeout(() => {
      if (this.loading) {
        console.warn('[GlobalCC] loading timeout — forcing ready state');
        this.loading = false;
        this.loadError = 'Data services are slow to respond. Some panels may show partial data.';
      }
    }, 12000);

    this.subs.push(this.incidentFeed.getIncidents().subscribe(incidents => {
      this.incidents = incidents;
      this.tickerEvents = this.buildTicker(incidents);
      this.lastUpdated = new Date().toLocaleTimeString();
      this.loading = false;
      this.loadError = null;
    }));

    this.subs.push(this.platformMetrics.getMetrics().subscribe(m => {
      this.kpiCards = this.buildKpiCards(m);
    }));

    this.subs.push(this.platformMetrics.getAdjusters().subscribe(adj => {
      this.adjusterRows = adj;
      this.adjLeadsToday = adj.reduce((s, a) => s + a.leads_assigned, 0);
      this.adjCallsCompleted = adj.reduce((s, a) => s + a.calls_completed, 0);
      this.adjIntakes = adj.reduce((s, a) => s + a.intakes_completed, 0);
      this.adjSigned = adj.reduce((s, a) => s + a.claims_signed, 0);
      this.adjConvRate = this.adjLeadsToday > 0 ? Math.round((this.adjSigned / this.adjLeadsToday) * 100) : 0;
    }));

    this.subs.push(this.platformActivity.getEvents().subscribe(events => {
      this.activityFeed = events;
    }));

    this.loadRecovery();
    this.loadHighProbClaims();
    this.oppPollSub = interval(30000).subscribe(() => this.loadHighProbClaims());

    // Claim Opportunity Intelligence
    this.claimOpportunity.startPolling(60000);
    this.subs.push(
      this.claimOpportunity.getOpportunities().subscribe(opps => {
        this.opportunities = opps;
        this.opportunityMetrics = this.claimOpportunity.computeMetrics(opps);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.oppPollSub?.unsubscribe();
    this.incidentFeed.stopPolling();
    this.platformMetrics.stopPolling();
    this.platformActivity.stopPolling();
    this.claimOpportunity.stopPolling();
  }

  private loadRecovery(): void {
    this.estimatingService.getClaimRecoveryDashboard().subscribe({
      next: (data: any) => {
        if (data) {
          const e = this.recoveryEngine.enrichDashboardData(data);
          this.totalClaimsOpen = e.totalClaimsActive; this.totalRecoveryValue = e.totalRecovered;
          this.carrierTotal = e.totalCarrierEstimates; this.aciTotal = e.totalAciEstimates;
          this.recoveryClaims = e.claims;
        } else { this.setMockRecovery(); }
        this.recoveryGap = Math.max(this.aciTotal - this.carrierTotal, 0);
        this.recoveryBarData = [{ name: 'Carrier Estimate', value: this.carrierTotal }, { name: 'ACI Estimate', value: this.aciTotal }];
        this.sortRecoveryClaims();
      },
      error: () => { this.setMockRecovery(); this.recoveryBarData = [{ name: 'Carrier Estimate', value: 1890000 }, { name: 'ACI Estimate', value: 3240000 }]; this.sortRecoveryClaims(); },
    });
  }

  private setMockRecovery(): void {
    this.totalClaimsOpen = 34; this.totalRecoveryValue = 2840000; this.carrierTotal = 1890000; this.aciTotal = 3240000; this.recoveryGap = 1350000;
    this.recoveryClaims = this.getMockRecoveryClaims();
  }

  private getMockRecoveryClaims(): ClaimRecoveryRecord[] {
    return [
      { claimId: 'c1', projectId: 'p1', claimNumber: 'CLM-2025-0102', clientName: 'Robert Chen', carrierName: 'State Farm', assignedAdjusterId: 'a1', assignedAdjusterName: 'Mike Torres', carrierEstimateTotal: 42300, aciEstimateTotal: 68500, supplementRequestedTotal: 26200, supplementRecoveredTotal: 18400, carrierPaidTotal: 60700, totalRecoveryAboveCarrier: 18400, remainingRecoverable: 7800, recoveryPercent: 88.6, recoveryStatus: 'partial_payment', claimPhase: 'supplement_requested', createdAt: '2025-01-15T10:00:00Z', lastPaymentDate: '2025-03-01T14:00:00Z' },
      { claimId: 'c2', projectId: 'p2', claimNumber: 'CLM-2025-0118', clientName: 'Maria Gonzalez', carrierName: 'Allstate', assignedAdjusterId: 'a2', assignedAdjusterName: 'Sarah Kim', carrierEstimateTotal: 28900, aciEstimateTotal: 52400, supplementRequestedTotal: 23500, supplementRecoveredTotal: 0, carrierPaidTotal: 28900, totalRecoveryAboveCarrier: 0, remainingRecoverable: 23500, recoveryPercent: 55.2, recoveryStatus: 'supplement_requested', claimPhase: 'supplement_requested', createdAt: '2025-01-22T08:00:00Z', lastPaymentDate: null },
      { claimId: 'c3', projectId: 'p3', claimNumber: 'CLM-2025-0134', clientName: 'David Thompson', carrierName: 'USAA', assignedAdjusterId: 'a1', assignedAdjusterName: 'Mike Torres', carrierEstimateTotal: 85200, aciEstimateTotal: 124800, supplementRequestedTotal: 39600, supplementRecoveredTotal: 39600, carrierPaidTotal: 124800, totalRecoveryAboveCarrier: 39600, remainingRecoverable: 0, recoveryPercent: 100, recoveryStatus: 'fully_recovered', claimPhase: 'closed', createdAt: '2025-02-01T09:30:00Z', lastPaymentDate: '2025-03-10T11:00:00Z' },
      { claimId: 'c4', projectId: 'p4', claimNumber: 'CLM-2025-0147', clientName: 'Jennifer Adams', carrierName: 'Nationwide', assignedAdjusterId: 'a3', assignedAdjusterName: 'James Rivera', carrierEstimateTotal: 15600, aciEstimateTotal: 31200, supplementRequestedTotal: 15600, supplementRecoveredTotal: 8200, carrierPaidTotal: 23800, totalRecoveryAboveCarrier: 8200, remainingRecoverable: 7400, recoveryPercent: 76.3, recoveryStatus: 'negotiation', claimPhase: 'negotiation', createdAt: '2025-02-10T14:00:00Z', lastPaymentDate: '2025-03-05T16:00:00Z' },
      { claimId: 'c5', projectId: 'p5', claimNumber: 'CLM-2025-0156', clientName: 'Patricia Williams', carrierName: 'Progressive', assignedAdjusterId: 'a2', assignedAdjusterName: 'Sarah Kim', carrierEstimateTotal: 62400, aciEstimateTotal: 89600, supplementRequestedTotal: 27200, supplementRecoveredTotal: 27200, carrierPaidTotal: 89600, totalRecoveryAboveCarrier: 27200, remainingRecoverable: 0, recoveryPercent: 100, recoveryStatus: 'fully_recovered', claimPhase: 'closed', createdAt: '2025-02-15T11:30:00Z', lastPaymentDate: '2025-03-12T09:00:00Z' },
      { claimId: 'c6', projectId: 'p6', claimNumber: 'CLM-2025-0163', clientName: 'William Brown', carrierName: 'Farmers', assignedAdjusterId: 'a3', assignedAdjusterName: 'James Rivera', carrierEstimateTotal: 34800, aciEstimateTotal: 58900, supplementRequestedTotal: 24100, supplementRecoveredTotal: 0, carrierPaidTotal: 34800, totalRecoveryAboveCarrier: 0, remainingRecoverable: 24100, recoveryPercent: 59.1, recoveryStatus: 'carrier_review', claimPhase: 'carrier_review', createdAt: '2025-02-20T10:00:00Z', lastPaymentDate: null },
      { claimId: 'c7', projectId: 'p7', claimNumber: 'CLM-2025-0178', clientName: 'Amanda Rodriguez', carrierName: 'Liberty Mutual', assignedAdjusterId: 'a1', assignedAdjusterName: 'Mike Torres', carrierEstimateTotal: 21500, aciEstimateTotal: 45200, supplementRequestedTotal: 23700, supplementRecoveredTotal: 12800, carrierPaidTotal: 34300, totalRecoveryAboveCarrier: 12800, remainingRecoverable: 10900, recoveryPercent: 75.9, recoveryStatus: 'partial_payment', claimPhase: 'supplement_requested', createdAt: '2025-02-28T13:00:00Z', lastPaymentDate: '2025-03-14T15:00:00Z' },
      { claimId: 'c8', projectId: 'p8', claimNumber: 'CLM-2025-0189', clientName: 'Thomas Wright', carrierName: 'Travelers', assignedAdjusterId: 'a2', assignedAdjusterName: 'Sarah Kim', carrierEstimateTotal: 48700, aciEstimateTotal: 72100, supplementRequestedTotal: 23400, supplementRecoveredTotal: 0, carrierPaidTotal: 0, totalRecoveryAboveCarrier: 0, remainingRecoverable: 72100, recoveryPercent: 0, recoveryStatus: 'estimating', claimPhase: 'estimating', createdAt: '2025-03-05T08:00:00Z', lastPaymentDate: null },
    ];
  }

  private buildTicker(incidents: NormalizedIncident[]): TickerEvent[] {
    const em: Record<string, string> = { fire: '🔥', hail: '🧊', wind: '🌪', lightning: '⚡', crime: '🚓', tornado: '🌪', hurricane: '🌀' };
    const lb: Record<string, string> = { fire: 'Structure Fire', hail: 'Hail Impact', wind: 'Wind Damage', lightning: 'Lightning Strike', crime: 'Break-in / Vandalism', tornado: 'Tornado', hurricane: 'Hurricane' };
    return incidents.slice(0, 20).map(i => ({
      emoji: em[i.type] || '⚠️',
      text: `${lb[i.type] || i.type} – ${i.city || ''} ${i.state || ''} – ${this.timeAgo(i.timestamp)}`,
    }));
  }

  private buildKpiCards(m: PlatformMetrics): KpiCard[] {
    return [
      { label: 'Property Fires Today', value: m.fires_today, icon: 'local_fire_department', trend: 'up', change: 3, color: '#ff1744' },
      { label: 'Storm Damage Events', value: m.storm_events_today, icon: 'thunderstorm', trend: 'up', change: 5, color: '#2979ff' },
      { label: 'Potential Claims', value: m.potential_claims, icon: 'bolt', trend: 'up', change: 8, color: '#ffd600' },
      { label: 'New Leads Generated', value: m.new_leads_today, icon: 'person_add', trend: 'up', change: 12, color: '#00e676' },
      { label: 'Leads Contacted', value: m.leads_contacted, icon: 'phone_in_talk', trend: 'up', change: 7, color: '#00e5ff' },
      { label: 'Leads Converted', value: m.leads_converted, icon: 'verified', trend: 'up', change: 4, color: '#aa00ff' },
    ];
  }

  selectIncident(m: NormalizedIncident): void { this.selectedIncident = m; }
  closeIncidentPanel(): void { this.selectedIncident = null; }
  getMarkerColor(type: string): string {
    const c: Record<string, string> = { fire: '#ff1744', hail: '#2979ff', wind: '#ff6d00', lightning: '#ffd600', tornado: '#ff1744', hurricane: '#7c4dff', crime: '#aa00ff' };
    return c[type] || '#00e5ff';
  }
  getLeadStatusLabel(s: string): string { return ({ not_contacted: 'Not Contacted', contacted: 'Contacted', converted: 'Converted' } as any)[s] || s; }
  getLeadStatusClass(s: string): string { return s === 'converted' ? 'status-converted' : s === 'contacted' ? 'status-contacted' : 'status-not-contacted'; }
  nav(route: string): void { this.router.navigate([route]); }
  fmtCurrency(v: number): string { return v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'K' : '$' + v.toLocaleString(); }
  timeAgo(ts: string): string { const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`; }

  navigateToEvent(item: PlatformActivityEvent): void {
    const routeMap: Record<string, string> = {
      fire_incident: '/app/fire-incidents',
      lead_created: '/app/leads',
      skip_trace_completed: '/app/leads',
      voice_call: '/app/voice-campaigns',
      claim_opened: '/app/claims',
    };
    const route = routeMap[item.event_type];
    if (route) { this.router.navigate([route]); }
  }

  // ── High Probability Claims ────────────────────────────────────
  loadHighProbClaims(): void {
    this.oppLoading = true;
    this.claimOpportunity.getHighProbabilityClaims(this.oppMinScore).subscribe({
      next: (claims) => { this.highProbClaims = claims; this.oppLoading = false; },
      error: () => { this.oppLoading = false; },
    });
  }

  onOppScoreChange(value: any): void {
    this.oppMinScore = +value;
    this.loadHighProbClaims();
  }

  generateLead(claimId: string): void {
    this.claimOpportunity.generateLead(claimId).subscribe({
      next: (res) => {
        this.highProbClaims = this.highProbClaims.filter(c => c.id !== claimId);
        this.snackBar.open(
          `Lead created — ${res.assigned_agents_count} agent(s) assigned in ${res.territory_name}`,
          'OK', { duration: 4000 }
        );
      },
      error: () => { this.snackBar.open('Failed to generate lead', 'OK', { duration: 3000 }); },
    });
  }

  dismissClaim(claimId: string): void {
    this.claimOpportunity.dismissClaim(claimId).subscribe({
      next: () => { this.highProbClaims = this.highProbClaims.filter(c => c.id !== claimId); },
      error: () => { this.snackBar.open('Failed to dismiss claim', 'OK', { duration: 3000 }); },
    });
  }

  getImpactColor(level: string): string {
    const m: Record<string, string> = { critical: '#ff1744', high: '#ff6d00', moderate: '#ffd600', low: '#00e5ff' };
    return m[level] || '#64748b';
  }

  getScoreBadgeClass(score: number): string {
    if (score >= 80) return 'score-critical';
    if (score >= 60) return 'score-high';
    if (score >= 40) return 'score-moderate';
    return 'score-low';
  }

  // ── Claim Opportunity Intelligence helpers ────────────────────
  getPriorityColor(priority: string): string {
    return (PRIORITY_META as any)[priority]?.color || '#64748b';
  }

  getPriorityIcon(priority: string): string {
    return (PRIORITY_META as any)[priority]?.icon || 'info';
  }

  getEventIcon(type: string): string {
    const icons: Record<string, string> = {
      fire: 'local_fire_department', hail: 'ac_unit', wind: 'air',
      lightning: 'bolt', tornado: 'tornado', hurricane: 'cyclone',
      crime: 'gavel', roof: 'roofing',
    };
    return icons[type] || 'warning';
  }

  getDisplayedOpportunities(): ClaimOpportunity[] {
    return this.showAllOpportunities ? this.opportunities : this.opportunities.slice(0, 5);
  }

  toggleOpportunityView(): void {
    this.showAllOpportunities = !this.showAllOpportunities;
  }

  getFactorBars(opp: ClaimOpportunity) {
    if (!opp.scoring_factors) return [];
    return SCORING_FACTOR_META.map(f => ({
      label: f.label,
      color: f.color,
      percent: Math.round((opp.scoring_factors as any)[f.key] * 100),
      weight: (DEFAULT_SCORING_WEIGHTS as any)[
        f.key === 'insurance_likelihood' ? 'insurance_probability'
        : f.key === 'claim_size_estimate' ? 'claim_size'
        : f.key
      ],
    }));
  }

  toggleScoreBreakdown(opp: ClaimOpportunity): void {
    this.selectedOpp = this.selectedOpp?.id === opp.id ? null : opp;
  }

  // ── Claim Recovery Dashboard helpers ──────────────────────────────
  sortRecoveryClaims(): void {
    this.recoveryClaims = [...this.recoveryClaims].sort((a, b) => {
      const aVal = a[this.recoverySortField];
      const bVal = b[this.recoverySortField];
      const aNum = typeof aVal === 'number' ? aVal : String(aVal || '').toLowerCase();
      const bNum = typeof bVal === 'number' ? bVal : String(bVal || '').toLowerCase();
      const cmp = aNum < bNum ? -1 : aNum > bNum ? 1 : 0;
      return this.recoverySortDir === 'asc' ? cmp : -cmp;
    });
  }

  onRecoverySort(field: keyof ClaimRecoveryRecord): void {
    if (this.recoverySortField === field) {
      this.recoverySortDir = this.recoverySortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.recoverySortField = field;
      this.recoverySortDir = 'desc';
    }
    this.sortRecoveryClaims();
  }

  getRecoverySortIcon(field: keyof ClaimRecoveryRecord): string {
    if (this.recoverySortField !== field) return 'unfold_more';
    return this.recoverySortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  getRecoveryStatusColor(status: RecoveryStatus): string {
    return RECOVERY_STATUS_META[status]?.color || '#9e9e9e';
  }

  getRecoveryStatusLabel(status: RecoveryStatus): string {
    return RECOVERY_STATUS_META[status]?.label || status;
  }

  getRecoveryStatusIcon(status: RecoveryStatus): string {
    return RECOVERY_STATUS_META[status]?.icon || 'info';
  }

  // ── Real-Time Activity Feed helpers ─────────────────────────────
  getActivityColor(eventType: string): string {
    const map: Record<string, string> = {
      fire_incident: '#ff1744',
      storm_incident: '#2979ff',
      crime_incident: '#aa00ff',
      lead_created: '#00e676',
      skip_trace_completed: '#00e5ff',
      voice_call: '#00e676',
      claim_opened: '#ff6d00',
      new_lead: '#00e676',
      claim_created: '#ff6d00',
      supplement_sent: '#ff6d00',
      payment_recorded: '#00e676',
      ai_call_completed: '#00e676',
      document_uploaded: '#2979ff',
    };
    return map[eventType] || '#64748b';
  }

  getActivityIcon(eventType: string): string {
    const map: Record<string, string> = {
      fire_incident: 'local_fire_department',
      storm_incident: 'thunderstorm',
      crime_incident: 'gavel',
      lead_created: 'person_add',
      skip_trace_completed: 'search',
      voice_call: 'phone_in_talk',
      claim_opened: 'assignment',
      new_lead: 'person_add',
      claim_created: 'assignment',
      supplement_sent: 'send',
      payment_recorded: 'payments',
      ai_call_completed: 'phone_in_talk',
      document_uploaded: 'upload_file',
    };
    return map[eventType] || 'notifications';
  }

  getActivityLabel(eventType: string): string {
    const map: Record<string, string> = {
      fire_incident: 'Fire Incident',
      storm_incident: 'Storm Event',
      crime_incident: 'Crime Report',
      lead_created: 'Lead Created',
      skip_trace_completed: 'Skip Trace',
      voice_call: 'Voice Call',
      claim_opened: 'Claim Opened',
      new_lead: 'Lead Created',
      claim_created: 'Claim Opened',
      supplement_sent: 'Supplement',
      payment_recorded: 'Payment',
      ai_call_completed: 'Voice Call',
      document_uploaded: 'Document',
    };
    return map[eventType] || eventType;
  }
}
