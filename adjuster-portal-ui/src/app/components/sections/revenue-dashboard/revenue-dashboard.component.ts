import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, interval } from 'rxjs';

interface Kpi { label: string; value: string; icon: string; color: string; trend?: string; }
interface RevenueKpi { label: string; value: string; color: string; }
interface FunnelStep { label: string; count: number; pct: number; dropOff: number; color: string; }
interface AgentRow { name: string; leads: number; calls: number; appointments: number; sent: number; signed: number; rate: number; }
interface SourceRow { source: string; icon: string; color: string; count: number; converted: number; rate: number; }
interface ActivityItem { icon: string; color: string; text: string; time: string; }

@Component({
  selector: 'app-revenue-dashboard',
  templateUrl: './revenue-dashboard.component.html',
  styleUrls: ['./revenue-dashboard.component.scss'],
  standalone: false,
})
export class RevenueDashboardComponent implements OnInit, OnDestroy {

  timeFilter = '30d';
  lastUpdated = '';

  kpis: Kpi[] = [];
  revenueKpis: RevenueKpi[] = [];
  funnel: FunnelStep[] = [];
  agents: AgentRow[] = [];
  sources: SourceRow[] = [];
  activities: ActivityItem[] = [];

  // Nullable until a real backend endpoint exists. Distinguishes
  // "not loaded yet" from "loaded with zero values".
  voiceMetrics: { answered: number; connectionRate: number; bookingsFromCalls: number; aiPerformance: number; manualPerformance: number; } | null = null;
  certifiedMetrics: { certifiedPct: number; certifiedCompletion: number; standardCompletion: number; } | null = null;

  private pollSub: Subscription | null = null;

  ngOnInit(): void {
    this.loadData();
    this.pollSub = interval(30000).subscribe(() => this.loadData());
  }

  ngOnDestroy(): void { this.pollSub?.unsubscribe(); }

  setTimeFilter(f: string): void {
    this.timeFilter = f;
    this.loadData();
  }

  private loadData(): void {
    this.lastUpdated = new Date().toLocaleTimeString();
    // Real backend endpoints not yet wired. Every section deliberately
    // holds empty/null so honest empty-state UI renders — no fabricated
    // revenue, agents, sources, voice, certified, or activity data.
  }

  get funnelMaxCount(): number {
    return this.funnel[0]?.count || 1;
  }

  get hasAnyData(): boolean {
    return this.kpis.length > 0
      || this.revenueKpis.length > 0
      || this.funnel.length > 0
      || this.agents.length > 0
      || this.sources.length > 0
      || this.activities.length > 0
      || this.voiceMetrics !== null
      || this.certifiedMetrics !== null;
  }
}
