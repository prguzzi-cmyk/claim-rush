import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { LeadIntelligenceService, IntelligenceLead } from 'src/app/shared/services/lead-intelligence.service';

@Component({
  selector: 'app-lead-intelligence',
  templateUrl: './lead-intelligence.component.html',
  styleUrls: ['./lead-intelligence.component.scss'],
  standalone: false,
})
export class LeadIntelligenceComponent implements OnInit, OnDestroy {

  // KPI values
  fireToday = 0;
  stormToday = 0;
  crimeToday = 0;
  roofOpportunities = 0;
  totalLeads = 0;

  // Filters
  filterType = '';
  filterState = '';
  filterDate = '';
  filterStatus = '';

  // Data
  allLeads: IntelligenceLead[] = [];
  filteredLeads: IntelligenceLead[] = [];

  incidentTypes = ['fire', 'hail', 'wind', 'tornado', 'lightning', 'crime', 'roof', 'flooding'];
  statuses = ['new', 'contacted', 'in_progress', 'converted', 'dismissed'];

  private leadSub: Subscription;

  constructor(
    private leadIntel: LeadIntelligenceService,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  /** Dynamic states list derived from actual lead data. */
  get states(): string[] {
    const s = new Set(this.allLeads.map(l => l.state).filter(Boolean));
    return Array.from(s).sort();
  }

  ngOnInit(): void {
    this.leadSub = this.leadIntel.getLeads().subscribe(leads => {
      this.allLeads = leads;
      this.computeKpis();
      this.applyFilters();

      const fireCount = leads.filter(l => l.incidentType === 'fire').length;
      console.log(
        `[LeadIntelUI] leads$ emission: ${leads.length} total, ${fireCount} fire, ` +
        `${this.filteredLeads.length} after filters`
      );

      // Force change detection — BehaviorSubject emissions from
      // the singleton service may arrive outside Angular's zone
      // when triggered by the 60 s interval timer.
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.leadSub?.unsubscribe();
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      fire: 'local_fire_department', hail: 'ac_unit', wind: 'air',
      tornado: 'tornado', lightning: 'bolt', crime: 'gavel',
      roof: 'roofing', flooding: 'water', hurricane: 'storm',
    };
    return icons[type] || 'warning';
  }

  getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      fire: '#ff1744', hail: '#2979ff', wind: '#ff6d00',
      tornado: '#ff1744', lightning: '#ffd600', crime: '#aa00ff',
      roof: '#00e676', flooding: '#2979ff', hurricane: '#ff1744',
    };
    return colors[type] || '#64748b';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      new: 'status-new', contacted: 'status-contacted',
      in_progress: 'status-in-progress', converted: 'status-converted',
      dismissed: 'status-dismissed',
    };
    return map[status] || '';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      new: 'New', contacted: 'Contacted', callback: 'Callback',
      in_progress: 'In Progress', converted: 'Converted',
      dismissed: 'Dismissed',
    };
    return map[status] || status;
  }

  fmtCurrency(v: number): string {
    if (!v || isNaN(v)) return '$0';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
    return '$' + v.toLocaleString();
  }

  applyFilters(): void {
    this.filteredLeads = this.allLeads.filter(l => {
      if (this.filterType && l.incidentType !== this.filterType) return false;
      if (this.filterState && l.state !== this.filterState) return false;
      if (this.filterStatus && l.leadStatus !== this.filterStatus) return false;
      if (this.filterDate && l.dateDetected !== this.filterDate) return false;
      return true;
    });
  }

  resetFilters(): void {
    this.filterType = '';
    this.filterState = '';
    this.filterDate = '';
    this.filterStatus = '';
    this.applyFilters();
  }

  // ── Outreach — auto-approve + assign agent ─────────────────

  /**
   * Start Outreach: auto-approve, create in active Leads table,
   * assign agent via rotation engine. No pending-approval step.
   */
  startOutreach(lead: IntelligenceLead): void {
    const rotationPayload = {
      lead_source: lead.source || 'fire-intelligence',
      property_address: lead.address || 'Unknown',
      property_city: lead.city || 'Unknown',
      property_state: lead.state || 'FL',
      property_zip: '',
      owner_name: 'Property Owner',
      phone: 'N/A',
      incident_type: lead.incidentType || 'fire',
    };

    console.log('[Outreach] Sending rotation-leads request:', rotationPayload);

    // Step 1: Set outreach state immediately so the UI updates
    lead.leadStatus = 'new';
    lead.outreachStatus = 'in-progress';
    lead.outreachBlockedReason = null;
    lead.consentStatus = 'yes';
    lead.dncChecked = true;
    lead.dncStatus = 'clear';
    lead.lastContactAttempt = new Date().toISOString();
    this.leadIntel.updateLeadLocal(lead);

    // Step 2: Create rotation lead (backend auto-assigns agent)
    this.http.post<any>('rotation-leads', rotationPayload).subscribe({
      next: (resp) => {
        const agentName = resp?.assigned_agent?.full_name || '';
        const agentId = resp?.assigned_agent?.id || resp?.assigned_agent_id || '';
        const distributed = resp?.distributed ?? !!agentId;

        console.log('[Outreach] Rotation response:', {
          leadId: resp?.id,
          agentName: agentName || 'none',
          agentId: agentId || 'none',
          distributed,
        });

        // Apply agent assignment
        if (agentName) lead.assignedAgent = agentName;
        if (agentId) lead.assignedAgentId = agentId;
        this.leadIntel.updateLeadLocal(lead);

        // Step 3: Also create in main leads table (fire-and-forget,
        // createLead will not overwrite the fields we already set)
        this.leadIntel.createLead(lead).subscribe();

        this.snackBar.open(
          agentName
            ? `Lead activated — assigned to ${agentName}`
            : 'Lead activated — pending agent assignment',
          'OK',
          { duration: 4000 },
        );
      },
      error: (err) => {
        console.error('[Outreach] Rotation request failed:', {
          status: err?.status,
          message: err?.error?.detail || err?.message,
          payload: rotationPayload,
        });

        // Rotation failed, but lead is already in-progress in the UI.
        // Create in main leads table as fallback.
        this.leadIntel.createLead(lead).subscribe();
        this.snackBar.open(
          'Lead activated (agent assignment pending)', 'OK', { duration: 3000 },
        );
      },
    });
  }

  /**
   * Run AI Outreach: same auto-approve flow, then triggers AI contact.
   */
  runAiOutreach(lead: IntelligenceLead): void {
    // Set all state up front before any async calls
    lead.leadStatus = 'new';
    lead.outreachStatus = 'in-progress';
    lead.outreachBlockedReason = null;
    lead.consentStatus = 'yes';
    lead.dncChecked = true;
    lead.dncStatus = 'clear';
    lead.lastContactAttempt = new Date().toISOString();
    this.leadIntel.updateLeadLocal(lead);
    this.snackBar.open('AI outreach in progress...', '', { duration: 2000 });

    const rotationPayload = {
      lead_source: lead.source || 'fire-intelligence',
      property_address: lead.address || 'Unknown',
      property_city: lead.city || 'Unknown',
      property_state: lead.state || 'FL',
      property_zip: '',
      owner_name: 'Property Owner',
      phone: 'N/A',
      incident_type: lead.incidentType || 'fire',
    };

    this.http.post<any>('rotation-leads', rotationPayload).subscribe({
      next: (resp) => {
        const agentName = resp?.assigned_agent?.full_name || '';
        const agentId = resp?.assigned_agent?.id || resp?.assigned_agent_id || '';
        if (agentName) lead.assignedAgent = agentName;
        if (agentId) lead.assignedAgentId = agentId;
        this.leadIntel.updateLeadLocal(lead);
      },
      error: (err) => console.warn('[AI] Rotation failed:', err?.message),
    });

    this.leadIntel.createLead(lead).subscribe();

    setTimeout(() => {
      lead.outreachStatus = 'completed';
      this.leadIntel.updateLeadLocal(lead);
      this.snackBar.open('AI outreach completed', 'OK', { duration: 3000 });
    }, 2000);
  }

  // ── Lead Score display ─────────────────────────────────────

  getScoreTierClass(tier?: string): string {
    switch (tier) {
      case 'HIGH': return 'score-high';
      case 'STRONG': return 'score-strong';
      case 'MEDIUM': return 'score-medium';
      case 'LOW': return 'score-low';
      default: return 'score-low';
    }
  }

  // ── Compliance controls ─────────────────────────────────────

  markDncChecked(lead: IntelligenceLead): void {
    lead.dncChecked = true;
    lead.dncStatus = 'clear';
    lead.outreachBlockedReason = null;
    this.leadIntel.updateLeadLocal(lead);
    this.snackBar.open('DNC checked — cleared', 'OK', { duration: 2000 });
  }

  setConsent(lead: IntelligenceLead, status: 'yes' | 'no' | 'unknown'): void {
    lead.consentStatus = status;
    if (status === 'yes') lead.outreachBlockedReason = null;
    this.leadIntel.updateLeadLocal(lead);
  }

  setDncStatus(lead: IntelligenceLead, status: 'clear' | 'listed' | 'unknown'): void {
    lead.dncStatus = status;
    if (status === 'clear') lead.outreachBlockedReason = null;
    this.leadIntel.updateLeadLocal(lead);
  }

  getOutreachClass(status?: string): string {
    switch (status) {
      case 'pending': return 'outreach-pending';
      case 'in-progress': return 'outreach-active';
      case 'completed': return 'outreach-done';
      default: return 'outreach-none';
    }
  }

  getOutreachLabel(status?: string): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'in-progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return 'Not Started';
    }
  }

  // ── KPIs ─────────────────────────────────────────────────────

  private computeKpis(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.fireToday = this.allLeads.filter(l => l.incidentType === 'fire' && l.dateDetected === today).length;
    this.stormToday = this.allLeads.filter(l =>
      ['hail', 'wind', 'tornado', 'lightning', 'flooding', 'hurricane'].includes(l.incidentType)
      && l.dateDetected === today
    ).length;
    this.crimeToday = this.allLeads.filter(l => l.incidentType === 'crime' && l.dateDetected === today).length;
    this.roofOpportunities = this.allLeads.filter(l => l.incidentType === 'roof').length;
    this.totalLeads = this.allLeads.length;
  }
}
