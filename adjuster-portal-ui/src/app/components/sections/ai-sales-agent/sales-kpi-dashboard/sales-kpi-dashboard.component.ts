import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AiSalesAgentService, AiConversation, SalesKpi, LeadStatus, ClaimType } from '../ai-sales-agent.service';

interface AgentStat {
  name: string;
  conversations: number;
  qualified: number;
  appointments: number;
  signed: number;
  conversionRate: number;
}

interface DailyMetric {
  date: string;
  conversations: number;
  qualified: number;
  signed: number;
}

@Component({
  selector: 'app-sales-kpi-dashboard',
  templateUrl: './sales-kpi-dashboard.component.html',
  styleUrls: ['./sales-kpi-dashboard.component.scss'],
  standalone: false,
})
export class SalesKpiDashboardComponent implements OnInit, OnDestroy {
  kpis: SalesKpi | null = null;
  conversations: AiConversation[] = [];
  agentStats: AgentStat[] = [];
  claimTypeBreakdown: { type: string; count: number; percentage: number }[] = [];
  statusBreakdown: { status: string; label: string; count: number; percentage: number }[] = [];
  dailyMetrics: DailyMetric[] = [];
  private subs: Subscription[] = [];

  constructor(private service: AiSalesAgentService) {}

  ngOnInit(): void {
    this.subs.push(
      this.service.getKpis().subscribe(k => this.kpis = k),
      this.service.getConversations().subscribe(c => {
        this.conversations = c;
        this.computeAgentStats();
        this.computeClaimTypeBreakdown();
        this.computeStatusBreakdown();
        this.computeDailyMetrics();
      }),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  private computeAgentStats(): void {
    const agentMap = new Map<string, AiConversation[]>();
    this.conversations.forEach(c => {
      const list = agentMap.get(c.assignedAgent) || [];
      list.push(c);
      agentMap.set(c.assignedAgent, list);
    });

    this.agentStats = Array.from(agentMap.entries()).map(([name, convos]) => {
      const qualified = convos.filter(c => ['qualified', 'appointment_set', 'client_signed'].includes(c.status)).length;
      const signed = convos.filter(c => c.status === 'client_signed').length;
      const appointments = convos.filter(c => c.status === 'appointment_set' || c.status === 'client_signed').length;
      return {
        name,
        conversations: convos.length,
        qualified,
        appointments,
        signed,
        conversionRate: convos.length ? Math.round((signed / convos.length) * 100) : 0,
      };
    }).sort((a, b) => b.signed - a.signed);
  }

  private computeClaimTypeBreakdown(): void {
    const types: ClaimType[] = ['fire', 'water', 'storm', 'vandalism'];
    const total = this.conversations.length || 1;
    this.claimTypeBreakdown = types.map(t => ({
      type: t,
      count: this.conversations.filter(c => c.claimType === t).length,
      percentage: Math.round((this.conversations.filter(c => c.claimType === t).length / total) * 100),
    })).filter(t => t.count > 0);
  }

  private computeStatusBreakdown(): void {
    const statuses: { status: LeadStatus; label: string }[] = [
      { status: 'new_lead', label: 'New Lead' },
      { status: 'contacted', label: 'Contacted' },
      { status: 'qualified', label: 'Qualified' },
      { status: 'appointment_set', label: 'Appt Set' },
      { status: 'client_signed', label: 'Signed' },
    ];
    const total = this.conversations.length || 1;
    this.statusBreakdown = statuses.map(s => ({
      ...s,
      count: this.conversations.filter(c => c.status === s.status).length,
      percentage: Math.round((this.conversations.filter(c => c.status === s.status).length / total) * 100),
    }));
  }

  private computeDailyMetrics(): void {
    // Mock daily metrics for last 7 days
    this.dailyMetrics = [
      { date: 'Mar 10', conversations: 3, qualified: 1, signed: 0 },
      { date: 'Mar 11', conversations: 5, qualified: 2, signed: 0 },
      { date: 'Mar 12', conversations: 4, qualified: 2, signed: 1 },
      { date: 'Mar 13', conversations: 6, qualified: 3, signed: 0 },
      { date: 'Mar 14', conversations: 8, qualified: 4, signed: 1 },
      { date: 'Mar 15', conversations: 5, qualified: 3, signed: 1 },
      { date: 'Mar 16', conversations: 3, qualified: 1, signed: 0 },
    ];
  }

  getClaimIcon(type: string): string {
    const m: Record<string, string> = { fire: 'whatshot', water: 'water_drop', storm: 'thunderstorm', vandalism: 'broken_image' };
    return m[type] || 'help';
  }

  getStatusBarColor(status: string): string {
    const m: Record<string, string> = {
      new_lead: '#00e5ff', contacted: '#2979ff', qualified: '#00e676',
      appointment_set: '#ff6d00', client_signed: '#aa00ff',
    };
    return m[status] || '#64748b';
  }

  getClaimBarColor(type: string): string {
    const m: Record<string, string> = { fire: '#ff1744', water: '#2979ff', storm: '#ffd600', vandalism: '#aa00ff' };
    return m[type] || '#64748b';
  }

  getMaxDaily(field: 'conversations' | 'qualified' | 'signed'): number {
    return Math.max(...this.dailyMetrics.map(d => d[field]), 1);
  }
}
