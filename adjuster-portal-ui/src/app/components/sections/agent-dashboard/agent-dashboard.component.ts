import { Component, OnInit, OnDestroy, NgZone, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription, interval } from 'rxjs';
import { take } from 'rxjs/operators';
import { GoogleMap } from '@angular/google-maps';

import { LiveActivityService } from 'src/app/services/live-activity.service';
import { LiveActivityItem, ActivityEventType } from 'src/app/models/live-activity.model';
import { DashboardService } from 'src/app/services/dashboard.service';
import { UserService } from 'src/app/services/user.service';
import { TerritoryService } from 'src/app/services/territory.service';
import { Territory, TerritoryWithAssignments } from 'src/app/models/territory.model';
import { filterByTerritories } from 'src/app/utils/territory-filter.util';
import { AgentDashboardApiService, AgentAvailabilityResponse } from 'src/app/services/agent-dashboard-api.service';
import { AgentDashboardLead } from 'src/app/models/agent-dashboard.model';
import { FireIncidentService } from 'src/app/services/fire-incident.service';
import { ConvertToLeadDialogComponent } from '../fire-incidents/convert-to-lead-dialog/convert-to-lead-dialog.component';

// --- Marker colors by event/lead type ---

const MARKER_COLORS: Record<string, string> = {
  fire_incident: '#FF6B35',
  storm_alert: '#8b5cf6',
  hail_alert: '#06b6d4',
  wind_alert: '#3b82f6',
  lightning_alert: '#eab308',
};

const LEAD_MARKER_COLORS: Record<string, string> = {
  pending: '#3B82F6',
  accepted: '#22c55e',
  declined: '#ef4444',
  escalated: '#f59e0b',
  expired: '#94a3b8',
};

const MAPPABLE_EVENT_TYPES: ActivityEventType[] = [
  'fire_incident', 'storm_alert', 'hail_alert', 'wind_alert', 'lightning_alert',
];

export interface KpiCard {
  label: string;
  value: number;
  icon: string;
  trend: 'up' | 'down' | 'flat';
  trendValue: string;
}

export interface AssignedLead {
  id: string;
  refString: string;
  contactName: string;
  address: string;
  source: string;
  assignedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'escalated';
  remainingSeconds: number;
  state?: string;
  county?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  escalation_level?: number;
  escalation_label?: string;
}

@Component({
  selector: 'app-agent-dashboard',
  templateUrl: './agent-dashboard.component.html',
  styleUrls: ['./agent-dashboard.component.scss'],
  standalone: false,
})
export class AgentDashboardComponent implements OnInit, OnDestroy {
  private useMockData = false;

  // Config from backend
  private escalationTimeoutSeconds = 300;
  private leadPollIntervalMs = 15000;

  // KPIs
  kpis: KpiCard[] = [];

  // Map
  @ViewChild(GoogleMap) googleMap!: GoogleMap;
  private mapReady = false;
  mapLoaded = false;
  private infoWindow: google.maps.InfoWindow | null = null;

  mapCenter: google.maps.LatLngLiteral = { lat: 32.78, lng: -96.80 };
  mapZoom = 10;
  mapOptions: google.maps.MapOptions = {
    mapTypeId: 'hybrid',
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [],
  };

  // Google Maps data arrays
  mapMarkers: { position: google.maps.LatLngLiteral; options: google.maps.MarkerOptions; popupHtml: string }[] = [];

  // Map legend entries
  legendItems = [
    { emoji: '🔥', label: 'Fire', color: '#FF6B35' },
    { emoji: '⛈️', label: 'Storm', color: 'var(--event-wind)' },
    { emoji: '🧊', label: 'Hail', color: 'var(--event-hail)' },
    { emoji: '💨', label: 'Wind', color: 'var(--event-wind)' },
    { emoji: '⚡', label: 'Lightning', color: 'var(--event-lightning)' },
    { emoji: '📋', label: 'Lead (Pending)', color: '#3B82F6' },
    { emoji: '✅', label: 'Lead (Accepted)', color: '#10B981' },
    { emoji: '⬆️', label: 'Lead (Escalated)', color: '#F59E0B' },
  ];

  // Lead operations
  assignedLeads: AssignedLead[] = [];
  private countdownInterval: ReturnType<typeof setInterval>;
  private leadPollSub: Subscription | null = null;

  // Ticker + Recent feed
  tickerItems: LiveActivityItem[] = [];
  recentIncidents: LiveActivityItem[] = [];

  /** Maps event types to display info */
  private eventDisplayMap: Record<string, { emoji: string; typeLabel: string; color: string }> = {
    fire_incident: { emoji: '🔥', typeLabel: 'Fire', color: '#FF6B35' },
    storm_alert: { emoji: '⛈️', typeLabel: 'Storm', color: '#2F6FED' },
    hail_alert: { emoji: '🧊', typeLabel: 'Hail', color: '#E5533D' },
    wind_alert: { emoji: '💨', typeLabel: 'Wind', color: '#2F6FED' },
    lightning_alert: { emoji: '⚡', typeLabel: 'Lightning', color: '#F39C12' },
    hurricane_alert: { emoji: '🌀', typeLabel: 'Hurricane', color: '#6D28D9' },
    lead_assigned: { emoji: '📋', typeLabel: 'Lead Assigned', color: '#3B82F6' },
    lead_escalated: { emoji: '⬆️', typeLabel: 'Escalated', color: '#F59E0B' },
    agent_accepted: { emoji: '✅', typeLabel: 'Accepted', color: '#10B981' },
    client_signed: { emoji: '✍️', typeLabel: 'Signed', color: '#10B981' },
  };

  // Agent Availability
  availability: AgentAvailabilityResponse | null = null;
  editingDailyLimit = false;
  editDailyLimit: number | null = null;
  availabilityLoading = false;

  // State
  lastRefreshTime: Date = new Date();
  private subs: Subscription[] = [];

  // Territory filtering
  userTerritories: Territory[] = [];
  nationalAccess = false;
  skipTerritoryFilter = false;
  noTerritoryAssigned = false;
  isChapterPresident = false;
  cpStates: string[] = [];

  constructor(
    private liveActivity: LiveActivityService,
    private dashboardService: DashboardService,
    private agentDashboardApi: AgentDashboardApiService,
    private userService: UserService,
    private territoryService: TerritoryService,
    private fireIncidentService: FireIncidentService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private zone: NgZone,
    private router: Router,
  ) {}

  ngOnInit() {
    // Load config from backend
    this.agentDashboardApi.getConfig().subscribe({
      next: (config) => {
        this.escalationTimeoutSeconds = config.escalation_timeout_seconds;
        this.leadPollIntervalMs = config.poll_interval_ms;
      },
      error: () => {
        // Use defaults on error
      },
    });

    const role = (localStorage.getItem('role-name') || '').toLowerCase();
    if (role === 'admin' || role === 'super-admin') {
      this.skipTerritoryFilter = true;
      this.initDashboard();
      return;
    }

    this.userService.currentUser.pipe(take(1)).subscribe(user => {
      if (!user?.id) {
        this.skipTerritoryFilter = true;
        this.initDashboard();
        return;
      }

      const userId = user.id;

      this.territoryService.getUserTerritories(userId).subscribe({
        next: (info) => {
          this.nationalAccess = info.national_access;
          this.userTerritories = info.territories || [];

          if (this.nationalAccess) {
            this.skipTerritoryFilter = true;
            this.initDashboard();
            return;
          }

          // Check chapter president status
          this.territoryService.getTerritoriesWithAssignments().subscribe({
            next: (allTerritories) => {
              this.checkChapterPresident(allTerritories, userId);
              this.finalizeTerritorySetup();
              this.initDashboard();
            },
            error: () => {
              if (this.useMockData) this.skipTerritoryFilter = true;
              this.finalizeTerritorySetup();
              this.initDashboard();
            },
          });
        },
        error: () => {
          if (this.useMockData) this.skipTerritoryFilter = true;
          this.initDashboard();
        },
      });
    });
  }

  private checkChapterPresident(allTerritories: TerritoryWithAssignments[], userId: string) {
    const cpTerritories = allTerritories.filter(
      t => t.chapter_president?.user_id === userId
    );

    if (cpTerritories.length > 0) {
      this.isChapterPresident = true;
      this.cpStates = [...new Set(
        cpTerritories.map(t => t.state).filter((s): s is string => !!s)
      )];
    }
  }

  private finalizeTerritorySetup() {
    if (this.isChapterPresident && this.cpStates.length > 0) {
      this.skipTerritoryFilter = false;
      for (const state of this.cpStates) {
        const alreadyHasState = this.userTerritories.some(
          t => t.territory_type === 'state' && t.state?.toLowerCase() === state.toLowerCase()
        );
        if (!alreadyHasState) {
          this.userTerritories.push({
            id: `cp-synthetic-${state}`,
            name: `${state} (Chapter President)`,
            territory_type: 'state',
            state,
          } as Territory);
        }
      }
    }

    if (this.userTerritories.length === 0 && !this.isChapterPresident && !this.nationalAccess) {
      this.noTerritoryAssigned = true;
    }
  }

  private initDashboard() {
    this.loadAvailability();
    this.loadKpis();
    this.loadRealLeads();
    this.startCountdown();
    this.startLeadPolling();

    // Subscribe to live activities for map markers, ticker, and recent feed
    this.subs.push(
      this.liveActivity.activities$.subscribe(items => {
        const filtered = this.applyTerritoryFilter(items);
        this.renderActivityMarkers(filtered);

        // Ticker: all items sorted by time (most recent first)
        this.tickerItems = [...filtered].sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );

        // Recent incidents feed: only mappable incident types, last 8
        this.recentIncidents = filtered
          .filter(i => MAPPABLE_EVENT_TYPES.includes(i.eventType))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 8);
      })
    );

    // Subscribe to focus events from ticker clicks
    this.subs.push(
      this.liveActivity.focusEvent$.subscribe(item => {
        if (item.latitude != null && item.longitude != null && this.googleMap?.googleMap) {
          this.googleMap.googleMap.panTo({ lat: item.latitude, lng: item.longitude });
          this.googleMap.googleMap.setZoom(14);
        }
      })
    );
  }

  private applyTerritoryFilter<T extends { state?: string; county?: string; zip_code?: string }>(items: T[]): T[] {
    if (this.noTerritoryAssigned) return [];
    if (this.skipTerritoryFilter) return items;
    return filterByTerritories(items, this.userTerritories);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.leadPollSub) this.leadPollSub.unsubscribe();
    if (this.infoWindow) this.infoWindow.close();
    // Google Maps handles its own cleanup via Angular component lifecycle
  }

  // --- Availability ---

  loadAvailability() {
    this.agentDashboardApi.getAvailability().subscribe({
      next: (data) => this.availability = data,
      error: () => {},
    });
  }

  toggleAcceptingLeads() {
    if (!this.availability) return;
    this.availabilityLoading = true;
    const newVal = !this.availability.is_accepting_leads;
    this.agentDashboardApi.updateAvailability({ is_accepting_leads: newVal }).subscribe({
      next: (data) => {
        this.availability = data;
        this.availabilityLoading = false;
        this.snackBar.open(
          newVal ? 'Now accepting leads' : 'Paused lead intake',
          '', { duration: 2000 },
        );
      },
      error: () => {
        this.availabilityLoading = false;
        this.snackBar.open('Failed to update availability', '', { duration: 3000 });
      },
    });
  }

  startEditDailyLimit() {
    this.editingDailyLimit = true;
    this.editDailyLimit = this.availability?.daily_lead_limit ?? null;
  }

  cancelEditDailyLimit() {
    this.editingDailyLimit = false;
  }

  saveDailyLimit() {
    this.availabilityLoading = true;
    const limit = this.editDailyLimit && this.editDailyLimit > 0 ? this.editDailyLimit : 0;
    this.agentDashboardApi.updateAvailability({ daily_lead_limit: limit }).subscribe({
      next: (data) => {
        this.availability = data;
        this.editingDailyLimit = false;
        this.availabilityLoading = false;
        this.snackBar.open('Daily limit updated', '', { duration: 2000 });
      },
      error: () => {
        this.availabilityLoading = false;
        this.snackBar.open('Failed to update daily limit', '', { duration: 3000 });
      },
    });
  }

  // --- KPIs ---

  loadKpis() {
    if (this.useMockData) {
      this.kpis = [
        { label: 'Active Leads', value: 12, icon: 'assignment', trend: 'up', trendValue: '+3 today' },
        { label: 'Accepted Today', value: 4, icon: 'check_circle', trend: 'up', trendValue: '+1 today' },
        { label: 'Leads Pending', value: 7, icon: 'hourglass_empty', trend: 'down', trendValue: '-2 today' },
        { label: 'Escalations', value: 2, icon: 'priority_high', trend: 'flat', trendValue: 'No change' },
        { label: 'Claims Open', value: 18, icon: 'folder_open', trend: 'up', trendValue: '+5 today' },
        { label: 'Claims Closed', value: 43, icon: 'task_alt', trend: 'up', trendValue: '+8 today' },
      ];
      this.lastRefreshTime = new Date();
    } else {
      this.loadRealKpis();
    }
  }

  private loadRealKpis() {
    this.dashboardService.getLeadsByStatus().subscribe(leads => {
      const leadsMap = new Map<string, number>();
      if (Array.isArray(leads)) {
        leads.forEach((el: any) => leadsMap.set(el.status?.toLowerCase(), el.leads_count || 0));
      }

      this.dashboardService.getClaimsCountByPhase().subscribe(claims => {
        let openClaims = 0;
        let closedClaims = 0;
        if (Array.isArray(claims)) {
          claims.forEach((el: any) => {
            const phase = (el.current_phase || '').toLowerCase();
            if (phase === 'closed' || phase === 'completed') {
              closedClaims += el.claims_count || 0;
            } else {
              openClaims += el.claims_count || 0;
            }
          });
        }

        const active = Array.from(leadsMap.values()).reduce((a, b) => a + b, 0);
        const accepted = leadsMap.get('accepted') || 0;
        const pending = leadsMap.get('pending') || leadsMap.get('new') || 0;
        const escalated = leadsMap.get('escalated') || 0;

        this.kpis = [
          { label: 'Active Leads', value: active, icon: 'assignment', trend: 'flat', trendValue: '' },
          { label: 'Accepted Today', value: accepted, icon: 'check_circle', trend: 'flat', trendValue: '' },
          { label: 'Leads Pending', value: pending, icon: 'hourglass_empty', trend: 'flat', trendValue: '' },
          { label: 'Escalations', value: escalated, icon: 'priority_high', trend: 'flat', trendValue: '' },
          { label: 'Claims Open', value: openClaims, icon: 'folder_open', trend: 'flat', trendValue: '' },
          { label: 'Claims Closed', value: closedClaims, icon: 'task_alt', trend: 'flat', trendValue: '' },
        ];
        this.lastRefreshTime = new Date();
      });
    });
  }

  // --- Map ---

  onMapReady() {
    this.mapReady = true;
    this.mapLoaded = true;

    // Render existing activities if already loaded
    const current = this.liveActivity.activities$.getValue();
    if (current.length > 0) {
      const filtered = this.applyTerritoryFilter(current);
      this.renderActivityMarkers(filtered);
    }
  }

  private renderActivityMarkers(items: LiveActivityItem[]) {
    if (!this.mapReady) return;

    const markers: typeof this.mapMarkers = [];
    const boundsCoords: google.maps.LatLngLiteral[] = [];

    // Incident markers
    const mappable = items.filter(
      i => i.latitude != null && i.longitude != null && MAPPABLE_EVENT_TYPES.includes(i.eventType)
    );

    for (const item of mappable) {
      const color = MARKER_COLORS[item.eventType] || MARKER_COLORS['fire_incident'];
      const pos: google.maps.LatLngLiteral = { lat: item.latitude!, lng: item.longitude! };
      markers.push({
        position: pos,
        options: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        },
        popupHtml: `
          <div style="min-width:180px;">
            <strong>${this.escapeHtml(item.label)}</strong><br/>
            <small>${this.escapeHtml(item.sublabel || '')}</small><br/>
            <small>${item.timestamp.toLocaleTimeString()}</small>
          </div>
        `,
      });
      boundsCoords.push(pos);
    }

    // Lead markers
    for (const lead of this.assignedLeads) {
      if (lead.latitude == null || lead.longitude == null) continue;
      const color = LEAD_MARKER_COLORS[lead.status] || LEAD_MARKER_COLORS['pending'];
      const pos: google.maps.LatLngLiteral = { lat: lead.latitude, lng: lead.longitude };
      markers.push({
        position: pos,
        options: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        },
        popupHtml: `
          <div style="min-width:180px;">
            <strong>${this.escapeHtml(lead.refString)}</strong><br/>
            <small>${this.escapeHtml(lead.contactName)}</small><br/>
            <small>${this.escapeHtml(lead.address)}</small><br/>
            <small>Status: ${lead.status}</small>
          </div>
        `,
      });
      boundsCoords.push(pos);
    }

    this.mapMarkers = markers;

    // Auto-fit map bounds to visible markers
    if (boundsCoords.length > 0 && this.googleMap?.googleMap) {
      const bounds = new google.maps.LatLngBounds();
      boundsCoords.forEach(c => bounds.extend(c));
      this.googleMap.googleMap.fitBounds(bounds, 40);
    }
  }

  onMarkerClick(marker: google.maps.Marker | any, idx: number) {
    const m = this.mapMarkers[idx];
    if (!m || !this.googleMap?.googleMap) return;
    if (!this.infoWindow) {
      this.infoWindow = new google.maps.InfoWindow();
    }
    this.infoWindow.setContent(m.popupHtml);
    this.infoWindow.setPosition(m.position);
    this.infoWindow.open(this.googleMap.googleMap);
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Lead Operations ---

  private loadRealLeads() {
    this.agentDashboardApi.getMyLeads().subscribe({
      next: (leads: AgentDashboardLead[]) => {
        const mapped: AssignedLead[] = leads.map(l => ({
          id: l.lead_id,
          refString: l.ref_string,
          contactName: l.contact_name,
          address: l.address || '',
          source: l.source_label,
          assignedAt: l.assigned_at ? new Date(l.assigned_at) : new Date(),
          expiresAt: l.timeout_at ? new Date(l.timeout_at) : new Date(Date.now() + this.escalationTimeoutSeconds * 1000),
          status: l.dashboard_status as AssignedLead['status'],
          remainingSeconds: l.remaining_seconds,
          state: l.state || undefined,
          county: l.county || undefined,
          zip_code: l.zip_code || undefined,
          latitude: l.latitude || undefined,
          longitude: l.longitude || undefined,
          escalation_level: l.escalation_level,
          escalation_label: l.escalation_label,
        }));

        this.assignedLeads = this.applyTerritoryFilter(mapped);

        // Re-render map markers with lead positions
        if (this.mapReady) {
          const activities = this.liveActivity.activities$.getValue();
          const filtered = this.applyTerritoryFilter(activities);
          this.renderActivityMarkers(filtered);
        }
      },
      error: () => {
        // Fallback to mock data on API error
        this.initMockLeads();
      },
    });
  }

  private initMockLeads() {
    const now = Date.now();
    const allLeads: AssignedLead[] = [
      { id: 'mock-1', refString: 'Lead #4821', contactName: 'Maria Gonzalez', address: '4521 Oak Ridge Dr, Dallas TX', source: 'UPA Incident Intelligence Network', assignedAt: new Date(now - 90000), expiresAt: new Date(now + 1725000), status: 'pending', remainingSeconds: 1725, state: 'TX', county: 'Dallas', zip_code: '75204' },
      { id: 'mock-2', refString: 'Lead #4819', contactName: 'Robert Chen', address: '912 Maple Ave, Fort Worth TX', source: 'UPA Incident Intelligence Network', assignedAt: new Date(now - 300000), expiresAt: new Date(now + 1500000), status: 'pending', remainingSeconds: 1500, state: 'TX', county: 'Tarrant', zip_code: '76104' },
      { id: 'mock-3', refString: 'Lead #4817', contactName: 'Sarah Kim', address: '7800 Greenville Ave, Dallas TX', source: 'UPA Incident Intelligence Network', assignedAt: new Date(now - 480000), expiresAt: new Date(now + 1320000), status: 'pending', remainingSeconds: 1320, state: 'TX', county: 'Dallas', zip_code: '75231' },
      { id: 'mock-4', refString: 'Lead #4815', contactName: 'James Wilson', address: '1200 Commerce St, Arlington TX', source: 'UPA Incident Intelligence Network', assignedAt: new Date(now - 600000), expiresAt: new Date(now + 600000), status: 'pending', remainingSeconds: 600, state: 'TX', county: 'Tarrant', zip_code: '76011' },
      { id: 'mock-5', refString: 'Lead #4812', contactName: 'Patricia Hernandez', address: '350 W 5th St, Denton TX', source: 'UPA Incident Intelligence Network', assignedAt: new Date(now - 900000), expiresAt: new Date(now + 180000), status: 'pending', remainingSeconds: 180, state: 'TX', county: 'Denton', zip_code: '76201' },
    ];

    this.assignedLeads = this.applyTerritoryFilter(allLeads);
  }

  private startLeadPolling() {
    this.leadPollSub = interval(this.leadPollIntervalMs).subscribe(() => {
      this.loadRealLeads();
    });
  }

  private startCountdown() {
    this.countdownInterval = setInterval(() => {
      this.zone.run(() => {
        for (const lead of this.assignedLeads) {
          if (lead.status !== 'pending') continue;
          const remaining = Math.max(0, Math.floor((lead.expiresAt.getTime() - Date.now()) / 1000));
          lead.remainingSeconds = remaining;
          if (remaining === 0) {
            lead.status = 'expired';
          }
        }
      });
    }, 1000);
  }

  formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  getTimerPct(lead: AssignedLead): number {
    return Math.max(0, Math.min(100, (lead.remainingSeconds / this.escalationTimeoutSeconds) * 100));
  }

  getTimerColor(lead: AssignedLead): string {
    const pct = this.getTimerPct(lead);
    if (pct > 50) return '#10B981';
    if (pct > 20) return '#F59E0B';
    return '#EF4444';
  }

  acceptLead(lead: AssignedLead) {
    // Optimistic update
    lead.status = 'accepted';

    this.agentDashboardApi.acceptLead(lead.id).subscribe({
      next: () => {
        this.snackBar.open(`${lead.refString} accepted`, 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      },
      error: () => {
        lead.status = 'pending';
        this.snackBar.open(`Failed to accept ${lead.refString}`, 'Retry', { duration: 5000, panelClass: 'snackbar-error' });
      },
    });
  }

  declineLead(lead: AssignedLead) {
    // Optimistic update
    lead.status = 'declined';

    this.agentDashboardApi.declineLead(lead.id).subscribe({
      next: () => {
        this.snackBar.open(`${lead.refString} declined`, 'OK', { duration: 3000, panelClass: 'snackbar-warn' });
      },
      error: () => {
        lead.status = 'pending';
        this.snackBar.open(`Failed to decline ${lead.refString}`, 'Retry', { duration: 5000, panelClass: 'snackbar-error' });
      },
    });
  }

  getLeadStatusClass(lead: AssignedLead): string {
    return `lead-${lead.status}`;
  }

  refresh() {
    this.loadKpis();
    this.loadRealLeads();
    this.lastRefreshTime = new Date();
  }

  // --- Ticker + Recent Feed helpers ---

  getEventEmoji(eventType: string): string {
    return this.eventDisplayMap[eventType]?.emoji || '📡';
  }

  getEventTypeLabel(eventType: string): string {
    return this.eventDisplayMap[eventType]?.typeLabel || 'Alert';
  }

  getEventColor(eventType: string): string {
    return this.eventDisplayMap[eventType]?.color || 'var(--text-tertiary)';
  }

  getTimeAgo(date: Date): string {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  }

  onTickerClick(item: LiveActivityItem) {
    if (item.latitude != null && item.longitude != null && this.googleMap?.googleMap) {
      this.googleMap.googleMap.panTo({ lat: item.latitude, lng: item.longitude });
      this.googleMap.googleMap.setZoom(14);
    }
    if (item.route) {
      this.router.navigateByUrl(item.route);
    }
  }

  onRecentIncidentClick(item: LiveActivityItem) {
    if (item.latitude != null && item.longitude != null && this.googleMap?.googleMap) {
      this.googleMap.googleMap.panTo({ lat: item.latitude, lng: item.longitude });
      this.googleMap.googleMap.setZoom(15);
    }
    if (item.route) {
      this.router.navigateByUrl(item.route);
    }
  }

  convertIncidentToLead(item: LiveActivityItem, event: MouseEvent) {
    event.stopPropagation();
    if (!item.entityId) return;

    this.fireIncidentService.getIncident(item.entityId).subscribe({
      next: (incident) => {
        this.dialog.open(ConvertToLeadDialogComponent, {
          data: { incident },
          width: '600px',
        });
      },
      error: () => {
        this.snackBar.open('Failed to load incident details', 'Close', { duration: 3000 });
      },
    });
  }
}
