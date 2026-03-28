import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  RotationLeadStatus,
  LeadSource,
  LEAD_SOURCE_META,
} from 'src/app/models/rotation-lead.model';

// ── Local interfaces ─────────────────────────────────────────

interface EngineKpis {
  totalLeadsToday: number;
  leadsAssigned: number;
  unassignedQueue: number;
  conversionRate: number;
  topAgent: { name: string; closingRate: number } | null;
}

interface QueueLead {
  id: string;
  ownerName: string;
  phone: string;
  propertyAddress: string;
  city: string;
  state: string;
  territory: string;
  leadSource: LeadSource;
  status: RotationLeadStatus;
  priorityScore: number;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  createdAt: string;
}

interface PoolAgent {
  id: string;
  name: string;
  territory: string;
  isAvailable: boolean;
  isAcceptingLeads: boolean;
  rank: number;
  dailyLimit: number;
  leadsToday: number;
  closingRate: number;
  avgResponseHours: number;
  compositeScore: number;
}

interface AssignmentRecord {
  id: string;
  timestamp: string;
  leadId: string;
  leadName: string;
  agentId: string;
  agentName: string;
  territory: string;
  method: 'auto' | 'manual';
  reason: string;
}

// ── Status display helpers ──

const STATUS_LABELS: Record<string, string> = {
  [RotationLeadStatus.NEW_LEAD]: 'New Lead',
  [RotationLeadStatus.ASSIGNED]: 'Assigned',
  [RotationLeadStatus.ATTEMPTED_CONTACT]: 'Attempted Contact',
  [RotationLeadStatus.NO_ANSWER]: 'No Answer',
  [RotationLeadStatus.INTERESTED]: 'Interested',
  [RotationLeadStatus.NOT_INTERESTED]: 'Not Interested',
  [RotationLeadStatus.SIGNED_CLIENT]: 'Signed Client',
  [RotationLeadStatus.INVALID_LEAD]: 'Invalid Lead',
  [RotationLeadStatus.LEFT_MESSAGE]: 'Left Message',
  [RotationLeadStatus.CALL_BACK_LATER]: 'Call Back Later',
};

const STATUS_BADGE: Record<string, string> = {
  [RotationLeadStatus.NEW_LEAD]: 'badge-cyan',
  [RotationLeadStatus.ASSIGNED]: 'badge-orange',
  [RotationLeadStatus.ATTEMPTED_CONTACT]: 'badge-yellow',
  [RotationLeadStatus.NO_ANSWER]: 'badge-muted',
  [RotationLeadStatus.INTERESTED]: 'badge-purple',
  [RotationLeadStatus.NOT_INTERESTED]: 'badge-red',
  [RotationLeadStatus.SIGNED_CLIENT]: 'badge-green',
  [RotationLeadStatus.INVALID_LEAD]: 'badge-red',
  [RotationLeadStatus.LEFT_MESSAGE]: 'badge-yellow',
  [RotationLeadStatus.CALL_BACK_LATER]: 'badge-yellow',
};

@Component({
  selector: 'app-lead-rotation-engine',
  templateUrl: './lead-rotation-engine.component.html',
  styleUrls: ['./lead-rotation-engine.component.scss'],
  standalone: false,
})
export class LeadRotationEngineComponent implements OnInit {
  // ── Enums / lookup exposed to template ──
  RotationLeadStatus = RotationLeadStatus;
  LEAD_SOURCE_META = LEAD_SOURCE_META;
  STATUS_LABELS = STATUS_LABELS;
  STATUS_BADGE = STATUS_BADGE;

  // ── Dropdown options ──
  statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: RotationLeadStatus.NEW_LEAD, label: 'New Lead' },
    { value: RotationLeadStatus.ASSIGNED, label: 'Assigned' },
    { value: RotationLeadStatus.ATTEMPTED_CONTACT, label: 'Attempted Contact' },
    { value: RotationLeadStatus.NO_ANSWER, label: 'No Answer' },
    { value: RotationLeadStatus.INTERESTED, label: 'Interested' },
    { value: RotationLeadStatus.NOT_INTERESTED, label: 'Not Interested' },
    { value: RotationLeadStatus.SIGNED_CLIENT, label: 'Signed Client' },
  ];

  sourceOptions: { value: string; label: string }[] = [
    { value: '', label: 'All Sources' },
    ...Object.entries(LEAD_SOURCE_META).map(([key, meta]) => ({
      value: key,
      label: meta.label,
    })),
  ];

  territoryOptions: string[] = [];

  // ── Filters ──
  filterStatus = '';
  filterSource = '';
  filterTerritory = '';

  // ── Core data ──
  leads: QueueLead[] = [];
  filteredLeads: QueueLead[] = [];
  agents: PoolAgent[] = [];
  assignmentLog: AssignmentRecord[] = [];
  kpis: EngineKpis = { totalLeadsToday: 0, leadsAssigned: 0, unassignedQueue: 0, conversionRate: 0, topAgent: null };

  // ── Selection ──
  selectedLeadId: string | null = null;

  // ── Rotation settings ──
  enforceTerritoryMatch = true;
  usePerformanceWeighting = true;
  weightClosingRate = 50;
  weightResponseSpeed = 30;
  weightSatisfaction = 20;

  // ── Engine status ──
  engineActive = true;
  lastRunTimestamp: string = '';
  private rotationIndex = 0;

  constructor(private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.initMockData();
    this.buildTerritoryOptions();
    this.applyFilters();
    this.computeKpis();
    this.lastRunTimestamp = new Date().toLocaleString();
  }

  // ══════════════════════════════════════════════════════════════
  // MOCK DATA
  // ══════════════════════════════════════════════════════════════

  private initMockData(): void {
    this.leads = [
      { id: 'L-001', ownerName: 'Maria Gonzalez', phone: '(305) 555-0142', propertyAddress: '1420 NW 3rd Ave', city: 'Miami', state: 'FL', territory: 'South Florida', leadSource: 'storm_intelligence', status: RotationLeadStatus.NEW_LEAD, priorityScore: 92, assignedAgentId: null, assignedAgentName: null, createdAt: '2026-03-16T08:12:00Z' },
      { id: 'L-002', ownerName: 'James Carter', phone: '(713) 555-0198', propertyAddress: '8801 Westheimer Rd', city: 'Houston', state: 'TX', territory: 'Texas Gulf', leadSource: 'fire_incident', status: RotationLeadStatus.ASSIGNED, priorityScore: 88, assignedAgentId: 'A-002', assignedAgentName: 'David Kim', createdAt: '2026-03-16T07:45:00Z' },
      { id: 'L-003', ownerName: 'Patricia Nguyen', phone: '(404) 555-0177', propertyAddress: '3200 Peachtree Rd NE', city: 'Atlanta', state: 'GA', territory: 'Georgia Metro', leadSource: 'referral', status: RotationLeadStatus.ATTEMPTED_CONTACT, priorityScore: 74, assignedAgentId: 'A-003', assignedAgentName: 'Sarah Chen', createdAt: '2026-03-16T06:30:00Z' },
      { id: 'L-004', ownerName: 'Robert Williams', phone: '(214) 555-0133', propertyAddress: '4500 Preston Rd', city: 'Dallas', state: 'TX', territory: 'Texas Gulf', leadSource: 'organic_inbound', status: RotationLeadStatus.NO_ANSWER, priorityScore: 61, assignedAgentId: 'A-002', assignedAgentName: 'David Kim', createdAt: '2026-03-16T09:00:00Z' },
      { id: 'L-005', ownerName: 'Linda Thompson', phone: '(954) 555-0166', propertyAddress: '2100 E Las Olas Blvd', city: 'Fort Lauderdale', state: 'FL', territory: 'South Florida', leadSource: 'community_advocate', status: RotationLeadStatus.INTERESTED, priorityScore: 85, assignedAgentId: 'A-001', assignedAgentName: 'Alex Rivera', createdAt: '2026-03-15T14:20:00Z' },
      { id: 'L-006', ownerName: 'Michael Brown', phone: '(678) 555-0122', propertyAddress: '900 Holcomb Bridge Rd', city: 'Roswell', state: 'GA', territory: 'Georgia Metro', leadSource: 'crime_claim', status: RotationLeadStatus.SIGNED_CLIENT, priorityScore: 95, assignedAgentId: 'A-003', assignedAgentName: 'Sarah Chen', createdAt: '2026-03-14T10:00:00Z' },
      { id: 'L-007', ownerName: 'Jessica Davis', phone: '(305) 555-0199', propertyAddress: '7700 Collins Ave', city: 'Miami Beach', state: 'FL', territory: 'South Florida', leadSource: 'manual_entry', status: RotationLeadStatus.NEW_LEAD, priorityScore: 55, assignedAgentId: null, assignedAgentName: null, createdAt: '2026-03-16T10:05:00Z' },
      { id: 'L-008', ownerName: 'Thomas Anderson', phone: '(832) 555-0188', propertyAddress: '1200 McKinney St', city: 'Houston', state: 'TX', territory: 'Texas Gulf', leadSource: 'storm_intelligence', status: RotationLeadStatus.NEW_LEAD, priorityScore: 79, assignedAgentId: null, assignedAgentName: null, createdAt: '2026-03-16T10:30:00Z' },
    ];

    this.agents = [
      { id: 'A-001', name: 'Alex Rivera', territory: 'South Florida', isAvailable: true, isAcceptingLeads: true, rank: 1, dailyLimit: 8, leadsToday: 3, closingRate: 42, avgResponseHours: 0.5, compositeScore: 87 },
      { id: 'A-002', name: 'David Kim', territory: 'Texas Gulf', isAvailable: true, isAcceptingLeads: true, rank: 2, dailyLimit: 6, leadsToday: 4, closingRate: 38, avgResponseHours: 0.8, compositeScore: 79 },
      { id: 'A-003', name: 'Sarah Chen', territory: 'Georgia Metro', isAvailable: true, isAcceptingLeads: true, rank: 3, dailyLimit: 7, leadsToday: 2, closingRate: 51, avgResponseHours: 0.3, compositeScore: 93 },
      { id: 'A-004', name: 'Marcus Johnson', territory: 'South Florida', isAvailable: false, isAcceptingLeads: false, rank: 4, dailyLimit: 5, leadsToday: 0, closingRate: 29, avgResponseHours: 1.2, compositeScore: 58 },
      { id: 'A-005', name: 'Emily Torres', territory: 'Texas Gulf', isAvailable: true, isAcceptingLeads: true, rank: 5, dailyLimit: 6, leadsToday: 1, closingRate: 45, avgResponseHours: 0.6, compositeScore: 84 },
    ];

    this.assignmentLog = [
      { id: 'R-001', timestamp: '2026-03-16T08:15:00Z', leadId: 'L-002', leadName: 'James Carter', agentId: 'A-002', agentName: 'David Kim', territory: 'Texas Gulf', method: 'auto', reason: 'Territory match + highest composite score' },
      { id: 'R-002', timestamp: '2026-03-16T07:00:00Z', leadId: 'L-003', leadName: 'Patricia Nguyen', agentId: 'A-003', agentName: 'Sarah Chen', territory: 'Georgia Metro', method: 'auto', reason: 'Only eligible agent in territory' },
      { id: 'R-003', timestamp: '2026-03-15T14:30:00Z', leadId: 'L-005', leadName: 'Linda Thompson', agentId: 'A-001', agentName: 'Alex Rivera', territory: 'South Florida', method: 'manual', reason: 'Manager override — high-value lead' },
      { id: 'R-004', timestamp: '2026-03-16T09:05:00Z', leadId: 'L-004', leadName: 'Robert Williams', agentId: 'A-002', agentName: 'David Kim', territory: 'Texas Gulf', method: 'auto', reason: 'Round-robin rotation' },
      { id: 'R-005', timestamp: '2026-03-14T10:10:00Z', leadId: 'L-006', leadName: 'Michael Brown', agentId: 'A-003', agentName: 'Sarah Chen', territory: 'Georgia Metro', method: 'auto', reason: 'Territory match + highest composite score' },
      { id: 'R-006', timestamp: '2026-03-16T08:20:00Z', leadId: 'L-005', leadName: 'Linda Thompson', agentId: 'A-001', agentName: 'Alex Rivera', territory: 'South Florida', method: 'manual', reason: 'Re-assigned per customer request' },
    ];
  }

  // ══════════════════════════════════════════════════════════════
  // KPI COMPUTATION
  // ══════════════════════════════════════════════════════════════

  computeKpis(): void {
    const total = this.leads.length;
    const assigned = this.leads.filter(l => l.assignedAgentId !== null).length;
    const unassigned = total - assigned;
    const signed = this.leads.filter(l => l.status === RotationLeadStatus.SIGNED_CLIENT).length;
    const conversionRate = total > 0 ? Math.round((signed / total) * 100) : 0;

    let topAgent: { name: string; closingRate: number } | null = null;
    if (this.agents.length) {
      const best = [...this.agents].sort((a, b) => b.closingRate - a.closingRate)[0];
      topAgent = { name: best.name, closingRate: best.closingRate };
    }

    this.kpis = { totalLeadsToday: total, leadsAssigned: assigned, unassignedQueue: unassigned, conversionRate, topAgent };
  }

  // ══════════════════════════════════════════════════════════════
  // FILTERS
  // ══════════════════════════════════════════════════════════════

  private buildTerritoryOptions(): void {
    const set = new Set<string>();
    this.leads.forEach(l => set.add(l.territory));
    this.agents.forEach(a => set.add(a.territory));
    this.territoryOptions = Array.from(set).sort();
  }

  applyFilters(): void {
    this.filteredLeads = this.leads.filter(l => {
      if (this.filterStatus && l.status !== this.filterStatus) return false;
      if (this.filterSource && l.leadSource !== this.filterSource) return false;
      if (this.filterTerritory && l.territory !== this.filterTerritory) return false;
      return true;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // LEAD SELECTION
  // ══════════════════════════════════════════════════════════════

  selectLead(lead: QueueLead): void {
    this.selectedLeadId = this.selectedLeadId === lead.id ? null : lead.id;
  }

  isLeadSelected(lead: QueueLead): boolean {
    return this.selectedLeadId === lead.id;
  }

  // ══════════════════════════════════════════════════════════════
  // MANUAL ASSIGN
  // ══════════════════════════════════════════════════════════════

  manualAssign(agent: PoolAgent): void {
    if (!this.selectedLeadId) {
      this.snackBar.open('Select a lead from the queue first', 'OK', { duration: 3000 });
      return;
    }
    const lead = this.leads.find(l => l.id === this.selectedLeadId);
    if (!lead) return;

    if (lead.assignedAgentId) {
      this.snackBar.open('Lead is already assigned — reassigning', 'OK', { duration: 3000 });
    }

    lead.assignedAgentId = agent.id;
    lead.assignedAgentName = agent.name;
    lead.status = RotationLeadStatus.ASSIGNED;
    agent.leadsToday++;

    this.assignmentLog.unshift({
      id: 'R-' + String(this.assignmentLog.length + 1).padStart(3, '0'),
      timestamp: new Date().toISOString(),
      leadId: lead.id,
      leadName: lead.ownerName,
      agentId: agent.id,
      agentName: agent.name,
      territory: lead.territory,
      method: 'manual',
      reason: 'Manual assignment by manager',
    });

    this.selectedLeadId = null;
    this.applyFilters();
    this.computeKpis();
    this.snackBar.open(`Assigned ${lead.ownerName} to ${agent.name}`, 'OK', { duration: 3000 });
  }

  // ══════════════════════════════════════════════════════════════
  // RUN ROTATION (auto-assign all new leads)
  // ══════════════════════════════════════════════════════════════

  runRotation(): void {
    const newLeads = this.leads.filter(l => l.status === RotationLeadStatus.NEW_LEAD);
    if (!newLeads.length) {
      this.snackBar.open('No new leads to assign', 'OK', { duration: 3000 });
      return;
    }

    // Recalculate composite scores based on current weight sliders
    if (this.usePerformanceWeighting) {
      this.recalcCompositeScores();
    }

    let assignedCount = 0;
    const agentsUsed = new Set<string>();

    for (const lead of newLeads) {
      let eligible = this.agents.filter(a => a.isAvailable && a.isAcceptingLeads && a.leadsToday < a.dailyLimit);

      if (this.enforceTerritoryMatch) {
        const territoryMatch = eligible.filter(a => a.territory === lead.territory);
        if (territoryMatch.length) eligible = territoryMatch;
      }

      if (!eligible.length) continue;

      // Sort by composite score descending
      eligible.sort((a, b) => b.compositeScore - a.compositeScore);

      // Round-robin within top-scoring agents
      const agent = eligible[this.rotationIndex % eligible.length];
      this.rotationIndex++;

      lead.assignedAgentId = agent.id;
      lead.assignedAgentName = agent.name;
      lead.status = RotationLeadStatus.ASSIGNED;
      agent.leadsToday++;
      assignedCount++;
      agentsUsed.add(agent.name);

      this.assignmentLog.unshift({
        id: 'R-' + String(this.assignmentLog.length + 1).padStart(3, '0'),
        timestamp: new Date().toISOString(),
        leadId: lead.id,
        leadName: lead.ownerName,
        agentId: agent.id,
        agentName: agent.name,
        territory: lead.territory,
        method: 'auto',
        reason: this.enforceTerritoryMatch ? 'Territory match + composite score rotation' : 'Composite score rotation (no territory filter)',
      });
    }

    this.lastRunTimestamp = new Date().toLocaleString();
    this.applyFilters();
    this.computeKpis();
    this.snackBar.open(`Assigned ${assignedCount} leads to ${agentsUsed.size} agents`, 'OK', { duration: 4000 });
  }

  // ══════════════════════════════════════════════════════════════
  // AGENT AVAILABILITY TOGGLE
  // ══════════════════════════════════════════════════════════════

  toggleAvailability(agent: PoolAgent): void {
    agent.isAvailable = !agent.isAvailable;
    agent.isAcceptingLeads = agent.isAvailable;
  }

  // ══════════════════════════════════════════════════════════════
  // COMPOSITE SCORE RECALCULATION
  // ══════════════════════════════════════════════════════════════

  recalcCompositeScores(): void {
    const totalWeight = this.weightClosingRate + this.weightResponseSpeed + this.weightSatisfaction;
    if (totalWeight === 0) return;

    const wClose = this.weightClosingRate / totalWeight;
    const wSpeed = this.weightResponseSpeed / totalWeight;
    const wSat = this.weightSatisfaction / totalWeight;

    for (const agent of this.agents) {
      const closeScore = agent.closingRate; // 0-100
      const speedScore = Math.max(0, 100 - (agent.avgResponseHours * 50)); // lower hours = higher score
      const satScore = 70 + Math.random() * 25; // placeholder satisfaction 70-95
      agent.compositeScore = Math.round(closeScore * wClose + speedScore * wSpeed + satScore * wSat);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  getSourceLabel(source: LeadSource): string {
    return LEAD_SOURCE_META[source]?.label || source;
  }

  getSourceIcon(source: LeadSource): string {
    return LEAD_SOURCE_META[source]?.icon || 'help';
  }

  getStatusLabel(status: RotationLeadStatus): string {
    return STATUS_LABELS[status] || status;
  }

  getStatusBadge(status: RotationLeadStatus): string {
    return STATUS_BADGE[status] || 'badge-muted';
  }

  formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
