import { Component, OnInit } from '@angular/core';
import { EstimatingService } from 'src/app/services/estimating.service';
import { DashboardService } from 'src/app/services/dashboard.service';
import { ClaimRecoveryEngineService } from 'src/app/shared/services/claim-recovery-engine.service';
import { ClaimRecoveryRecord } from 'src/app/shared/models/claim-recovery-metrics.model';

type TrendView = 'daily' | 'weekly' | 'monthly';

interface AdjusterRevenue {
  name: string;
  clientsSigned: number;
  estimatedClaimValue: number;
  feeRevenue: number;
  avgClaimSize: number;
}

interface PipelineStage {
  label: string;
  count: number;
  value: number;
  color: string;
  icon: string;
}

interface TerritoryRevenue {
  territory: string;
  claims: number;
  estimatedValue: number;
  feeRevenue: number;
}

@Component({
  selector: 'app-revenue-intelligence',
  templateUrl: './revenue-intelligence.component.html',
  styleUrls: ['./revenue-intelligence.component.scss'],
  standalone: false,
})
export class RevenueIntelligenceComponent implements OnInit {

  loading = true;
  claims: ClaimRecoveryRecord[] = [];
  trendView: TrendView = 'monthly';
  stateFilter = '';
  cityFilter = '';

  adjusterRevenue: AdjusterRevenue[] = [];
  pipeline: PipelineStage[] = [];
  trendData: any[] = [];
  territoryRevenue: TerritoryRevenue[] = [];
  pipelineChartData: any[] = [];

  signedToday = 0;
  signedThisMonth = 0;
  totalActiveClaims = 0;
  conversionRate = 0;

  colorScheme = { domain: ['#1565c0'] };
  pipelineColorScheme = { domain: ['#2196f3', '#ff9800', '#4caf50', '#7b1fa2', '#1565c0'] };

  constructor(
    private estimatingService: EstimatingService,
    private dashboardService: DashboardService,
    private recoveryEngine: ClaimRecoveryEngineService,
  ) {}

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading = true;
    this.estimatingService.getClaimRecoveryDashboard().subscribe({
      next: (data: any) => {
        const metrics = this.recoveryEngine.enrichDashboardData(data);
        this.claims = metrics.claims.length > 0 ? metrics.claims : this.getMockClaims();
        this.compute();
        this.loading = false;
      },
      error: () => {
        this.claims = this.getMockClaims();
        this.compute();
        this.loading = false;
      },
    });

    this.dashboardService.getClientConversionStats().subscribe({
      next: (stats: any) => {
        this.signedToday = stats.signed_today || 0;
        this.signedThisMonth = stats.signed_this_month || 0;
        this.totalActiveClaims = stats.total_active_claims || 0;
        this.conversionRate = stats.conversion_rate || 0;
      },
      error: () => {},
    });
  }

  onFilterChange(): void { this.compute(); }

  private compute(): void {
    let filtered = [...this.claims];
    if (this.stateFilter) filtered = filtered.filter(c => (c.carrierName + c.claimNumber).toUpperCase().includes(this.stateFilter.toUpperCase()));
    if (this.cityFilter) filtered = filtered.filter(c => c.clientName.toLowerCase().includes(this.cityFilter.toLowerCase()));

    this.adjusterRevenue = this.computeAdjusterRevenue(filtered);
    this.pipeline = this.computePipeline(filtered);
    this.trendData = this.computeTrend(filtered);
    this.territoryRevenue = this.computeTerritoryRevenue(filtered);
    this.pipelineChartData = this.pipeline.map(p => ({ name: p.label, value: p.value }));
  }

  // ── KPIs ──

  get totalSigned(): number { return this.claims.length; }
  get estimatedClaimValue(): number { return this.claims.reduce((s, c) => s + c.aciEstimateTotal, 0); }
  get totalFees(): number { return Math.round(this.estimatedClaimValue * 0.10); }
  get avgClaimSize(): number { return this.claims.length > 0 ? this.estimatedClaimValue / this.claims.length : 0; }

  // ── Adjuster Revenue ──

  private computeAdjusterRevenue(data: ClaimRecoveryRecord[]): AdjusterRevenue[] {
    const byAdj = new Map<string, ClaimRecoveryRecord[]>();
    for (const c of data) {
      const name = c.assignedAdjusterName || 'Unassigned';
      if (!byAdj.has(name)) byAdj.set(name, []);
      byAdj.get(name)!.push(c);
    }
    return Array.from(byAdj.entries()).map(([name, items]) => {
      const total = items.reduce((s, c) => s + c.aciEstimateTotal, 0);
      return {
        name,
        clientsSigned: items.length,
        estimatedClaimValue: total,
        feeRevenue: Math.round(total * 0.10),
        avgClaimSize: items.length > 0 ? total / items.length : 0,
      };
    }).sort((a, b) => b.feeRevenue - a.feeRevenue);
  }

  // ── Pipeline ──

  private computePipeline(data: ClaimRecoveryRecord[]): PipelineStage[] {
    const stages: { key: string; label: string; color: string; icon: string; statuses: string[] }[] = [
      { key: 'new', label: 'New Leads', color: '#2196f3', icon: 'person_add', statuses: ['estimating'] },
      { key: 'inspection', label: 'Inspections Scheduled', color: '#ff9800', icon: 'search', statuses: ['carrier_review'] },
      { key: 'signed', label: 'Clients Signed', color: '#4caf50', icon: 'draw', statuses: ['supplement_requested'] },
      { key: 'negotiation', label: 'In Negotiation', color: '#7b1fa2', icon: 'handshake', statuses: ['negotiation'] },
      { key: 'paid', label: 'Claims Paid', color: '#1565c0', icon: 'payments', statuses: ['partial_payment', 'fully_recovered'] },
    ];
    return stages.map(s => {
      const matching = data.filter(c => s.statuses.includes(c.recoveryStatus));
      return {
        label: s.label,
        count: matching.length,
        value: matching.reduce((sum, c) => sum + c.aciEstimateTotal, 0),
        color: s.color,
        icon: s.icon,
      };
    });
  }

  // ── Trend ──

  private computeTrend(data: ClaimRecoveryRecord[]): any[] {
    const buckets = new Map<string, number>();
    for (const c of data) {
      if (!c.createdAt) continue;
      let key: string;
      if (this.trendView === 'daily') key = c.createdAt.substring(0, 10);
      else if (this.trendView === 'weekly') {
        const d = new Date(c.createdAt);
        d.setDate(d.getDate() - d.getDay());
        key = d.toISOString().split('T')[0];
      } else {
        key = c.createdAt.substring(0, 7);
      }
      const fee = Math.round(c.aciEstimateTotal * 0.10);
      buckets.set(key, (buckets.get(key) || 0) + fee);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value }));
  }

  // ── Territory Revenue ──

  private computeTerritoryRevenue(data: ClaimRecoveryRecord[]): TerritoryRevenue[] {
    const byTerritory = new Map<string, ClaimRecoveryRecord[]>();
    for (const c of data) {
      const territory = c.carrierName || 'Unknown';
      if (!byTerritory.has(territory)) byTerritory.set(territory, []);
      byTerritory.get(territory)!.push(c);
    }
    return Array.from(byTerritory.entries()).map(([territory, items]) => {
      const total = items.reduce((s, c) => s + c.aciEstimateTotal, 0);
      return {
        territory,
        claims: items.length,
        estimatedValue: total,
        feeRevenue: Math.round(total * 0.10),
      };
    }).sort((a, b) => b.feeRevenue - a.feeRevenue);
  }

  fmtCurrency(val: number): string {
    if (val == null) return '$0';
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // ── Mock ──

  private getMockClaims(): ClaimRecoveryRecord[] {
    const d = (offset: number) => { const x = new Date(); x.setDate(x.getDate() + offset); return x.toISOString(); };
    const adj = ['Marcus Rivera', 'Angela Watts', 'Tyler Jackson'];
    const carriers = ['State Farm', 'Allstate', 'USAA', 'Progressive', 'Farmers', 'Liberty Mutual', 'Travelers', 'Nationwide'];
    const statuses = ['estimating', 'carrier_review', 'supplement_requested', 'negotiation', 'partial_payment', 'fully_recovered'];
    const names = ['Robert Chen', 'Maria Gonzalez', 'James Parker', 'Patricia Williams', 'David Thompson',
      'Jennifer Adams', 'Michael Foster', 'Sarah Mitchell', 'William Brown', 'Amanda Rodriguez',
      'Christopher Lee', 'Jessica Taylor', 'Thomas Anderson', 'Lisa Martinez', 'Daniel Harris',
      'Emily Wilson', 'Kevin Moore', 'Rachel Clark', 'Andrew Hall', 'Michelle Young'];
    const result: ClaimRecoveryRecord[] = [];
    for (let i = 0; i < 20; i++) {
      const aci = 15000 + Math.round(Math.random() * 110000);
      const carrier = Math.round(aci * (0.5 + Math.random() * 0.4));
      const paid = Math.random() > 0.4 ? Math.round(carrier * (0.3 + Math.random() * 0.7)) : 0;
      result.push({
        claimId: `c-${i}`, projectId: `p-${i}`, claimNumber: `CLM-2025-${(100 + i).toString()}`,
        clientName: names[i], carrierName: carriers[i % carriers.length],
        assignedAdjusterId: `adj-${i % 3}`, assignedAdjusterName: adj[i % 3],
        carrierEstimateTotal: carrier, aciEstimateTotal: aci,
        supplementRequestedTotal: Math.max(aci - carrier, 0),
        supplementRecoveredTotal: paid > carrier ? Math.min(paid - carrier, aci - carrier) : 0,
        carrierPaidTotal: paid, totalRecoveryAboveCarrier: Math.max(paid - carrier, 0),
        remainingRecoverable: Math.max(aci - paid, 0),
        recoveryPercent: aci > 0 ? (paid / aci) * 100 : 0,
        recoveryStatus: statuses[i % statuses.length] as any,
        claimPhase: null, createdAt: d(-Math.floor(Math.random() * 90)), lastPaymentDate: paid > 0 ? d(-Math.floor(Math.random() * 30)) : null,
      });
    }
    return result;
  }
}
