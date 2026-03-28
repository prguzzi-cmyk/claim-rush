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

  // Voice + AI
  voiceMetrics = { answered: 0, connectionRate: 0, bookingsFromCalls: 0, aiPerformance: 0, manualPerformance: 0 };
  // Certified
  certifiedMetrics = { certifiedPct: 0, certifiedCompletion: 0, standardCompletion: 0 };

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
    // Mock data — future: call real backend endpoints
    this.kpis = [
      { label: 'Total Leads', value: '1,247', icon: 'people', color: '#2563eb', trend: '+12%' },
      { label: 'Qualified', value: '843', icon: 'verified', color: '#16a34a', trend: '+8%' },
      { label: 'Appointments', value: '312', icon: 'event', color: '#7c3aed', trend: '+15%' },
      { label: 'Agreements Sent', value: '284', icon: 'send', color: '#d97706', trend: '+11%' },
      { label: 'Signed', value: '198', icon: 'draw', color: '#16a34a', trend: '+22%' },
      { label: 'Conversion', value: '15.9%', icon: 'trending_up', color: '#dc2626', trend: '+2.3pp' },
    ];

    this.revenueKpis = [
      { label: 'Estimated Revenue', value: '$2.84M', color: '#16a34a' },
      { label: 'Avg Claim Value', value: '$28,400', color: '#2563eb' },
      { label: 'Avg Fee', value: '10%', color: '#7c3aed' },
      { label: 'Revenue / Lead', value: '$2,276', color: '#d97706' },
      { label: 'Revenue / Agent', value: '$142K', color: '#dc2626' },
    ];

    this.funnel = [
      { label: 'Leads', count: 1247, pct: 100, dropOff: 0, color: '#2563eb' },
      { label: 'Qualified', count: 843, pct: 67.6, dropOff: 32.4, color: '#7c3aed' },
      { label: 'Scheduled', count: 312, pct: 37.0, dropOff: 63.0, color: '#d97706' },
      { label: 'Signed', count: 198, pct: 23.5, dropOff: 36.5, color: '#16a34a' },
    ];

    this.agents = [
      { name: 'Mike Torres', leads: 142, calls: 98, appointments: 38, sent: 34, signed: 28, rate: 19.7 },
      { name: 'Sarah Kim', leads: 128, calls: 112, appointments: 45, sent: 42, signed: 35, rate: 27.3 },
      { name: 'James Rivera', leads: 136, calls: 89, appointments: 32, sent: 30, signed: 22, rate: 16.2 },
      { name: 'Lisa Park', leads: 118, calls: 76, appointments: 28, sent: 26, signed: 19, rate: 16.1 },
      { name: 'Carlos Mendez', leads: 95, calls: 64, appointments: 22, sent: 20, signed: 14, rate: 14.7 },
    ];

    this.sources = [
      { source: 'Fire', icon: 'local_fire_department', color: '#dc2626', count: 423, converted: 78, rate: 18.4 },
      { source: 'Storm', icon: 'thunderstorm', color: '#2563eb', count: 389, converted: 62, rate: 15.9 },
      { source: 'Client Portal', icon: 'web', color: '#7c3aed', count: 218, converted: 38, rate: 17.4 },
      { source: 'Manual', icon: 'person_add', color: '#d97706', count: 142, converted: 14, rate: 9.9 },
      { source: 'Referral', icon: 'share', color: '#16a34a', count: 75, converted: 6, rate: 8.0 },
    ];

    this.voiceMetrics = { answered: 687, connectionRate: 62.4, bookingsFromCalls: 148, aiPerformance: 71.2, manualPerformance: 54.8 };
    this.certifiedMetrics = { certifiedPct: 18.2, certifiedCompletion: 94.1, standardCompletion: 82.6 };

    const t = (m: number) => {
      if (m < 1) return 'just now';
      if (m < 60) return m + 'm ago';
      return Math.floor(m / 60) + 'h ago';
    };
    this.activities = [
      { icon: 'person_add', color: '#2563eb', text: 'New lead: Thomas Wright — Fire damage, Garland TX', time: t(2) },
      { icon: 'phone', color: '#16a34a', text: 'AI call completed: Patricia Williams — Qualified', time: t(5) },
      { icon: 'event', color: '#7c3aed', text: 'Appointment booked: David Chen — Mar 19 at 10am', time: t(8) },
      { icon: 'draw', color: '#16a34a', text: 'Agreement signed: Maria Gonzalez — Claim Rep Agreement', time: t(12) },
      { icon: 'person_add', color: '#2563eb', text: 'New lead: Amanda Rodriguez — Storm damage, Allen TX', time: t(18) },
      { icon: 'phone', color: '#dc2626', text: 'Call no answer: William Brown — Left voicemail', time: t(22) },
      { icon: 'send', color: '#d97706', text: 'Agreement sent: Jennifer Adams — Property Authorization', time: t(28) },
      { icon: 'event', color: '#7c3aed', text: 'Appointment booked: Kevin Moore — Mar 20 at 2pm', time: t(35) },
    ];
  }

  get funnelMaxCount(): number {
    return this.funnel[0]?.count || 1;
  }
}
