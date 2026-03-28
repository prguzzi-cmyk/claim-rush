import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { ClaimOpportunityEngineService } from 'src/app/shared/services/claim-opportunity-engine.service';
import { LeadIntelligenceService } from 'src/app/shared/services/lead-intelligence.service';
import {
  ClaimOpportunity,
  OpportunityMetrics,
  PRIORITY_META,
  ACTION_META,
  OpportunityPriority,
  SCORING_FACTOR_META,
  DEFAULT_SCORING_WEIGHTS,
} from 'src/app/shared/models/claim-opportunity.model';

@Component({
  selector: 'app-claim-opportunity-dashboard',
  templateUrl: './claim-opportunity-dashboard.component.html',
  styleUrls: ['./claim-opportunity-dashboard.component.scss'],
  standalone: false,
})
export class ClaimOpportunityDashboardComponent implements OnInit, OnDestroy {
  allOpportunities: ClaimOpportunity[] = [];
  filteredOpportunities: ClaimOpportunity[] = [];

  metrics: OpportunityMetrics = {
    total: 0, critical: 0, high: 0, medium: 0, low: 0,
    totalEstimatedValue: 0, avgScore: 0, topStates: [],
    actionBreakdown: { assign_agent: 0, outreach: 0, monitor: 0 },
  };
  priorityMeta = PRIORITY_META;
  actionMeta = ACTION_META;
  selectedOpp: ClaimOpportunity | null = null;

  minScore = 0;
  eventTypeFilter = '';
  loading = false;
  loadError: string | null = null;
  lastUpdated: Date | null = null;

  private oppSub: Subscription;

  constructor(
    private engine: ClaimOpportunityEngineService,
    private leadIntel: LeadIntelligenceService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.engine.startPolling(60000);
    this.oppSub = this.engine.getOpportunities().subscribe(opps => {
      this.allOpportunities = opps;
      this.applyFilters();
      this.loading = false;

      if (opps.length > 0) {
        this.lastUpdated = new Date();
        this.loadError = null;
      } else if (!this.lastUpdated) {
        // First load returned empty — still waiting for sources
        this.loadError = 'Loading opportunity data...';
      }

      console.log('[OppDash] updated:', opps.length, 'opps →', this.filteredOpportunities.length, 'filtered');
    });
  }

  ngOnDestroy(): void {
    this.engine.stopPolling();
    this.oppSub?.unsubscribe();
  }

  applyFilters(): void {
    let result = this.allOpportunities;
    if (this.minScore > 0) {
      result = result.filter(o => o.opportunity_score >= this.minScore);
    }
    if (this.eventTypeFilter) {
      result = result.filter(o => o.event_type === this.eventTypeFilter);
    }
    // Create new array reference so mat-table detects the change
    this.filteredOpportunities = [...result];
    this.metrics = this.engine.computeMetrics(this.filteredOpportunities);
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  onMinScoreChange(): void {
    this.applyFilters();
  }

  refresh(): void {
    this.loading = true;
    this.engine.refresh();
  }

  generateLead(id: string): void {
    this.engine.generateLead(id).subscribe({
      next: (result) => {
        this.snackBar.open(
          `Lead created — ${result.assigned_agents_count} agent(s) in ${result.territory_name}`,
          'OK', { duration: 4000 },
        );
        this.engine.refresh();
      },
      error: () => {
        this.snackBar.open('Failed to generate lead', 'Dismiss', { duration: 3000 });
      },
    });
  }

  assignAgent(opp: ClaimOpportunity): void {
    // Prevent duplicate lead creation for the same opportunity
    if (this.leadIntel.hasLeadForOpportunity(opp.id)) {
      this.snackBar.open('Lead already exists for this opportunity', 'OK', { duration: 3000 });
      opp.lead_status = 'assigned';
      opp.recommended_action = 'monitor';
      this.filteredOpportunities = [...this.filteredOpportunities];
      return;
    }

    this.snackBar.open('Assigning agent...', '', { duration: 1500 });
    this.engine.assignAgent(opp).subscribe({
      next: (result) => {
        const channels = result.outreach
          .filter(o => o.dispatched)
          .map(o => o.channel)
          .join(', ') || 'none';
        this.snackBar.open(
          `Assigned to ${result.assigned_agent_name} (${result.territory_name}) — ` +
          `Perf: ${result.agent_performance_score.toFixed(0)} | ` +
          `Outreach: ${channels}`,
          'OK', { duration: 6000 },
        );
        // Push lead to Lead Intelligence with full data
        this.leadIntel.addLead({
          id: result.lead_id,
          opportunityId: opp.id,
          incidentType: opp.event_type,
          address: opp.address,
          city: opp.city,
          state: opp.state,
          dateDetected: new Date().toISOString().slice(0, 10),
          leadStatus: 'new',
          assignedAgent: result.assigned_agent_name,
          assignedAgentId: result.assigned_agent_id,
          estimatedValue: opp.estimated_claim_value,
          opportunityScore: opp.opportunity_score,
          damageProbability: opp.damage_probability,
          source: opp.source,
          territoryName: result.territory_name,
          assignmentReason: result.assignment_reason,
        });

        // Update in-place then force table re-render
        opp.lead_status = 'assigned';
        opp.recommended_action = 'monitor';
        this.filteredOpportunities = [...this.filteredOpportunities];
      },
      error: (err) => {
        const detail = err?.error?.detail || 'Assignment failed';
        this.snackBar.open(detail, 'Dismiss', { duration: 4000 });
      },
    });
  }

  dismissClaim(id: string): void {
    this.engine.dismissClaim(id).subscribe({
      next: () => {
        this.allOpportunities = this.allOpportunities.filter(o => o.id !== id);
        this.applyFilters();
        this.snackBar.open('Claim dismissed', 'OK', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Failed to dismiss claim', 'Dismiss', { duration: 3000 });
      },
    });
  }

  getScoreBadgeClass(score: number): string {
    if (score >= 80) return 'score-critical';
    if (score >= 60) return 'score-high';
    if (score >= 40) return 'score-medium';
    return 'score-low';
  }

  getImpactColor(impact: string): string {
    switch (impact) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'moderate': return '#ca8a04';
      case 'low': return '#64748b';
      default: return '#64748b';
    }
  }

  getPriorityColor(priority: OpportunityPriority): string {
    return this.priorityMeta[priority]?.color ?? '#64748b';
  }

  getPriorityIcon(priority: OpportunityPriority): string {
    return this.priorityMeta[priority]?.icon ?? 'info';
  }

  fmtCurrency(value: number): string {
    if (value == null || isNaN(value)) return '$0';
    return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  timeAgo(ts: string): string {
    if (!ts) return '';
    const time = new Date(ts).getTime();
    if (isNaN(time)) return '';
    const diff = Date.now() - time;
    if (diff < 0) return 'just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  get uniqueEventTypes(): string[] {
    const types = new Set(this.allOpportunities.map(o => o.event_type));
    return Array.from(types).sort();
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
}
