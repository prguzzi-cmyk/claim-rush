import { Component, OnInit, OnDestroy, NgZone, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';
import { NgxPermissionsService } from 'ngx-permissions';
import { forkJoin, Subscription, interval, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { GoogleMap } from '@angular/google-maps';

import { CommunicationMetrics } from 'src/app/models/communication-log.model';
import { DashboardService } from 'src/app/services/dashboard.service';
import { FireIncidentService } from 'src/app/services/fire-incident.service';
import { UserService } from 'src/app/services/user.service';
import { DialogService } from 'src/app/services/dialog.service';
import { NewsletterService } from 'src/app/services/newsletter.service';
import { AnnouncementService } from 'src/app/services/announcement.service';
import { LiveActivityService } from 'src/app/services/live-activity.service';
import { LiveActivityItem } from 'src/app/models/live-activity.model';
import { GlobalVariable } from 'src/global';
import { FireIncident } from 'src/app/models/fire-incident.model';
import { EstimatingService } from 'src/app/services/estimating.service';
import { PlatformActivityService } from 'src/app/services/platform-activity.service';
import { ConvertToLeadDialogComponent } from '../../sections/fire-incidents/convert-to-lead-dialog/convert-to-lead-dialog.component';
import { NewsletterDialogComponent } from '../../dialogs/newsletter-dialog/newsletter-dialog.component';
import { AnnouncementDialogComponent } from '../../dialogs/announcement-dialog/announcement-dialog.component';

// Incident marker colors by type
const MARKER_COLORS: Record<string, string> = {
  fire: '#ef4444',
  storm: '#8b5cf6',
  crime: '#f59e0b',
  roof: '#0ea5e9',
  water: '#06b6d4',
  new: '#ff6b35',
  highlight: '#ffffff',
};

const WILDLAND_TYPES = ['VEG', 'WVEG', 'GF', 'OF', 'FF', 'WF', 'CB', 'IF'];
const SATELLITE_TYPES = ['SAT'];
// Removed: PROPERTY_DAMAGE_CALL_TYPES + PROPERTY_DAMAGE_KEYWORDS hard-coded
// whitelists. Backend's call_type_config.is_enabled is now the canonical
// filter (see loadIncidents and isPropertyDamageIncident below).

const REFRESH_INTERVAL_MS = 30000;
const NEW_INDICATOR_DURATION_MS = 300000;

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  providers: [DatePipe],
  standalone: false,
})
export class DashboardComponent implements OnInit, OnDestroy {
  role: string = 'agent';

  // ngx-charts config
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = true;
  showXAxisLabel = true;
  showYAxisLabel = true;
  colorScheme: object;

  // Chart data
  leadByStatusReportData: any = [];
  leadBySourceReportData: any = [];
  leadByUserReportData: any = [];
  claimByPhases: any = [];
  leadOutcomeBreakdownData: any = [];

  // Communication metrics
  communicationMetrics: CommunicationMetrics | null = null;

  // Agent performance
  agentPerformanceData: any[] = [];
  displayedColumnsPerformance: string[] = ['agent_name', 'total_leads_received', 'contact_attempts', 'no_answer', 'left_message', 'callbacks_pending', 'wants_info', 'appointments_scheduled', 'signed_clients', 'closing_rate'];
  dataSourcePerformance = new MatTableDataSource<any>();

  // Agent outcome breakdown
  agentOutcomeBreakdownData: any[] = [];

  // Outcome filters
  outcomeFilterAgentId: string = '';
  outcomeFilterState: string = '';
  outcomeFilterCounty: string = '';
  agentsList: any[] = [];

  // ═══════════════════════════════════════════════
  // KPI BAR — 5 command center metrics
  // ═══════════════════════════════════════════════
  // INTRO SCREEN
  // ═══════════════════════════════════════════════
  showIntro = false;
  introAllowAudio = false;

  private readonly INTRO_SEEN_KEY = 'cc-intro-seen';

  // ═══════════════════════════════════════════════
  firesToday = 0;
  newLeads = 0;
  aiCallsRunning = 0;
  activeClaims = 0;
  recoveryValue = 0;
  kpisLoading = true;

  // ═══════════════════════════════════════════════
  // LIVE INCIDENT MAP
  // ═══════════════════════════════════════════════
  @ViewChild(GoogleMap) googleMap!: GoogleMap;
  private mapReady = false;
  mapLoaded = false;
  private highlightedMarkerId: string | null = null;
  private infoWindow: google.maps.InfoWindow | null = null;

  mapCenter: google.maps.LatLngLiteral = { lat: 39.8283, lng: -98.5795 };
  mapZoom = 4;
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
  incidentMarkers: { position: google.maps.LatLngLiteral; options: google.maps.MarkerOptions; incident: FireIncident }[] = [];
  heatCircles: { center: google.maps.LatLngLiteral; radius: number; options: google.maps.CircleOptions }[] = [];

  // Incident state
  recentIncidents: FireIncident[] = [];
  allMapIncidents: FireIncident[] = [];
  incidentsLoading = true;
  totalPropertyIncidents = 0;

  private knownIncidentIds = new Set<string>();
  newIncidentIds = new Set<string>();
  private isFirstLoad = true;

  // Side panel
  selectedIncident: FireIncident | null = null;

  // Auto-refresh
  private refreshSub: Subscription | null = null;
  lastRefreshTime: Date | null = null;

  // ═══════════════════════════════════════════════
  // LIVE ACTIVITY FEED
  // ═══════════════════════════════════════════════
  activityFeed: LiveActivityItem[] = [];
  private activitySub: Subscription | null = null;

  // ═══════════════════════════════════════════════
  // AGENT OPERATIONS PANEL
  // ═══════════════════════════════════════════════
  activeAgents = 0;
  callsRunning = 0;
  leadsAssigned = 0;
  agentConversionPct = 0;

  // ═══════════════════════════════════════════════
  // DAMAGE HOTSPOTS (cluster circles on map)
  // ═══════════════════════════════════════════════
  hotspotData: { lat: number; lng: number; count: number }[] = [];

  // Claim Recovery shortcut
  recoveryData: any = null;

  // Notice board
  newsletters: any[] = [];
  announcements: any[] = [];
  dataSourceNewsletter = new MatTableDataSource();
  dataSourceAnnouncements = new MatTableDataSource();
  displayedColumnsNewsletters: string[] = ['title', 'publication_date'];
  displayedColumnsAnnouncements: string[] = ['title'];

  // Map filter
  mapIncidentFilter: string = 'all';

  constructor(
    private dashboardService: DashboardService,
    private fireIncidentService: FireIncidentService,
    private dialogService: DialogService,
    public userService: UserService,
    private ngxPermissionsService: NgxPermissionsService,
    private router: Router,
    private spinner: NgxSpinnerService,
    private newsletterService: NewsletterService,
    private announcementService: AnnouncementService,
    private datePipe: DatePipe,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private zone: NgZone,
    private estimatingService: EstimatingService,
    private liveActivityService: LiveActivityService,
    private platformActivityService: PlatformActivityService,
  ) {
    this.colorScheme = GlobalVariable.CHART_SCHEME;
    this.role = localStorage.getItem('role-name');

    if (this.role === 'agent' || this.role === 'call-center-agent') {
      this.router.navigate(['/app/agent-dashboard']);
    }
  }

  ngOnInit() {
    // Show intro on first login only (with audio enabled)
    if (!localStorage.getItem(this.INTRO_SEEN_KEY)) {
      this.showIntro = true;
      this.introAllowAudio = true;
    }

    // ── PHASE 1: Critical path — incidents, map, and activity feed ──
    // These load first and must succeed for the dashboard to be usable.
    console.log('[CC] Phase 1: Loading incidents + activity feed');
    this.loadIncidents();

    this.platformActivityService.startPolling(REFRESH_INTERVAL_MS);
    this.liveActivityService.startPolling(REFRESH_INTERVAL_MS);
    this.activitySub = this.liveActivityService.activities$.subscribe(items => {
      this.activityFeed = items.slice(0, 30);
    });

    // ── PHASE 2: Secondary KPIs and panels (non-blocking) ──
    // Each call has its own catchError — failures here never affect Phase 1.
    console.log('[CC] Phase 2: Loading KPIs + secondary panels');
    this.loadKpis();
    this.loadAgentOperations();
    this.getLeadsByStatus();
    this.getLeadsBySource();
    this.getLeadsByUser();
    this.getClaimsByStatus();
    this.getAgentPerformance();
    this.getLeadOutcomeBreakdown();
    this.getCommunicationMetrics();
    this.getAgentOutcomeBreakdown();
    this.loadAgentsList();

    // ── PHASE 3: Notice board (lightweight) ──
    console.log('[CC] Phase 3: Loading notice board');
    this.getNewsletters();
    this.getAnnouncements();

    // claim-recovery/dashboard DISABLED from Command Center load.
    // Endpoint: GET /claim-recovery/dashboard
    // Reason: Heavy query + SQLAlchemy session concurrency errors cause
    // transient 500s that show "issue getting a claim entity" in the
    // ErrorInterceptor snackbar, appearing to break the dashboard.
    // The recovery KPI tile will show $0 until this is re-enabled.
    // Access recovery data via the dedicated Claim Recovery page instead.
    this.recoveryValue = 0;
    this.recoveryData = null;

    // Auto-refresh: incidents always refresh; secondary panels are best-effort.
    this.refreshSub = interval(REFRESH_INTERVAL_MS).subscribe(() => {
      this.loadIncidents();
      this.loadKpis();
      this.loadAgentOperations();
    });
  }

  ngOnDestroy(): void {
    // Google Maps handles its own cleanup via Angular component lifecycle
    if (this.infoWindow) { this.infoWindow.close(); }
    if (this.refreshSub) { this.refreshSub.unsubscribe(); }
    if (this.activitySub) { this.activitySub.unsubscribe(); }
    this.liveActivityService.stopPolling();
    this.platformActivityService.stopPolling();
  }

  // ═══════════════════════════════════════════════
  // KPI LOADING
  // ═══════════════════════════════════════════════

  private getTodayMidnight(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  loadKpis() {
    this.kpisLoading = true;
    const t0 = performance.now();

    // Voice/campaign APIs temporarily disabled — aiCallsRunning stubbed to 0.
    // Reintroduce: add getActiveVoiceCallCount() back into forkJoin when voice system is stable.
    this.aiCallsRunning = 0;

    forkJoin({
      leads: this.dashboardService.getLeadsByStatus().pipe(
        catchError(err => { console.warn('[CC] KPI leads-count-by-status FAILED:', err?.status, err?.error?.detail || err?.message); return of([]); })
      ),
      claims: this.dashboardService.getClaimsCountByPhase().pipe(
        catchError(err => { console.warn('[CC] KPI claims-count-by-phase FAILED:', err?.status, err?.error?.detail || err?.message); return of([]); })
      ),
    }).subscribe({
      next: (res) => {
        this.newLeads = Array.isArray(res.leads)
          ? res.leads.reduce((sum: number, el: any) => sum + (el.leads_count || 0), 0)
          : 0;

        this.activeClaims = Array.isArray(res.claims)
          ? res.claims.reduce((sum: number, el: any) => sum + (el.claims_count || 0), 0)
          : 0;

        // firesToday is derived from the same incident dataset as the map
        // (set in loadIncidents → syncKpiFromIncidents) so it's always consistent.

        this.kpisLoading = false;
        this.lastRefreshTime = new Date();
        console.log('[CC] KPIs loaded in %dms — incidents:%d leads:%d claims:%d', Math.round(performance.now() - t0), this.firesToday, this.newLeads, this.activeClaims);
      },
      error: (err) => { this.kpisLoading = false; console.error('[CC] KPI forkJoin failed:', err); },
    });
  }

  /**
   * Called from loadIncidents() to ensure the firesToday KPI count
   * matches the exact same filtered dataset shown on the map.
   */
  private syncKpiFromIncidents(filteredCount: number): void {
    this.firesToday = filteredCount;
  }

  // ═══════════════════════════════════════════════
  // AGENT OPERATIONS PANEL
  // ═══════════════════════════════════════════════

  loadAgentOperations() {
    this.dashboardService.getAgentPerformance('current-year').pipe(catchError(() => of([]))).subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          this.activeAgents = data.length;
          this.leadsAssigned = data.reduce((s, a) => s + (a.total_leads_received || 0), 0);
          const totalSigned = data.reduce((s, a) => s + (a.signed_clients || 0), 0);
          this.agentConversionPct = this.leadsAssigned > 0
            ? Math.round((totalSigned / this.leadsAssigned) * 100)
            : 0;
        }
      },
    });
  }

  // ═══════════════════════════════════════════════
  // INCIDENT LOADING WITH INCREMENTAL DIFF
  // ═══════════════════════════════════════════════

  loadIncidents() {
    if (this.isFirstLoad) this.incidentsLoading = true;
    const today = this.getTodayMidnight();
    const t0 = performance.now();

    // No call_type whitelist — the backend auto-filters to
    // call_type_config.is_enabled codes which is the canonical, admin-
    // editable source of truth. The previous hard-coded
    // PROPERTY_DAMAGE_CALL_TYPES list excluded every active ingestion
    // source's actual codes (socrata=911, NIFC=WF) → 0 results.
    this.dashboardService.getRecentFireIncidents(1, 500, today).pipe(
      catchError(err => {
        console.warn('[CC] fire-incidents FAILED:', err?.status, '— retry once');
        return this.dashboardService.getRecentFireIncidents(1, 200, today).pipe(
          catchError(err2 => {
            console.warn('[CC] fire-incidents retry also FAILED:', err2?.status);
            return of({ items: [], total: 0 });
          })
        );
      })
    ).subscribe({
      next: (res) => {
        const items: FireIncident[] = res?.items || [];
        this.totalPropertyIncidents = res?.total || 0;
        const filtered = items.filter(i => this.isPropertyDamageIncident(i));

        // If API returned zero incidents, populate the map from the live
        // activity feed so every panel stays consistent.
        if (filtered.length === 0) {
          this.populateMapFromActivityFeed();
          this.incidentsLoading = false;
          this.lastRefreshTime = new Date();
          this.isFirstLoad = false;
          return;
        }

        const incomingIds = new Set(filtered.map(i => i.id));
        const brandNewIds: string[] = [];
        if (!this.isFirstLoad) {
          for (const id of incomingIds) {
            if (!this.knownIncidentIds.has(id)) brandNewIds.push(id);
          }
        }
        this.knownIncidentIds = incomingIds;
        for (const id of brandNewIds) this.newIncidentIds.add(id);
        this.clearExpiredNewIndicators(filtered);

        this.allMapIncidents = filtered.filter(i => i.latitude != null && i.longitude != null);
        this.recentIncidents = filtered.slice(0, 20);
        this.syncKpiFromIncidents(filtered.length);
        this.incidentsLoading = false;
        this.lastRefreshTime = new Date();

        // Compute hotspots
        this.computeHotspots();

        if (this.mapReady) {
          if (this.isFirstLoad || brandNewIds.length === 0) {
            this.renderMarkers();
          } else {
            this.addNewMarkers(filtered.filter(i => brandNewIds.includes(i.id)));
          }
        }

        if (!this.isFirstLoad && brandNewIds.length > 0) {
          this.zone.run(() => {
            this.snackBar.open(
              `${brandNewIds.length} new incident${brandNewIds.length > 1 ? 's' : ''} detected`,
              'View', { duration: 5000, panelClass: 'new-incident-snackbar' }
            );
          });
        }

        this.isFirstLoad = false;
        console.log('[CC] Incidents loaded in %dms — %d total, %d on map, %d new', Math.round(performance.now() - t0), filtered.length, this.allMapIncidents.length, brandNewIds.length);
      },
    });
  }

  /**
   * When the fire-incidents API returns nothing, derive map markers
   * from the activity feed so all Dashboard panels show the same data.
   */
  private populateMapFromActivityFeed(): void {
    const feedItems = this.activityFeed.length > 0
      ? this.activityFeed
      : this.liveActivityService.activities$.getValue();

    const synthIncidents: FireIncident[] = feedItems
      .filter(a => a.latitude != null && a.longitude != null)
      .map(a => ({
        id: a.id,
        call_type: a.eventType === 'fire_incident' ? 'SF' : a.eventType === 'storm_alert' || a.eventType === 'hail_alert' || a.eventType === 'wind_alert' || a.eventType === 'lightning_alert' ? 'WF' : 'FA',
        call_type_description: a.label?.split(' — ')[0] || a.eventType,
        address: a.label?.split(' — ')[1] || '',
        latitude: a.latitude,
        longitude: a.longitude,
        received_at: a.timestamp instanceof Date ? a.timestamp.toISOString() : a.timestamp,
        lead_id: null,
        is_active: true,
      } as any));

    this.allMapIncidents = synthIncidents;
    this.recentIncidents = synthIncidents.slice(0, 20);
    this.totalPropertyIncidents = synthIncidents.length;

    // Update KPI to match
    this.firesToday = synthIncidents.filter(i => !WILDLAND_TYPES.includes(i.call_type)).length;

    this.computeHotspots();
    if (this.mapReady) this.renderMarkers();
  }

  private isPropertyDamageIncident(incident: FireIncident): boolean {
    // Backend already auto-filters to call_type_config.is_enabled codes.
    // We just exclude the known wildland/satellite types so the dashboard
    // map keeps its "property fires" focus distinct from satellite/forest.
    const code = (incident.call_type || '').toUpperCase();
    if (WILDLAND_TYPES.includes(code) || SATELLITE_TYPES.includes(code)) {
      return false;
    }
    return true;
  }

  private clearExpiredNewIndicators(incidents: FireIncident[]): void {
    const cutoff = Date.now() - NEW_INDICATOR_DURATION_MS;
    let changed = false;
    for (const id of Array.from(this.newIncidentIds)) {
      const inc = incidents.find(i => i.id === id);
      if (inc?.received_at) {
        if (new Date(inc.received_at).getTime() < cutoff) {
          this.newIncidentIds.delete(id);
          changed = true;
        }
      }
    }
    // Re-render markers to update colors for expired "new" indicators
    if (changed && this.mapReady) this.renderMarkers();
  }

  isNewIncident(incidentId: string): boolean {
    return this.newIncidentIds.has(incidentId);
  }

  // ═══════════════════════════════════════════════
  // MAP
  // ═══════════════════════════════════════════════

  onMapReady(): void {
    this.mapReady = true;
    this.mapLoaded = true;
    this.infoWindow = new google.maps.InfoWindow();

    if (this.allMapIncidents.length > 0) this.renderMarkers();
  }

  renderMarkers(): void {
    if (!this.mapReady) return;
    this.highlightedMarkerId = null;
    this.incidentMarkers = [];

    for (const incident of this.allMapIncidents) {
      if (incident.latitude == null || incident.longitude == null) continue;
      const isNew = this.newIncidentIds.has(incident.id);
      const color = isNew ? MARKER_COLORS.new : this.getMarkerColor(incident.call_type);
      this.incidentMarkers.push({
        position: { lat: incident.latitude, lng: incident.longitude },
        options: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: isNew ? 8 : 6,
            strokeColor: '#fff',
            fillColor: color,
            fillOpacity: 1,
            strokeWeight: 2,
          },
          title: incident.address || 'Incident',
          zIndex: isNew ? 100 : 10,
        },
        incident,
      });
    }

    this.fitBoundsToIncidents();
    this.renderHeatCircles();
  }

  onMarkerClick(incident: FireIncident): void {
    if (!this.googleMap?.googleMap || !this.infoWindow) return;
    const content = this.buildPopupHtml(incident);
    this.infoWindow.setContent(content);
    this.infoWindow.setPosition({ lat: incident.latitude!, lng: incident.longitude! });
    this.infoWindow.open(this.googleMap.googleMap);
  }

  private addNewMarkers(newIncidents: FireIncident[]): void {
    if (!this.mapReady) return;
    for (const incident of newIncidents) {
      if (incident.latitude == null || incident.longitude == null) continue;
      // Check if already in the markers array
      if (this.incidentMarkers.some(m => m.incident.id === incident.id)) continue;
      this.incidentMarkers.push({
        position: { lat: incident.latitude, lng: incident.longitude },
        options: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            strokeColor: '#fff',
            fillColor: MARKER_COLORS.new,
            fillOpacity: 1,
            strokeWeight: 2,
          },
          title: incident.address || 'Incident',
          zIndex: 100,
        },
        incident,
      });
    }
  }

  focusOnMap(incident: FireIncident): void {
    if (!this.googleMap?.googleMap) return;

    this.highlightedMarkerId = incident.id;

    if (incident.latitude != null && incident.longitude != null) {
      this.googleMap.googleMap.panTo({ lat: incident.latitude, lng: incident.longitude });
      this.googleMap.googleMap.setZoom(Math.max(this.googleMap.googleMap.getZoom() || 4, 15));
      // Show info window
      this.onMarkerClick(incident);
    }
  }

  navigateToLead(incident: FireIncident): void {
    if (incident.lead_id) {
      this.router.navigate(['/app/leads', incident.lead_id]);
    }
  }

  private getMarkerColor(callType: string | undefined): string {
    if (callType && WILDLAND_TYPES.includes(callType)) return MARKER_COLORS.storm;
    if (callType && SATELLITE_TYPES.includes(callType)) return MARKER_COLORS.roof;
    return MARKER_COLORS.fire;
  }

  private buildPopupHtml(incident: FireIncident): string {
    const receivedAt = incident.received_at ? new Date(incident.received_at).toLocaleString() : 'Unknown';
    const leadStatus = incident.lead_id
      ? '<span style="color:#16a34a;font-weight:600;">Converted to Lead</span>'
      : '<span style="color:#94a3b8;">Not yet converted</span>';
    return `
      <div style="padding:4px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${this.escapeHtml(incident.address || 'Unknown address')}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:4px;">${this.escapeHtml(incident.call_type_description || incident.call_type || 'Incident')}</div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Detected: ${this.escapeHtml(receivedAt)}</div>
        <div style="font-size:11px;">${leadStatus}</div>
      </div>
    `;
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private fitBoundsToIncidents(): void {
    if (!this.googleMap?.googleMap || this.allMapIncidents.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const inc of this.allMapIncidents) {
      if (inc.latitude == null || inc.longitude == null) continue;
      bounds.extend({ lat: inc.latitude, lng: inc.longitude });
    }
    this.googleMap.googleMap.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    google.maps.event.addListenerOnce(this.googleMap.googleMap, 'idle', () => {
      const z = this.googleMap.googleMap!.getZoom();
      if (z && z > 12) this.googleMap.googleMap!.setZoom(12);
    });
  }

  // ═══════════════════════════════════════════════
  // DAMAGE HOTSPOTS
  // ═══════════════════════════════════════════════

  private computeHotspots(): void {
    const grid = new Map<string, { lat: number; lng: number; count: number }>();
    const precision = 10;

    for (const inc of this.allMapIncidents) {
      if (inc.latitude == null || inc.longitude == null) continue;
      const key = `${Math.round(inc.latitude * precision) / precision},${Math.round(inc.longitude * precision) / precision}`;
      if (!grid.has(key)) {
        grid.set(key, { lat: inc.latitude, lng: inc.longitude, count: 0 });
      }
      grid.get(key)!.count++;
    }

    this.hotspotData = Array.from(grid.values())
      .filter(h => h.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private renderHeatCircles(): void {
    this.heatCircles = this.hotspotData.map(spot => {
      const radius = Math.min(2000 + spot.count * 1500, 15000);
      const opacity = Math.min(0.08 + spot.count * 0.03, 0.25);
      return {
        center: { lat: spot.lat, lng: spot.lng },
        radius,
        options: {
          strokeColor: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: opacity,
          strokeWeight: 1,
          strokeOpacity: 0.2,
        },
      };
    });
  }

  // ═══════════════════════════════════════════════
  // LIVE ACTIVITY FEED HELPERS
  // ═══════════════════════════════════════════════

  getActivityIcon(eventType: string): string {
    const map: Record<string, string> = {
      fire_incident: 'local_fire_department',
      storm_alert: 'thunderstorm',
      hail_alert: 'grain',
      wind_alert: 'air',
      lightning_alert: 'flash_on',
      lead_created: 'person_add',
      lead_assigned: 'assignment_ind',
      lead_escalated: 'trending_up',
      agent_accepted: 'check_circle',
      client_signed: 'how_to_reg',
      voice_call: 'phone_in_talk',
      claim_opened: 'description',
      skip_trace_completed: 'search',
      notification_sent: 'send',
      system_alert: 'warning',
    };
    return map[eventType] || 'circle';
  }

  getActivityColor(eventType: string): string {
    const map: Record<string, string> = {
      fire_incident: '#ef4444',
      storm_alert: '#8b5cf6',
      hail_alert: '#06b6d4',
      wind_alert: '#64748b',
      lightning_alert: '#eab308',
      lead_created: '#3b82f6',
      lead_assigned: '#6366f1',
      lead_escalated: '#f97316',
      agent_accepted: '#22c55e',
      client_signed: '#10b981',
      voice_call: '#0ea5e9',
      claim_opened: '#8b5cf6',
      skip_trace_completed: '#64748b',
      notification_sent: '#94a3b8',
      system_alert: '#f59e0b',
    };
    return map[eventType] || '#64748b';
  }

  getActivityTypeLabel(eventType: string): string {
    const map: Record<string, string> = {
      fire_incident: 'Incident Detected',
      storm_alert: 'Storm Alert',
      hail_alert: 'Hail Detected',
      wind_alert: 'Wind Alert',
      lightning_alert: 'Lightning',
      lead_created: 'Lead Created',
      lead_assigned: 'Lead Assigned',
      lead_escalated: 'Lead Escalated',
      agent_accepted: 'Agent Accepted',
      client_signed: 'Client Signed',
      voice_call: 'AI Call Started',
      claim_opened: 'Claim Opened',
      skip_trace_completed: 'Skip Trace Done',
      notification_sent: 'Notification',
      system_alert: 'System Alert',
    };
    return map[eventType] || eventType;
  }

  onActivityClick(item: LiveActivityItem): void {
    if (item.route) {
      this.router.navigate(['/app' + item.route]);
    }
  }

  // ═══════════════════════════════════════════════
  // SIDE PANEL & ACTIONS
  // ═══════════════════════════════════════════════

  onViewIntel(incident: FireIncident): void {
    this.selectedIncident = incident;
  }

  closeIntelPanel(): void {
    this.selectedIncident = null;
  }

  onConvertToLead(incident: FireIncident): void {
    if (incident.lead_id) {
      this.snackBar.open('This incident has already been converted to a lead.', 'Close', { duration: 3000 });
      return;
    }
    const ref = this.dialog.open(ConvertToLeadDialogComponent, { width: '550px', data: { incident } });
    ref.afterClosed().subscribe((result) => {
      if (result?.converted) {
        this.snackBar.open('Incident converted to lead successfully!', 'Close', { duration: 3000 });
        this.loadIncidents();
        this.loadKpis();
      }
    });
  }

  refreshAll(): void {
    console.group('[Command Center] Manual refresh triggered');
    // Core real-time data
    this.loadKpis();
    this.loadIncidents();
    this.loadAgentOperations();
    // loadRecoveryData() disabled — see Phase 3 comment in ngOnInit

    // Force activity feed re-fetch
    this.platformActivityService.refresh();
    this.liveActivityService.forceRefresh();

    // Charts and tables
    this.getLeadsByStatus();
    this.getLeadsBySource();
    this.getLeadsByUser();
    this.getClaimsByStatus();
    this.getAgentPerformance();
    this.getLeadOutcomeBreakdown();
    this.getCommunicationMetrics();
    this.getAgentOutcomeBreakdown();

    // Notice board
    this.getNewsletters();
    this.getAnnouncements();
    console.groupEnd();
  }

  // ═══════════════════════════════════════════════
  // INTRO CONTROLS
  // ═══════════════════════════════════════════════

  onIntroComplete(): void {
    this.showIntro = false;
    localStorage.setItem(this.INTRO_SEEN_KEY, 'true');
  }

  replayIntro(): void {
    this.showIntro = true;
    this.introAllowAudio = true; // Manual trigger allows audio
  }

  // ═══════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════

  getRelativeTime(dateStr: string | Date | null): string {
    if (!dateStr) return 'Unknown';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  getCallTypeEmoji(callType: string): string {
    if (WILDLAND_TYPES.includes(callType)) return '🌲';
    if (SATELLITE_TYPES.includes(callType)) return '🛰️';
    return '🔥';
  }

  getCallTypeBadgeClass(callType: string): string {
    if (WILDLAND_TYPES.includes(callType)) return 'badge-wildland';
    if (SATELLITE_TYPES.includes(callType)) return 'badge-satellite';
    return 'badge-structure';
  }

  fmtCurrency(val: number): string {
    if (val == null) return '$0';
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  axisFormatShowNumbers(val) {
    if (val % 1 === 0) return val.toLocaleString();
    return '';
  }

  formatOutcomeLabel(status: string): string {
    return status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ═══════════════════════════════════════════════
  // EXISTING CHART / DATA METHODS (preserved)
  // ═══════════════════════════════════════════════

  getLeadsByStatus() {
    this.dashboardService.getLeadsByStatus().pipe(catchError(() => of([]))).subscribe(response => {
      if (response !== undefined) {
        this.leadByStatusReportData = [];
        response.forEach(element => {
          this.leadByStatusReportData = [...this.leadByStatusReportData, { name: element.status, value: element.leads_count }];
        });
      }
    });
  }

  getLeadsBySource() {
    this.dashboardService.getLeadsBySource().pipe(catchError(() => of([]))).subscribe(response => {
      if (response !== undefined) {
        this.leadBySourceReportData = [];
        response.forEach(element => {
          this.leadBySourceReportData = [...this.leadBySourceReportData, { name: element.user_name + (element.source_info ? ' (' + element.source_info + ')' : ''), value: element.leads_count }];
        });
      }
    });
  }

  getLeadsByUser() {
    this.dashboardService.getLeadsByUser().pipe(catchError(() => of([]))).subscribe(response => {
      if (response !== undefined) {
        this.leadByUserReportData = [];
        response.forEach(element => {
          this.leadByUserReportData = [...this.leadByUserReportData, { name: element?.display_name, value: element?.leads_count }];
        });
      }
    });
  }

  getClaimsByStatus() {
    this.dashboardService.getClaimsCountByPhase().pipe(catchError(() => of([]))).subscribe(response => {
      if (response !== undefined) {
        this.claimByPhases = [];
        response.forEach(element => {
          this.claimByPhases = [...this.claimByPhases, { name: element.current_phase, value: element.claims_count }];
        });
      }
    });
  }

  private getOutcomeFilters(): { agent_id?: string; state?: string; county?: string } {
    const filters: any = {};
    if (this.outcomeFilterAgentId) filters.agent_id = this.outcomeFilterAgentId;
    if (this.outcomeFilterState) filters.state = this.outcomeFilterState;
    if (this.outcomeFilterCounty) filters.county = this.outcomeFilterCounty;
    return filters;
  }

  onOutcomeFilterChange() {
    this.getAgentPerformance();
    this.getLeadOutcomeBreakdown();
    this.getAgentOutcomeBreakdown();
  }

  loadAgentsList() {
    this.userService.getUsersByRole('agent').pipe(catchError(() => of({ items: [] }))).subscribe(response => {
      this.agentsList = response?.items || [];
    });
  }

  getAgentPerformance() {
    const filters = this.getOutcomeFilters();
    this.dashboardService.getAgentPerformance('current-year', filters).pipe(catchError(() => of([]))).subscribe(response => {
      if (response !== undefined) {
        this.agentPerformanceData = response;
        this.dataSourcePerformance = new MatTableDataSource(response);
      }
    });
  }

  getCommunicationMetrics() {
    this.dashboardService.getCommunicationMetrics().pipe(catchError(() => of(null))).subscribe(response => {
      if (response !== undefined) this.communicationMetrics = response;
    });
  }

  getLeadOutcomeBreakdown() {
    const filters = this.getOutcomeFilters();
    this.dashboardService.getLeadOutcomeBreakdown('current-year', filters).pipe(catchError(() => of([]))).subscribe(response => {
      if (response !== undefined) {
        this.leadOutcomeBreakdownData = [];
        response.forEach(element => {
          this.leadOutcomeBreakdownData = [...this.leadOutcomeBreakdownData, { name: element.outcome_status, value: element.count }];
        });
      }
    });
  }

  getAgentOutcomeBreakdown() {
    const filters = this.getOutcomeFilters();
    this.dashboardService.getAgentOutcomeBreakdown('current-year', filters).pipe(catchError(() => of([]))).subscribe(response => {
      if (response !== undefined) this.agentOutcomeBreakdownData = response;
    });
  }

  loadRecoveryData() {
    this.estimatingService.getClaimRecoveryDashboard().pipe(
      catchError(err => {
        console.warn('[CC] claim-recovery/dashboard FAILED:', err?.status, err?.error?.detail || err?.message);
        return of(null);
      })
    ).subscribe({
      next: (data) => {
        this.recoveryData = data;
        this.recoveryValue = data?.total_recoverable || 0;
        if (data) console.log('[CC] Recovery data loaded — %d claims, $%s recoverable', data.total_claims || 0, (data.total_recoverable || 0).toLocaleString());
      },
    });
  }

  getNewsletters() {
    this.newsletterService.getNewsletters().pipe(catchError(() => of({ items: [] }))).subscribe(response => {
      if (response?.items) {
        this.newsletters = response.items;
        this.dataSourceNewsletter = response.items;
      }
    });
  }

  getAnnouncements() {
    this.announcementService.getAnnouncements().pipe(catchError(() => of({ items: [] }))).subscribe(response => {
      if (response?.items) {
        this.announcements = response.items;
        this.dataSourceAnnouncements = new MatTableDataSource(
          response.items.filter(row => row.announcement_date <= this.datePipe.transform(new Date(), 'yyyy-MM-dd'))
        );
      }
    });
  }

  openViewNewsletterDialog(newsletter: any) {
    this.dialogService.openDialog(NewsletterDialogComponent, { type: 'open', newsletter });
  }

  openViewAnnouncementDialog(announcement: any) {
    this.dialogService.openDialog(AnnouncementDialogComponent, { type: 'open', announcement });
  }
}
