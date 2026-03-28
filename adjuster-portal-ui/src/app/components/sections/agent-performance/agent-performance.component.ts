import { Component, OnInit } from '@angular/core';

type DateRange = '7d' | '30d' | '90d' | 'all';

interface AgentRow {
  name: string;
  territory: string;
  leadsAssigned: number;
  callsCompleted: number;
  appointmentsBooked: number;
  clientsSigned: number;
  claimsOpened: number;
  conversionPct: number;
}

const BASE_AGENTS: Omit<AgentRow, 'conversionPct'>[] = [
  { name: 'Marcus Rivera',    territory: 'DFW',          leadsAssigned: 87, callsCompleted: 64, appointmentsBooked: 42, clientsSigned: 24, claimsOpened: 22 },
  { name: 'Angela Watts',     territory: 'Houston',      leadsAssigned: 74, callsCompleted: 55, appointmentsBooked: 38, clientsSigned: 19, claimsOpened: 17 },
  { name: 'Tyler Jackson',    territory: 'Austin',       leadsAssigned: 62, callsCompleted: 48, appointmentsBooked: 31, clientsSigned: 16, claimsOpened: 14 },
  { name: 'Sarah Mitchell',   territory: 'San Antonio',  leadsAssigned: 55, callsCompleted: 40, appointmentsBooked: 24, clientsSigned: 11, claimsOpened: 10 },
  { name: 'David Chen',       territory: 'DFW',          leadsAssigned: 48, callsCompleted: 36, appointmentsBooked: 20, clientsSigned: 9,  claimsOpened: 8 },
  { name: 'Jessica Taylor',   territory: 'Houston',      leadsAssigned: 41, callsCompleted: 30, appointmentsBooked: 16, clientsSigned: 7,  claimsOpened: 6 },
  { name: 'Michael Foster',   territory: 'El Paso',      leadsAssigned: 35, callsCompleted: 25, appointmentsBooked: 13, clientsSigned: 5,  claimsOpened: 5 },
  { name: 'Amanda Rodriguez', territory: 'Austin',       leadsAssigned: 29, callsCompleted: 20, appointmentsBooked: 10, clientsSigned: 4,  claimsOpened: 4 },
  { name: 'Brian Nguyen',     territory: 'San Antonio',  leadsAssigned: 24, callsCompleted: 17, appointmentsBooked: 8,  clientsSigned: 3,  claimsOpened: 3 },
  { name: 'Karen Phillips',   territory: 'El Paso',      leadsAssigned: 20, callsCompleted: 14, appointmentsBooked: 6,  clientsSigned: 2,  claimsOpened: 2 },
];

const RANGE_MULTIPLIERS: Record<DateRange, number> = {
  '7d': 0.25,
  '30d': 1,
  '90d': 3,
  'all': 5,
};

@Component({
  selector: 'app-agent-performance',
  templateUrl: './agent-performance.component.html',
  styleUrls: ['./agent-performance.component.scss'],
  standalone: false,
})
export class AgentPerformanceComponent implements OnInit {

  agents: AgentRow[] = [];
  allAgents: AgentRow[] = [];

  dateRange: DateRange = '30d';
  agentFilter = '';
  territoryFilter = '';

  displayedColumns = [
    'rank', 'name', 'leadsAssigned', 'callsCompleted',
    'appointmentsBooked', 'clientsSigned', 'conversionPct',
  ];

  dateRangeOptions = [
    { value: '7d',  label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'all', label: 'All Time' },
  ];

  // Computed KPIs
  totalLeadsAssigned = 0;
  totalCallsMade = 0;
  totalAppointments = 0;
  totalClientsSigned = 0;
  totalClaimsOpened = 0;
  conversionRate = 0;

  get territories(): string[] {
    const set = new Set(this.allAgents.map(a => a.territory));
    return Array.from(set).sort();
  }

  get agentNames(): string[] {
    return this.allAgents.map(a => a.name);
  }

  ngOnInit(): void {
    this.buildData();
  }

  private buildData(): void {
    const mult = RANGE_MULTIPLIERS[this.dateRange];
    this.allAgents = BASE_AGENTS.map(a => {
      const leads = Math.round(a.leadsAssigned * mult);
      const calls = Math.round(a.callsCompleted * mult);
      const appts = Math.round(a.appointmentsBooked * mult);
      const signed = Math.round(a.clientsSigned * mult);
      const claims = Math.round(a.claimsOpened * mult);
      return {
        name: a.name,
        territory: a.territory,
        leadsAssigned: leads,
        callsCompleted: calls,
        appointmentsBooked: appts,
        clientsSigned: signed,
        claimsOpened: claims,
        conversionPct: leads > 0 ? +((signed / leads) * 100).toFixed(1) : 0,
      };
    });
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.allAgents];
    if (this.agentFilter) {
      filtered = filtered.filter(a => a.name === this.agentFilter);
    }
    if (this.territoryFilter) {
      filtered = filtered.filter(a => a.territory === this.territoryFilter);
    }
    this.agents = filtered.sort((a, b) => b.clientsSigned - a.clientsSigned);
    this.computeKpis();
  }

  onFilterChange(): void {
    if (this.dateRange) {
      this.buildData();
    } else {
      this.applyFilters();
    }
  }

  private computeKpis(): void {
    this.totalLeadsAssigned = this.agents.reduce((s, a) => s + a.leadsAssigned, 0);
    this.totalCallsMade = this.agents.reduce((s, a) => s + a.callsCompleted, 0);
    this.totalAppointments = this.agents.reduce((s, a) => s + a.appointmentsBooked, 0);
    this.totalClientsSigned = this.agents.reduce((s, a) => s + a.clientsSigned, 0);
    this.totalClaimsOpened = this.agents.reduce((s, a) => s + a.claimsOpened, 0);
    this.conversionRate = this.totalLeadsAssigned > 0
      ? +((this.totalClientsSigned / this.totalLeadsAssigned) * 100).toFixed(1)
      : 0;
  }

  getRankClass(index: number): string {
    if (index === 0) return 'rank-gold';
    if (index === 1) return 'rank-silver';
    if (index === 2) return 'rank-bronze';
    return '';
  }
}
