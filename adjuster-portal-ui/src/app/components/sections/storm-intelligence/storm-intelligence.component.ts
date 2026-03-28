import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of, forkJoin } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { GoogleMap } from '@angular/google-maps';
import {
  StormEvent,
  StormTargetArea,
  StormKpiSummary,
  StormFilterState,
  StormEventType,
  OutreachBatchPayload,
  ZipBoundaryCollection,
  ImpactedProperty,
  RoofAnalysisResult,
  OutreachTarget,
  OutreachPack,
} from '../../../models/storm-event.model';
import { StormDataService } from '../../../services/storm-data.service';
import { PotentialClaimsService } from '../../../services/potential-claims.service';
import { ExcelService } from '../../../services/excel.service';
import { EVENT_COLORS, SEVERITY_COLORS, SEVERITY_COLOR_DEFAULT, ZIP_BOUNDARY_COLOR, PROPERTIES_COLOR, DAMAGE_SCORE_COLORS } from '../../../config/event-colors';
import { US_COUNTIES } from '../../../config/us-counties';

// ── Potential Claims Rolling In — Types ──────────────────────────

type ClaimEventType = 'hail' | 'wind' | 'lightning' | 'tornado' | 'flooding' | 'fire';
type ClaimSeverity = 'critical' | 'high' | 'moderate' | 'monitor';
type ClaimPriority = 'P1' | 'P2' | 'P3' | 'P4';

interface PredictedClaimEvent {
  id: string; eventType: ClaimEventType; city: string; state: string; county: string;
  timestamp: Date; severity: ClaimSeverity; claimProbability: number;
  territoryId: string | null; territoryName: string | null;
  description: string; source: string;
}

interface PredictedClaimZone {
  id: string; name: string; eventType: ClaimEventType;
  center: [number, number]; radiusMeters: number;
  severity: ClaimSeverity; priority: ClaimPriority; claimProbability: number;
  estimatedHomesAffected: number; affectedZips: string[];
  county: string; state: string;
  territoryId: string | null; territoryName: string | null;
  trajectory: string; linkedPropertyIds: string[];
  timestamp: Date; active: boolean;
  autoLeadGenerated?: boolean;
}

interface ClaimTickerMessage {
  id: string; text: string; severity: ClaimSeverity; timestamp: Date;
}

@Component({
  selector: 'app-storm-intelligence',
  templateUrl: './storm-intelligence.component.html',
  styleUrls: ['./storm-intelligence.component.scss'],
  standalone: false,
})
export class StormIntelligenceComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  private mapReady = false;
  mapLoaded = false;
  private autoRefreshInterval: ReturnType<typeof setInterval> | null = null;

  // Feed auto-scroll
  @ViewChild('feedList') feedListRef!: ElementRef<HTMLDivElement>;
  @ViewChild(GoogleMap) googleMap!: GoogleMap;
  private feedScrollInterval: ReturnType<typeof setInterval> | null = null;
  private infoWindow: google.maps.InfoWindow | null = null;

  // Google Maps config
  mapCenter: google.maps.LatLngLiteral = { lat: 37.5, lng: -98.0 };
  mapZoom = 5;
  mapOptions: google.maps.MapOptions = {
    mapTypeId: 'hybrid',
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [],
  };

  // Data arrays for declarative map elements
  hailCircles: { center: google.maps.LatLngLiteral; radius: number; options: google.maps.CircleOptions; event: StormEvent }[] = [];
  windCircles: { center: google.maps.LatLngLiteral; radius: number; options: google.maps.CircleOptions; event: StormEvent }[] = [];
  tornadoCircles: { center: google.maps.LatLngLiteral; radius: number; options: google.maps.CircleOptions; event: StormEvent }[] = [];
  hurricaneCircles: { center: google.maps.LatLngLiteral; radius: number; options: google.maps.CircleOptions; event: StormEvent }[] = [];
  hurricanePolylines: { path: google.maps.LatLngLiteral[]; options: google.maps.PolylineOptions }[] = [];
  hurricaneTrackPoints: { position: google.maps.LatLngLiteral; options: google.maps.MarkerOptions }[] = [];
  lightningCircles: { center: google.maps.LatLngLiteral; radius: number; options: google.maps.CircleOptions; event: StormEvent }[] = [];
  propertyMarkerItems: { position: google.maps.LatLngLiteral; options: google.maps.MarkerOptions; popupHtml: string }[] = [];
  claimZoneCircles: { center: google.maps.LatLngLiteral; radius: number; options: google.maps.CircleOptions; zone: PredictedClaimZone }[] = [];
  claimZoneExtraMarkers: { position: google.maps.LatLngLiteral; options: google.maps.MarkerOptions; zone: PredictedClaimZone }[] = [];

  // ZIP layer (imperative via Google Maps Data API)
  private zipDataLayer: google.maps.Data | null = null;

  // Layer visibility
  layerVisible: Record<string, boolean> = {
    hail: true,
    wind: true,
    tornado: true,
    hurricane: true,
    lightning: true,
  };

  // ZIP layer state
  zipLayerVisible = false;
  zipLayerLoading = false;
  impactedZips: { zip_code: string; event_count: number; event_types: string[]; state: string; county: string }[] = [];
  selectedZips = new Set<string>();
  // (ZIP layer managed imperatively via zipDataLayer above)

  // Properties layer state
  propertiesLayerVisible = true;
  propertiesLoading = false;
  impactedProperties: ImpactedProperty[] = [];
  activePropertiesEvent: StormEvent | null = null;

  // Roof analysis state
  roofAnalysisLoading = false;
  roofAnalysisResults = new Map<string, RoofAnalysisResult>();
  roofAnalysisRun = false;

  // Outreach pack state
  outreachPack: OutreachPack | null = null;
  outreachLoading = false;
  outreachDamageThreshold = 30;

  // Outreach targeting filters
  filteredOutreachTargets: OutreachTarget[] = [];
  outreachMinScore = 70;
  outreachConfidenceFilter: 'all' | 'low' | 'medium' | 'high' = 'high';
  outreachPropertyTypeFilter: 'all' | 'residential' | 'commercial' = 'all';
  outreachSortBy: 'score' | 'recent' | 'distance' = 'score';

  // Outreach summary stats (computed on filter)
  outreachAvgScore = 0;
  outreachSevereCount = 0;

  // Data source indicators
  isLiveStormData = false;
  stormApiError: string | null = null;  // null = no error, string = error message
  isLiveClaimsData = false;
  lastRefreshTime: Date | null = null;

  // Data
  kpi: StormKpiSummary | null = null;
  kpiLoading = true;
  events: StormEvent[] = [];
  targetAreas: StormTargetArea[] = [];
  targetPanelOpen = false;

  // Filter state
  filters: StormFilterState = {
    dateRange: '7d',
    eventTypes: [],
    state: '',
    county: '',
    minSeverity: '',
  };

  // Filter options
  dateRangeOptions = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '3d', label: 'Last 3 Days' },
    { value: '7d', label: 'Last 7 Days' },
  ];

  eventTypeOptions: { value: StormEventType; label: string }[] = [
    { value: 'hail', label: 'Hail' },
    { value: 'wind', label: 'Wind' },
    { value: 'tornado', label: 'Tornado' },
    { value: 'hurricane', label: 'Hurricane' },
    { value: 'lightning', label: 'Lightning' },
  ];

  states: string[] = [];
  counties: { name: string; eventCount: number }[] = [];
  private countyEventCounts = new Map<string, number>();

  // Storm feed placeholder
  recentAlerts: { title: string; source: string; time: string; type: StormEventType; latitude: number; longitude: number }[] = [];

  // Storm Desk feed
  stormDeskItems: {
    icon: string; label: string; type: StormEventType; time: string; probability?: number;
    latitude: number; longitude: number;
    claimEstimate: number; claimRange: string; riskLevel: 'critical' | 'high' | 'moderate' | 'low';
    claimProbability: number; county: string; state: string;
  }[] = [];

  // Radar blips
  radarBlips: { x: number; y: number; intensity: string }[] = [];

  // Intelligence ticker
  tickerItems: { icon: string; text: string; color: string }[] = [];

  // Live Feed
  liveFeedItems: {
    id: number;
    icon: string;
    eventType: string;
    county: string;
    state: string;
    riskScore: number;
    riskLevel: 'critical' | 'high' | 'moderate' | 'low';
    timestamp: string;
    isNew: boolean;
  }[] = [];
  private liveFeedInterval: ReturnType<typeof setInterval> | null = null;
  private liveFeedIdCounter = 0;

  // Potential Claims Rolling In
  predictedClaimEvents: PredictedClaimEvent[] = [];
  predictedClaimZones: PredictedClaimZone[] = [];
  claimTickerMessages: ClaimTickerMessage[] = [];
  selectedClaimZone: PredictedClaimZone | null = null;
  claimZonePanelOpen = false;
  predictedClaimZonesLayerVisible = true;
  private claimTickerInterval: ReturnType<typeof setInterval> | null = null;
  claimTickerPosition = 0;

  constructor(
    private stormService: StormDataService,
    private claimsService: PotentialClaimsService,
    private excelService: ExcelService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.stormService.getUniqueStates()
      .pipe(takeUntil(this.destroy$), catchError(() => of([] as string[])))
      .subscribe(states => this.states = states);
    this.loadData();
    this.autoRefreshInterval = setInterval(() => this.refreshStormIntel(), 45000);
    this.startFeedScroll();
    this.startLiveFeed();
    this.loadPredictedClaims();
  }

  ngAfterViewInit(): void {
    // Google Maps handles its own sizing
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
    if (this.feedScrollInterval) {
      clearInterval(this.feedScrollInterval);
    }
    if (this.liveFeedInterval) {
      clearInterval(this.liveFeedInterval);
    }
    if (this.claimTickerInterval) {
      clearInterval(this.claimTickerInterval);
    }
    if (this.infoWindow) this.infoWindow.close();
    if (this.zipDataLayer) {
      this.zipDataLayer.setMap(null);
      this.zipDataLayer = null;
    }
  }

  // ── Map Ready ────────────────────────────

  onMapReady(): void {
    this.mapReady = true;
    this.mapLoaded = true;

    // Render if events were loaded before map was ready
    if (this.events.length > 0) {
      this.renderMapLayers();
      this.fitMapToEvents();
    }
    this.renderPredictedClaimZones();
  }

  // ══════════════════════════════════════════════════════════════
  // DATA LOADING — SINGLE SOURCE OF TRUTH
  //
  // this.events is THE canonical dataset. Everything derives from it:
  //   KPI cards  → computeKpis()       → counts from this.events
  //   Map layers → renderMapLayers()   → markers from this.events
  //   Feed panel → buildRecentAlerts() → items from this.events
  //   Layer counts → getLayerCount()   → counts from this.events
  //
  // Predicted claims are a SEPARATE section with SEPARATE counts.
  // They are never merged into the storm KPI cards.
  // ══════════════════════════════════════════════════════════════

  loadData(): void {
    this.kpiLoading = true;
    let apiFailed = false;
    let apiErrorMsg: string | null = null;

    this.stormService.getStormEvents(this.filters)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          apiFailed = true;
          const status = err?.status || 0;
          const detail = err?.error?.detail || err?.message || 'Unknown error';
          apiErrorMsg = status === 403
            ? 'Permission denied — check your role permissions for Storm Intelligence'
            : status === 0
            ? 'Network error — cannot reach server'
            : `API error (${status}): ${detail}`;
          console.warn('[StormIntel] loadData error:', apiErrorMsg);
          return of([] as StormEvent[]);
        }),
      )
      .subscribe(events => {
        console.log('[StormIntel] subscribe fired — events.length:', events.length, 'apiFailed:', apiFailed);
        this.events = events;
        this.isLiveStormData = !apiFailed;
        this.stormApiError = apiErrorMsg;
        this.kpiLoading = false;
        this.lastRefreshTime = new Date();

        this.computeKpis();
        console.log('[StormIntel] KPIs:', JSON.stringify(this.kpi));
        this.buildRecentAlerts(events);
        this.buildInitialLiveFeed();

        // Refresh county event counts now that we have fresh data
        if (this.filters.state) this.buildCountyList();

        if (this.mapReady) {
          this.renderMapLayers();
          this.fitMapToEvents();
        }
      });

    this.stormService.getTargetAreas(this.filters)
      .pipe(takeUntil(this.destroy$), catchError(() => of([] as StormTargetArea[])))
      .subscribe(areas => this.targetAreas = areas);
  }

  /**
   * KPIs computed from storm events ONLY (this.events).
   * Respects layer visibility so toggling a layer updates the KPI.
   * Predicted claims are NOT included — they have their own counts.
   */
  computeKpis(): void {
    const visible = this.events.filter(e => this.layerVisible[e.event_type]);

    this.kpi = {
      hail_risk_areas: visible.filter(e => e.event_type === 'hail').length,
      wind_damage_alerts: visible.filter(e => e.event_type === 'wind' || e.event_type === 'tornado').length,
      hurricane_impact_zones: visible.filter(e => e.event_type === 'hurricane').length,
      lightning_clusters: visible.filter(e => e.event_type === 'lightning').length,
      total_events: visible.length,
      last_updated: new Date(),
    };
  }

  // ── Recent Alerts (Storm Intelligence feed) ───────────────────

  private buildRecentAlerts(events: StormEvent[]): void {
    const sorted = [...events].sort(
      (a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
    );
    this.recentAlerts = sorted.slice(0, 8).map(e => ({
      title: e.title,
      source: e.source,
      time: this.getRelativeTime(e.reported_at),
      type: e.event_type,
      latitude: e.latitude,
      longitude: e.longitude,
    }));
    this.buildStormDeskFeed(events);
    this.buildRadarBlips(events);
    this.buildTickerItems(events);
  }

  private buildStormDeskFeed(events: StormEvent[]): void {
    const items: typeof this.stormDeskItems = [];

    const iconMap: Record<StormEventType, string> = {
      hail: 'ac_unit',
      wind: 'air',
      hurricane: 'cyclone',
      lightning: 'bolt',
      tornado: 'cyclone',
    };

    const labelMap: Record<StormEventType, string> = {
      hail: 'Hail Probability',
      wind: 'Wind Damage Risk',
      hurricane: 'Hurricane Impact',
      lightning: 'Lightning Surge',
      tornado: 'Tornado Impact',
    };

    for (const e of events) {
      const prob = e.severity === 'extreme' ? 95
        : e.severity === 'severe' ? 82
        : e.severity === 'high' ? 72
        : e.severity === 'moderate' ? 55
        : 35;

      const claimEstimate = Math.round(prob * (e.radius_miles || 5) * 1.8);
      const baseClaim = prob * 150;
      const claimRange = `$${Math.round(baseClaim / 1000)}K\u2013$${Math.round((baseClaim * 3.5) / 1000)}K`;
      const riskLevel: 'critical' | 'high' | 'moderate' | 'low' =
        prob >= 80 ? 'critical' : prob >= 60 ? 'high' : prob >= 40 ? 'moderate' : 'low';

      const claimProbability = Math.round(prob * 0.5 + (e.radius_miles || 5) * 0.8);

      items.push({
        icon: iconMap[e.event_type],
        label: `${labelMap[e.event_type]} ${prob}% \u2013 ${e.county} ${e.state}`,
        type: e.event_type,
        time: this.getRelativeTime(e.reported_at),
        probability: prob,
        latitude: e.latitude,
        longitude: e.longitude,
        claimEstimate,
        claimRange,
        riskLevel,
        claimProbability: Math.min(claimProbability, 99),
        county: e.county,
        state: e.state,
      });
    }

    this.stormDeskItems = items;
  }

  private getRelativeTime(date: Date): string {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  // ── Map Rendering ───────────────────────────────────────────────

  private renderMapLayers(): void {
    if (!this.mapReady) return;

    // Clear all data arrays
    this.hailCircles = [];
    this.windCircles = [];
    this.tornadoCircles = [];
    this.hurricaneCircles = [];
    this.hurricanePolylines = [];
    this.hurricaneTrackPoints = [];
    this.lightningCircles = [];
    this.propertyMarkerItems = [];

    this.events.forEach(event => {
      const center: google.maps.LatLngLiteral = { lat: event.latitude, lng: event.longitude };
      const c = EVENT_COLORS[event.event_type] || '#6b7280';

      switch (event.event_type) {
        case 'hail':
          this.hailCircles.push({
            center, radius: event.radius_miles * 1609.34, event,
            options: { fillColor: c, fillOpacity: 0.2, strokeColor: c, strokeWeight: 2, clickable: true },
          });
          break;
        case 'wind':
          this.windCircles.push({
            center, radius: event.radius_miles * 1609.34, event,
            options: { fillColor: c, fillOpacity: 0.2, strokeColor: c, strokeWeight: 2, clickable: true },
          });
          break;
        case 'tornado':
          this.tornadoCircles.push({
            center, radius: event.radius_miles * 1609.34, event,
            options: { fillColor: c, fillOpacity: 0.25, strokeColor: c, strokeWeight: 2, clickable: true },
          });
          break;
        case 'hurricane':
          this.hurricaneCircles.push({
            center, radius: event.radius_miles * 1609.34, event,
            options: { fillColor: c, fillOpacity: 0.15, strokeColor: c, strokeWeight: 2, clickable: true },
          });
          if (event.track_points && event.track_points.length > 1) {
            this.hurricanePolylines.push({
              path: event.track_points.map(p => ({ lat: p.lat, lng: p.lng })),
              options: { strokeColor: c, strokeWeight: 3, strokeOpacity: 0.8 },
            });
            event.track_points.forEach((p, i) => {
              this.hurricaneTrackPoints.push({
                position: { lat: p.lat, lng: p.lng },
                options: {
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: i === event.track_points!.length - 1 ? 6 : 4,
                    fillColor: i === event.track_points!.length - 1 ? c : '#fff',
                    fillOpacity: 1,
                    strokeColor: c,
                    strokeWeight: 2,
                  },
                },
              });
            });
          }
          break;
        case 'lightning': {
          const sizeScale = Math.min(Math.max((event.strike_count || 100) / 50, 4), 14);
          this.lightningCircles.push({
            center, radius: sizeScale * 200, event,
            options: { fillColor: c, fillOpacity: 0.6, strokeColor: c, strokeWeight: 2, clickable: true },
          });
          break;
        }
      }
    });

    if (this.zipLayerVisible) {
      this.loadZipBoundaries();
    }
  }

  private buildPopup(event: StormEvent): string {
    let details = '';
    if (event.hail_size_inches) details += `<br>Hail Size: ${event.hail_size_inches}"`;
    if (event.wind_speed_mph) details += `<br>Wind: ${event.wind_speed_mph} mph (gusts ${event.gust_speed_mph} mph)`;
    if (event.hurricane_category) details += `<br>Category ${event.hurricane_category} - ${event.hurricane_name}`;
    if (event.strike_count) details += `<br>Strikes: ${event.strike_count}`;

    return `
      <div style="min-width:200px">
        <strong>${event.title}</strong><br>
        <span style="font-size:12px;color:#666">${event.county}, ${event.state}</span><br>
        <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin:4px 0;background:${this.getSeverityColor(event.severity)};color:#fff">
          ${event.severity.toUpperCase()}
        </span>
        ${details}
        <br><span style="font-size:11px;color:#999">Source: ${event.source}</span>
      </div>
    `;
  }

  onStormCircleClick(circle: { center: google.maps.LatLngLiteral; event: StormEvent }): void {
    if (!this.googleMap?.googleMap) return;
    if (!this.infoWindow) this.infoWindow = new google.maps.InfoWindow();
    this.infoWindow.setContent(this.buildPopup(circle.event));
    this.infoWindow.setPosition(circle.center);
    this.infoWindow.open(this.googleMap.googleMap);
    this.loadPropertiesForEvent(circle.event);
  }

  /** Count of events for a given layer in the current filtered dataset. */
  getLayerCount(type: string): number {
    if (type === 'zip') return this.impactedZips.length;
    if (type === 'properties') return this.impactedProperties.length;
    if (type === 'claim-zones') return this.predictedClaimZones.filter(z => z.active).length;
    return this.events.filter(e => e.event_type === type).length;
  }

  /** Re-fit the map to show all visible events after a filter change. */
  private fitMapToEvents(): void {
    if (!this.mapReady || this.events.length === 0 || !this.googleMap?.googleMap) return;
    const visibleEvents = this.events.filter(e => this.layerVisible[e.event_type]);
    if (visibleEvents.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    visibleEvents.forEach(e => bounds.extend({ lat: e.latitude, lng: e.longitude }));
    this.googleMap.googleMap.fitBounds(bounds, 40);
  }

  // ── Layer Toggles ───────────────────────────────────────────────

  toggleLayer(type: StormEventType): void {
    this.layerVisible[type] = !this.layerVisible[type];
    // KPIs respect layer visibility — recompute from this.events
    this.computeKpis();
  }

  // ── Filters ─────────────────────────────────────────────────────

  onFiltersChanged(): void {
    this.refreshStormIntel();
  }

  onStateChanged(): void {
    this.filters.county = '';
    this.buildCountyList();
    this.refreshStormIntel();
  }

  clearFilters(): void {
    this.filters = {
      dateRange: '7d',
      eventTypes: [],
      state: '',
      county: '',
      minSeverity: '',
    };
    this.counties = [];
    this.countyEventCounts.clear();
    this.refreshStormIntel();
  }

  /**
   * Build county dropdown from authoritative US Census list,
   * annotated with event counts from the storm API.
   */
  private buildCountyList(): void {
    const state = this.filters.state;
    if (!state) {
      this.counties = [];
      return;
    }

    // Full county list from Census Bureau data
    const allCounties = US_COUNTIES[state] || [];

    // Fetch counties that have storm data (for count annotation)
    this.stormService.getUniqueCounties(state)
      .pipe(takeUntil(this.destroy$), catchError(() => of([] as string[])))
      .subscribe(activeCounties => {
        // Count events per county from current loaded events
        this.countyEventCounts.clear();
        for (const event of this.events) {
          if (event.state === state && event.county) {
            this.countyEventCounts.set(
              event.county,
              (this.countyEventCounts.get(event.county) || 0) + 1,
            );
          }
        }

        // Build annotated list: all counties with event counts
        this.counties = allCounties.map(name => ({
          name,
          eventCount: this.countyEventCounts.get(name) || 0,
        }));
      });
  }

  // ── Target Areas Panel ──────────────────────────────────────────

  toggleTargetPanel(): void {
    this.targetPanelOpen = !this.targetPanelOpen;
  }

  closeTargetPanel(): void {
    this.targetPanelOpen = false;
  }

  focusTargetArea(area: StormTargetArea): void {
    if (!this.mapReady || !this.googleMap?.googleMap) return;
    const event = this.events.find(e => e.county === area.county && e.state === area.state);
    if (event) {
      this.googleMap.googleMap.panTo({ lat: event.latitude, lng: event.longitude });
      this.googleMap.googleMap.setZoom(9);
    }
  }

  createOutreachBatch(area: StormTargetArea): void {
    const payload: OutreachBatchPayload = {
      target_area_id: area.id,
      county: area.county,
      state: area.state,
      zip_codes: area.zip_codes,
      event_type: area.primary_event_type,
      severity: area.severity,
      estimated_properties: area.estimated_properties,
      risk_score: area.risk_score,
      created_at: new Date(),
      created_by: 'current_user',
    };

    this.stormService.createOutreachBatch(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result.success) {
          this.snackBar.open(
            `Outreach batch created: ${result.batch_id} — ${area.county}, ${area.state}`,
            'OK',
            { duration: 4000 }
          );
        }
      });
  }

  // ── Refresh ─────────────────────────────────────────────────────

  /** Refresh all data using the current filters. */
  refreshStormIntel(): void {
    this.loadData();
    this.loadPredictedClaims();
  }

  refresh(): void {
    this.refreshStormIntel();
    this.snackBar.open('Storm data refreshed', '', { duration: 2000 });
  }

  // ── ZIP Layer ──────────────────────────────────────────────────

  toggleZipLayer(): void {
    if (!this.mapReady) return;
    this.zipLayerVisible = !this.zipLayerVisible;
    if (this.zipLayerVisible) {
      this.loadZipBoundaries();
    } else {
      if (this.zipDataLayer) {
        this.zipDataLayer.setMap(null);
        this.zipDataLayer = null;
      }
      this.impactedZips = [];
      this.selectedZips.clear();
    }
  }

  private loadZipBoundaries(): void {
    if (!this.googleMap?.googleMap) return;
    const visibleEvents = this.events.filter(e => this.layerVisible[e.event_type]);
    if (visibleEvents.length === 0) {
      if (this.zipDataLayer) { this.zipDataLayer.setMap(null); this.zipDataLayer = null; }
      this.impactedZips = [];
      return;
    }

    const zips = new Set<string>();
    const zipEventMap = new Map<string, { count: number; types: Set<string>; state: string; county: string }>();

    visibleEvents.forEach(event => {
      let codes: string[] = event.zip_codes || [];
      if (typeof codes === 'string') {
        try { codes = JSON.parse(codes); } catch { codes = []; }
      }
      codes.forEach(z => {
        zips.add(z);
        const entry = zipEventMap.get(z) || { count: 0, types: new Set<string>(), state: '', county: '' };
        entry.count++;
        entry.types.add(event.event_type);
        if (!entry.state && event.state) entry.state = event.state;
        if (!entry.county && event.county) entry.county = event.county;
        zipEventMap.set(z, entry);
      });
    });

    this.zipLayerLoading = true;

    const applyGeoJson = (geojson: ZipBoundaryCollection) => {
      this.zipLayerLoading = false;
      if (this.zipDataLayer) { this.zipDataLayer.setMap(null); this.zipDataLayer = null; }
      if (!geojson.features.length) return;

      this.zipDataLayer = new google.maps.Data({ map: this.googleMap.googleMap });
      this.zipDataLayer.addGeoJson(geojson as any);

      this.zipDataLayer.setStyle((feature: any) => {
        const zip = feature.getProperty('GEOID') || '';
        const isSelected = this.selectedZips.has(zip);
        const entry = zipEventMap.get(zip);
        const hasHail = entry?.types.has('hail') || false;
        const baseColor = isSelected ? '#EF4444' : hasHail ? EVENT_COLORS.hail : ZIP_BOUNDARY_COLOR;
        const baseFill = isSelected ? 0.3 : hasHail ? 0.25 : 0.15;
        return {
          strokeColor: baseColor,
          strokeWeight: isSelected ? 4 : hasHail ? 3 : 2.5,
          fillColor: baseColor,
          fillOpacity: baseFill,
          clickable: true,
        };
      });

      this.zipDataLayer.addListener('click', (event: any) => {
        const zip = event.feature.getProperty('GEOID') || '';
        if (this.selectedZips.has(zip)) {
          this.selectedZips.delete(zip);
        } else {
          this.selectedZips.add(zip);
        }
        // Re-apply style to reflect selection
        this.zipDataLayer?.setStyle((f: any) => {
          const z = f.getProperty('GEOID') || '';
          const isSel = this.selectedZips.has(z);
          const e2 = zipEventMap.get(z);
          const hh = e2?.types.has('hail') || false;
          const bc = isSel ? '#EF4444' : hh ? EVENT_COLORS.hail : ZIP_BOUNDARY_COLOR;
          const bf = isSel ? 0.3 : hh ? 0.25 : 0.15;
          return { strokeColor: bc, strokeWeight: isSel ? 4 : hh ? 3 : 2.5, fillColor: bc, fillOpacity: bf, clickable: true };
        });

        // Show info window
        const entry = zipEventMap.get(zip);
        const count = entry?.count || 0;
        const types = entry ? Array.from(entry.types) : [];
        const typeBadges = types.map(t => {
          const c = EVENT_COLORS[t as StormEventType] || '#6b7280';
          return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;background:${c};color:#fff;margin-right:3px">${t}</span>`;
        }).join('');
        const locLine = entry?.county && entry?.state ? `<span style="font-size:12px;color:#6b7280">${entry.county}, ${entry.state}</span><br>` : '';

        if (!this.infoWindow) this.infoWindow = new google.maps.InfoWindow();
        this.infoWindow.setContent(`
          <div style="min-width:180px">
            <strong style="font-size:14px">ZIP ${zip}</strong><br>
            ${locLine}
            <span style="font-size:12px;color:#374151">${count} event${count !== 1 ? 's' : ''}</span><br>
            <div style="margin-top:4px">${typeBadges}</div>
          </div>
        `);
        this.infoWindow.setPosition(event.latLng);
        this.infoWindow.open(this.googleMap.googleMap);
      });
    };

    if (zips.size > 0) {
      const uniqueZips = Array.from(zips);
      this.impactedZips = uniqueZips.map(z => {
        const entry = zipEventMap.get(z)!;
        return { zip_code: z, event_count: entry.count, event_types: Array.from(entry.types), state: entry.state, county: entry.county };
      }).sort((a, b) => b.event_count - a.event_count);

      this.stormService.getZipBoundaries(uniqueZips)
        .pipe(takeUntil(this.destroy$), catchError(() => of({ type: 'FeatureCollection' as const, features: [] })))
        .subscribe((geojson: ZipBoundaryCollection) => applyGeoJson(geojson));
    } else {
      const points = visibleEvents
        .filter(e => e.latitude != null && e.longitude != null)
        .map(e => ({ lat: e.latitude, lng: e.longitude }));

      if (points.length === 0) {
        this.zipLayerLoading = false;
        this.impactedZips = [];
        return;
      }

      this.stormService.getZipBoundariesFromCoords(points)
        .pipe(takeUntil(this.destroy$), catchError(() => of({ type: 'FeatureCollection' as const, features: [] })))
        .subscribe((geojson: ZipBoundaryCollection) => {
          this.impactedZips = geojson.features.map(f => {
            const zip = f.properties?.GEOID || '';
            return {
              zip_code: zip,
              event_count: visibleEvents.length,
              event_types: [...new Set(visibleEvents.map(e => e.event_type))],
              state: visibleEvents[0]?.state || '',
              county: visibleEvents[0]?.county || '',
            };
          });
          applyGeoJson(geojson);
        });
    }
  }

  exportImpactedZips(): void {
    if (!this.impactedZips.length) return;
    const rows = this.impactedZips.map(z => ({
      'ZIP Code': z.zip_code,
      'State': z.state,
      'County': z.county,
      'Event Count': z.event_count,
      'Event Types': z.event_types.join(', '),
    }));
    this.excelService.exportAsExcelFile(rows, 'impacted_zip_codes');
  }

  exportSelectedZipsForCampaign(): void {
    if (!this.selectedZips.size) return;
    const rows = this.impactedZips
      .filter(z => this.selectedZips.has(z.zip_code))
      .map(z => ({
        'ZIP Code': z.zip_code,
        'State': z.state,
        'County': z.county,
        'Event Count': z.event_count,
        'Event Types': z.event_types.join(', '),
      }));
    this.excelService.exportAsExcelFile(rows, 'campaign_zip_codes');
  }

  clearZipSelection(): void {
    this.selectedZips.clear();
    if (this.zipDataLayer) {
      this.zipDataLayer.setStyle((feature: any) => {
        const zip = feature.getProperty('GEOID') || '';
        const entry = this.impactedZips.find(z => z.zip_code === zip);
        const hasHail = entry?.event_types.includes('hail') || false;
        const baseColor = hasHail ? EVENT_COLORS.hail : ZIP_BOUNDARY_COLOR;
        return {
          strokeColor: baseColor,
          fillColor: baseColor,
          fillOpacity: hasHail ? 0.25 : 0.15,
          strokeWeight: hasHail ? 3 : 2.5,
          clickable: true,
        };
      });
    }
  }

  // ── Properties Layer ────────────────────────────────────────────

  loadPropertiesForEvent(event: StormEvent): void {
    if (!this.propertiesLayerVisible) return;
    this.activePropertiesEvent = event;
    this.propertiesLoading = true;
    this.roofAnalysisRun = false;
    this.roofAnalysisResults.clear();
    this.propertyMarkerItems = [];

    this.stormService.getPropertiesInRadius(event.latitude, event.longitude, event.radius_miles)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of([] as ImpactedProperty[]))
      )
      .subscribe(properties => {
        this.propertiesLoading = false;
        this.impactedProperties = properties;
        this.renderPropertyMarkers(properties);
      });
  }

  private renderPropertyMarkers(properties: ImpactedProperty[]): void {
    this.propertyMarkerItems = properties.map(p => ({
      position: { lat: p.latitude, lng: p.longitude },
      options: {
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: PROPERTIES_COLOR,
          fillOpacity: 0.9,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      } as google.maps.MarkerOptions,
      popupHtml: `
        <div style="min-width:180px">
          <strong>${p.address}</strong><br>
          <span style="font-size:12px;color:#374151">${p.city}, ${p.state} ${p.zip_code}</span><br>
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-top:4px;background:${PROPERTIES_COLOR};color:#fff">${p.property_type}</span>
        </div>
      `,
    }));
  }

  onPropertyMarkerClick(idx: number): void {
    const m = this.propertyMarkerItems[idx];
    if (!m || !this.googleMap?.googleMap) return;
    if (!this.infoWindow) this.infoWindow = new google.maps.InfoWindow();
    this.infoWindow.setContent(m.popupHtml);
    this.infoWindow.setPosition(m.position);
    this.infoWindow.open(this.googleMap.googleMap);
  }

  togglePropertiesLayer(): void {
    this.propertiesLayerVisible = !this.propertiesLayerVisible;
  }

  clearProperties(): void {
    this.propertyMarkerItems = [];
    this.impactedProperties = [];
    this.activePropertiesEvent = null;
    this.roofAnalysisRun = false;
    this.roofAnalysisResults.clear();
    this.outreachPack = null;
  }

  exportImpactedProperties(): void {
    if (!this.impactedProperties.length) return;
    const rows = this.impactedProperties.map(p => {
      const row: Record<string, any> = {
        'Address': p.address,
        'City': p.city,
        'State': p.state,
        'ZIP': p.zip_code,
        'Property Type': p.property_type,
        'Lat': p.latitude,
        'Lng': p.longitude,
      };
      if (this.roofAnalysisRun) {
        const analysis = this.roofAnalysisResults.get(p.id);
        row['Damage Score'] = analysis?.damage_score ?? '';
        row['Damage Level'] = analysis?.damage_label ?? '';
        row['Confidence'] = analysis?.confidence ?? '';
        row['Analysis Summary'] = analysis?.summary ?? '';
      }
      return row;
    });
    this.excelService.exportAsExcelFile(rows, 'impacted_properties');
  }

  // ── Roof Analysis ──────────────────────────────────────────────

  analyzeRoofs(): void {
    if (!this.impactedProperties.length || this.roofAnalysisLoading) return;
    this.roofAnalysisLoading = true;

    this.stormService.analyzeRoofs(this.impactedProperties)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.snackBar.open('Roof analysis failed', 'OK', { duration: 4000 });
          this.roofAnalysisLoading = false;
          return of(null);
        })
      )
      .subscribe(response => {
        if (!response) return;
        this.roofAnalysisLoading = false;
        this.roofAnalysisRun = true;
        this.roofAnalysisResults.clear();

        for (const r of response.results) {
          this.roofAnalysisResults.set(r.property_id, r);
        }

        this.renderPropertyMarkersWithDamage();
        this.snackBar.open(
          `Roof analysis complete: ${response.analyzed} analyzed, ${response.failed} failed`,
          'OK',
          { duration: 4000 }
        );
      });
  }

  private renderPropertyMarkersWithDamage(): void {
    this.propertyMarkerItems = this.impactedProperties.map(p => {
      const analysis = this.roofAnalysisResults.get(p.id);
      const color = analysis ? this.getDamageColor(analysis.damage_label) : PROPERTIES_COLOR;
      return {
        position: { lat: p.latitude, lng: p.longitude },
        options: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: analysis ? 8 : 6,
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          label: analysis ? {
            text: String(analysis.damage_score),
            fontSize: '9px',
            fontWeight: '700',
            color: '#fff',
          } : undefined,
        } as google.maps.MarkerOptions,
        popupHtml: this.buildPropertyPopup(p, analysis),
      };
    });
  }

  private buildPropertyPopup(p: ImpactedProperty, analysis?: RoofAnalysisResult): string {
    let html = `
      <div style="min-width:220px;max-width:300px">
        <strong>${p.address}</strong><br>
        <span style="font-size:12px;color:#374151">${p.city}, ${p.state} ${p.zip_code}</span><br>
        <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-top:4px;background:${PROPERTIES_COLOR};color:#fff">${p.property_type}</span>`;

    if (analysis) {
      const color = this.getDamageColor(analysis.damage_label);
      html += `
        <hr style="margin:8px 0;border:none;border-top:1px solid #e5e7eb">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:13px;font-weight:700;background:${color};color:#fff">
            ${analysis.damage_score}/100
          </span>
          <span style="font-size:12px;font-weight:600;color:${color}">${analysis.damage_label.toUpperCase()}</span>
          <span style="font-size:11px;color:#9ca3af;margin-left:auto">Conf: ${analysis.confidence}</span>
        </div>
        <p style="font-size:12px;color:#374151;margin:4px 0">${analysis.summary}</p>`;

      if (analysis.indicators.length > 0) {
        html += `<ul style="font-size:11px;color:#6b7280;margin:4px 0;padding-left:16px">`;
        for (const ind of analysis.indicators.slice(0, 4)) {
          html += `<li>${ind}</li>`;
        }
        html += `</ul>`;
      }

      if (analysis.image_url) {
        html += `<img src="${analysis.image_url}" alt="Satellite view"
          style="width:100%;max-width:260px;border-radius:6px;margin-top:6px;border:1px solid #e5e7eb">`;
      }
    }

    html += `</div>`;
    return html;
  }

  getAverageScore(): number {
    if (this.roofAnalysisResults.size === 0) return 0;
    let sum = 0;
    this.roofAnalysisResults.forEach(r => sum += r.damage_score);
    return Math.round(sum / this.roofAnalysisResults.size);
  }

  getDamageColor(label: string): string {
    return DAMAGE_SCORE_COLORS[label] || '#6b7280';
  }

  // ── Outreach Pack ──────────────────────────────────────────────

  generateOutreachPack(): void {
    if (!this.roofAnalysisRun || !this.activePropertiesEvent) return;
    this.outreachLoading = true;

    const event = this.activePropertiesEvent;
    const targets: OutreachTarget[] = [];

    for (const p of this.impactedProperties) {
      const analysis = this.roofAnalysisResults.get(p.id);
      if (!analysis || analysis.damage_score < this.outreachDamageThreshold) continue;
      targets.push({
        property: p,
        analysis,
        emailDraft: this.generateEmailDraft(p, analysis, event),
        textDraft: this.generateTextDraft(p, analysis, event),
        callScript: this.generateCallScript(p, analysis, event),
      });
    }

    targets.sort((a, b) => b.analysis.damage_score - a.analysis.damage_score);

    this.outreachPack = {
      stormEvent: event,
      generatedAt: new Date(),
      targets,
      totalProperties: this.impactedProperties.length,
      analyzedProperties: this.roofAnalysisResults.size,
      qualifiedTargets: targets.length,
    };
    this.resetOutreachFilters();
    this.outreachLoading = false;
    this.snackBar.open(
      `Outreach pack ready: ${targets.length} targets from ${this.impactedProperties.length} properties`,
      'OK',
      { duration: 4000 }
    );
  }

  applyOutreachFilters(): void {
    if (!this.outreachPack) {
      this.filteredOutreachTargets = [];
      return;
    }

    let targets = this.outreachPack.targets.filter(t => {
      if (t.analysis.damage_score < this.outreachMinScore) return false;
      if (this.outreachConfidenceFilter !== 'all' && t.analysis.confidence !== this.outreachConfidenceFilter) return false;
      if (this.outreachPropertyTypeFilter !== 'all') {
        const pt = t.property.property_type.toLowerCase();
        if (this.outreachPropertyTypeFilter === 'residential' && !pt.includes('residential')) return false;
        if (this.outreachPropertyTypeFilter === 'commercial' && !pt.includes('commercial')) return false;
      }
      return true;
    });

    const event = this.outreachPack.stormEvent;
    switch (this.outreachSortBy) {
      case 'score':
        targets.sort((a, b) => b.analysis.damage_score - a.analysis.damage_score);
        break;
      case 'recent':
        targets.sort((a, b) => {
          const timeA = new Date(event.reported_at).getTime();
          const timeB = new Date(event.reported_at).getTime();
          return timeB - timeA || b.analysis.damage_score - a.analysis.damage_score;
        });
        break;
      case 'distance':
        targets.sort((a, b) => {
          const distA = this.haversineDistance(event.latitude, event.longitude, a.property.latitude, a.property.longitude);
          const distB = this.haversineDistance(event.latitude, event.longitude, b.property.latitude, b.property.longitude);
          return distA - distB;
        });
        break;
    }

    this.filteredOutreachTargets = targets;

    // Compute summary stats
    if (targets.length > 0) {
      const sum = targets.reduce((acc, t) => acc + t.analysis.damage_score, 0);
      this.outreachAvgScore = Math.round(sum / targets.length);
      this.outreachSevereCount = targets.filter(t => t.analysis.damage_score >= 80).length;
    } else {
      this.outreachAvgScore = 0;
      this.outreachSevereCount = 0;
    }
  }

  resetOutreachFilters(): void {
    this.outreachMinScore = 70;
    this.outreachConfidenceFilter = 'high';
    this.outreachPropertyTypeFilter = 'all';
    this.outreachSortBy = 'score';
    this.applyOutreachFilters();
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // miles
  }

  closeOutreachPack(): void {
    this.outreachPack = null;
    this.filteredOutreachTargets = [];
  }

  private generateEmailDraft(p: ImpactedProperty, a: RoofAnalysisResult, event: StormEvent): string {
    return `Subject: Storm Damage Assessment — ${p.address}

Dear Property Owner,

We are reaching out regarding your property at ${p.address}, ${p.city}, ${p.state} ${p.zip_code}.

Following the recent ${event.event_type} event in ${event.county}, ${event.state}, our satellite screening identified potential roof damage at your property.

Assessment Summary:
- Damage Score: ${a.damage_score}/100 (${a.damage_label.toUpperCase()})
- Confidence: ${a.confidence}
- Details: ${a.summary}

We are offering a FREE professional roof inspection and can assist you with the insurance claims process if damage is confirmed.

To schedule your complimentary inspection, simply reply to this email or call us directly.

Best regards,
UPA Storm Response Team`;
  }

  private generateTextDraft(p: ImpactedProperty, a: RoofAnalysisResult, event: StormEvent): string {
    return `${a.damage_label.toUpperCase()} damage detected at ${p.address} after recent ${event.event_type}. Free inspection available — reply YES to schedule.`;
  }

  private generateCallScript(p: ImpactedProperty, a: RoofAnalysisResult, event: StormEvent): string {
    return `INTRO:
Hi, my name is [Agent Name] calling from UPA Storm Response Team. I'm reaching out about the property at ${p.address}, ${p.city}, ${p.state} ${p.zip_code}. Is this the property owner?

CONTEXT:
We've been monitoring the recent ${event.event_type} event that affected ${event.county}, ${event.state}. Our satellite screening flagged your property with a damage score of ${a.damage_score} out of 100, classified as ${a.damage_label.toUpperCase()} (${a.confidence} confidence).

Key finding: ${a.summary}

OFFER:
We'd like to offer you a completely free, no-obligation professional roof inspection. If damage is confirmed, our team can assist you through the entire insurance claims process at no upfront cost to you.

CLOSE:
Would you be available this week for a quick 30-minute inspection? If now isn't a good time, I can leave my direct number — it's [Phone Number]. We recommend addressing potential damage promptly to prevent further issues.`;
  }

  exportOutreachList(): void {
    if (!this.outreachPack?.targets.length) return;
    const rows = this.outreachPack.targets.map(t => ({
      'Address': t.property.address,
      'City': t.property.city,
      'State': t.property.state,
      'ZIP': t.property.zip_code,
      'Damage Score': t.analysis.damage_score,
      'Damage Level': t.analysis.damage_label,
      'Email Draft': t.emailDraft,
      'Text Draft': t.textDraft,
      'Call Script': t.callScript,
    }));
    this.excelService.exportAsExcelFile(rows, 'outreach_targets');
  }

  exportScoredProperties(): void {
    if (!this.impactedProperties.length) return;
    const rows = this.impactedProperties.map(p => {
      const a = this.roofAnalysisResults.get(p.id);
      return {
        'Address': p.address,
        'City': p.city,
        'State': p.state,
        'ZIP': p.zip_code,
        'Property Type': p.property_type,
        'Lat': p.latitude,
        'Lng': p.longitude,
        'Damage Score': a?.damage_score ?? '',
        'Damage Level': a?.damage_label ?? '',
        'Confidence': a?.confidence ?? '',
        'Summary': a?.summary ?? '',
      };
    });
    this.excelService.exportAsExcelFile(rows, 'scored_properties');
  }

  exportSkipTraceQueue(): void {
    if (!this.outreachPack?.targets.length) return;
    const rows = this.outreachPack.targets.map(t => ({
      'Address': t.property.address,
      'City': t.property.city,
      'State': t.property.state,
      'ZIP': t.property.zip_code,
      'Damage Score': t.analysis.damage_score,
      'Damage Level': t.analysis.damage_label,
      'Skip Trace Status': 'Pending',
    }));
    this.excelService.exportAsExcelFile(rows, 'skip_trace_queue');
  }

  // ── Feed Auto-Scroll ───────────────────────────────────────────

  private startFeedScroll(): void {
    this.feedScrollInterval = setInterval(() => {
      const el = this.feedListRef?.nativeElement;
      if (!el) return;
      const itemHeight = 52;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
        el.scrollTop = 0;
      } else {
        el.scrollTop += itemHeight;
      }
    }, 5000);
  }

  pauseFeedScroll(): void {
    if (this.feedScrollInterval) {
      clearInterval(this.feedScrollInterval);
      this.feedScrollInterval = null;
    }
  }

  resumeFeedScroll(): void {
    if (!this.feedScrollInterval) {
      this.startFeedScroll();
    }
  }

  // ── Click-to-Zoom ────────────────────────────────────────────

  focusFeedAlert(alert: typeof this.recentAlerts[0]): void {
    if (!this.mapReady || !alert.latitude || !alert.longitude || !this.googleMap?.googleMap) return;
    this.googleMap.googleMap.panTo({ lat: alert.latitude, lng: alert.longitude });
    this.googleMap.googleMap.setZoom(10);

    const event = this.events.find(e =>
      Math.abs(e.latitude - alert.latitude) < 0.01 && Math.abs(e.longitude - alert.longitude) < 0.01
    );
    if (event) {
      this.showTargetAreaPopup(event);
    }
  }

  focusDeskItem(item: typeof this.stormDeskItems[0]): void {
    if (!this.mapReady || !item.latitude || !item.longitude || !this.googleMap?.googleMap) return;
    this.googleMap.googleMap.panTo({ lat: item.latitude, lng: item.longitude });
    this.googleMap.googleMap.setZoom(10);

    const event = this.events.find(e =>
      Math.abs(e.latitude - item.latitude) < 0.01 && Math.abs(e.longitude - item.longitude) < 0.01
    );
    if (event) {
      this.showTargetAreaPopup(event);
    }
  }

  private showTargetAreaPopup(event: StormEvent): void {
    if (!this.googleMap?.googleMap) return;

    if (!this.zipLayerVisible) {
      this.toggleZipLayer();
    }

    const homes = Math.round((event.radius_miles || 5) * 840);
    const roofAge10 = Math.round(homes * 0.47);
    const claimsLow = Math.round(homes * 0.08);
    const claimsHigh = Math.round(homes * 0.14);
    const zipCodes = event.zip_codes || [];
    const primaryZip = Array.isArray(zipCodes) && zipCodes.length > 0 ? zipCodes[0] : '\u2014';

    if (!this.infoWindow) this.infoWindow = new google.maps.InfoWindow();
    this.infoWindow.setContent(`
      <div style="min-width:200px;font-family:system-ui,sans-serif">
        <strong style="font-size:14px;color:#111827">${event.county}, ${event.state}</strong>
        <span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${this.getSeverityColor(event.severity)};color:#fff">${event.severity.toUpperCase()}</span>
        <hr style="margin:8px 0;border:none;border-top:1px solid #e5e7eb">
        <table style="width:100%;font-size:12px;color:#374151;border-collapse:collapse">
          <tr><td style="padding:3px 0;color:#6b7280">ZIP Code</td><td style="padding:3px 0;text-align:right;font-weight:600">${primaryZip}</td></tr>
          <tr><td style="padding:3px 0;color:#6b7280">Estimated Homes</td><td style="padding:3px 0;text-align:right;font-weight:600">${homes.toLocaleString()}</td></tr>
          <tr><td style="padding:3px 0;color:#6b7280">Roof Age &gt;10 yrs</td><td style="padding:3px 0;text-align:right;font-weight:600">${roofAge10.toLocaleString()}</td></tr>
          <tr><td style="padding:3px 0;color:#6b7280">Estimated Claims</td><td style="padding:3px 0;text-align:right;font-weight:600">${claimsLow.toLocaleString()}\u2013${claimsHigh.toLocaleString()}</td></tr>
        </table>
      </div>
    `);
    this.infoWindow.setPosition({ lat: event.latitude, lng: event.longitude });
    this.infoWindow.open(this.googleMap.googleMap);
  }

  // ── Radar Blips ──────────────────────────────────────────────

  private buildRadarBlips(events: StormEvent[]): void {
    if (events.length === 0) {
      this.radarBlips = [];
      return;
    }

    const lats = events.map(e => e.latitude);
    const lngs = events.map(e => e.longitude);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const rangeLat = Math.max(...lats) - Math.min(...lats) || 10;
    const rangeLng = Math.max(...lngs) - Math.min(...lngs) || 10;

    this.radarBlips = events.slice(0, 12).map(e => {
      const x = Math.max(5, Math.min(95, 50 + ((e.longitude - centerLng) / rangeLng) * 80));
      const y = Math.max(5, Math.min(95, 50 - ((e.latitude - centerLat) / rangeLat) * 80));
      const intensity = e.severity === 'extreme' || e.severity === 'severe' ? 'high'
        : e.severity === 'high' || e.severity === 'moderate' ? 'medium' : 'low';
      return { x, y, intensity };
    });
  }

  // ── Intelligence Ticker ────────────────────────────────────────

  private buildTickerItems(events: StormEvent[]): void {
    const colorMap: Record<StormEventType, string> = {
      hail: '#ef4444',
      wind: '#3b82f6',
      hurricane: '#8b5cf6',
      lightning: '#eab308',
      tornado: '#991b1b',
    };

    const iconMap: Record<StormEventType, string> = {
      hail: '🔴',
      wind: '🔵',
      hurricane: '🟣',
      lightning: '🟡',
      tornado: '🔴',
    };

    this.tickerItems = events.slice(0, 12).map(e => {
      const prob = e.severity === 'extreme' ? 95
        : e.severity === 'severe' ? 82
        : e.severity === 'high' ? 72
        : e.severity === 'moderate' ? 55 : 35;
      return {
        icon: iconMap[e.event_type],
        text: `${e.event_type.toUpperCase()} — ${e.county}, ${e.state} — ${prob}% probability`,
        color: colorMap[e.event_type],
      };
    });

  }

  // ── Live Feed ──────────────────────────────────────────────────

  private startLiveFeed(): void {
    // Seed initial items from real events only
    this.buildInitialLiveFeed();
  }

  private buildInitialLiveFeed(): void {
    const feedTypes: { type: string; icon: string }[] = [
      { type: 'Fire', icon: '🔥' },
      { type: 'Hail', icon: '🧊' },
      { type: 'Wind', icon: '💨' },
      { type: 'Lightning', icon: '⚡' },
      { type: 'Tornado', icon: '🌪' },
    ];

    const items: typeof this.liveFeedItems = [];

    for (const e of this.events.slice(0, 15)) {
      const prob = e.severity === 'extreme' ? 95
        : e.severity === 'severe' ? 82
        : e.severity === 'high' ? 72
        : e.severity === 'moderate' ? 55 : 35;
      const riskLevel: 'critical' | 'high' | 'moderate' | 'low' =
        prob >= 80 ? 'critical' : prob >= 60 ? 'high' : prob >= 40 ? 'moderate' : 'low';
      const typeInfo = feedTypes.find(f => f.type.toLowerCase() === e.event_type) || feedTypes[1];

      items.push({
        id: ++this.liveFeedIdCounter,
        icon: typeInfo.icon,
        eventType: typeInfo.type,
        county: e.county,
        state: e.state,
        riskScore: prob,
        riskLevel,
        timestamp: this.getRelativeTime(e.reported_at),
        isNew: false,
      });
    }

    this.liveFeedItems = items;
  }

  trackLiveFeedItem(_index: number, item: typeof this.liveFeedItems[0]): number {
    return item.id;
  }

  getLiveFeedRiskColor(level: string): string {
    switch (level) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'moderate': return '#eab308';
      case 'low': return '#22c55e';
      default: return '#64748b';
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  getSeverityColor(severity: string): string {
    return SEVERITY_COLORS[severity] || SEVERITY_COLOR_DEFAULT;
  }

  getEventColor(type: StormEventType): string {
    return EVENT_COLORS[type];
  }

  getEventTypeIcon(type: StormEventType): string {
    switch (type) {
      case 'hail': return 'ac_unit';
      case 'wind': return 'air';
      case 'tornado': return 'cyclone';
      case 'hurricane': return 'storm';
      case 'lightning': return 'bolt';
      default: return 'cloud';
    }
  }

  getEventTypeLabel(type: StormEventType): string {
    switch (type) {
      case 'hail': return 'Hail';
      case 'wind': return 'Wind';
      case 'tornado': return 'Tornado';
      case 'hurricane': return 'Hurricane';
      case 'lightning': return 'Lightning';
      default: return type;
    }
  }

  // ── Potential Claims Rolling In ────────────────────────────────

  loadPredictedClaims(): void {
    // Use the same lookback window as the storm filter
    const hoursMap: Record<string, number> = { '24h': 24, '3d': 72, '7d': 168 };
    const hours = hoursMap[this.filters.dateRange] || 168;

    forkJoin({
      events: this.claimsService.getEvents(hours),
      zones: this.claimsService.getZones(hours),
      ticker: this.claimsService.getTicker(hours, 20),
    }).subscribe({
      next: ({ events, zones, ticker }) => {
        // Map raw API responses to local types
        let mappedEvents = events
          .map(e => ({
            id: e.id,
            eventType: e.event_type as ClaimEventType,
            city: e.city,
            state: e.state,
            county: e.county,
            timestamp: new Date(e.timestamp),
            severity: e.severity as ClaimSeverity,
            claimProbability: e.claim_probability,
            territoryId: null,
            territoryName: null,
            description: e.description,
            source: e.source,
          }));

        let mappedZones = zones
          .map(z => ({
            id: z.id,
            name: z.name,
            eventType: z.event_type as ClaimEventType,
            center: z.center as [number, number],
            radiusMeters: z.radius_meters,
            severity: z.severity as ClaimSeverity,
            priority: z.priority as ClaimPriority,
            claimProbability: z.claim_probability,
            estimatedHomesAffected: z.estimated_homes_affected,
            affectedZips: z.affected_zips,
            county: z.county,
            state: z.state,
            territoryId: null,
            territoryName: null,
            trajectory: '',
            linkedPropertyIds: z.linked_property_ids,
            timestamp: new Date(z.timestamp),
            active: z.active,
            autoLeadGenerated: (z as any).auto_lead_generated || false,
          }));

        // ── Apply the same filters used by storm events ──
        // State filter
        if (this.filters.state) {
          mappedEvents = mappedEvents.filter(e => e.state === this.filters.state);
          mappedZones = mappedZones.filter(z => z.state === this.filters.state);
        }
        // County filter
        if (this.filters.county) {
          mappedEvents = mappedEvents.filter(e => e.county === this.filters.county);
          mappedZones = mappedZones.filter(z => z.county === this.filters.county);
        }
        // Event type filter
        if (this.filters.eventTypes.length > 0) {
          mappedEvents = mappedEvents.filter(e => this.filters.eventTypes.includes(e.eventType as any));
          mappedZones = mappedZones.filter(z => this.filters.eventTypes.includes(z.eventType as any));
        }

        this.predictedClaimEvents = mappedEvents
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        this.predictedClaimZones = mappedZones
          .sort((a, b) => {
            const sevOrder: Record<ClaimSeverity, number> = { critical: 0, high: 1, moderate: 2, monitor: 3 };
            return sevOrder[a.severity] - sevOrder[b.severity];
          });

        // Filter ticker messages too
        let mappedTicker = ticker.map(t => ({
          id: t.id,
          text: t.text,
          severity: t.severity as ClaimSeverity,
          timestamp: new Date(t.timestamp),
        }));
        this.claimTickerMessages = mappedTicker;

        this.isLiveClaimsData = mappedEvents.length > 0 || mappedZones.length > 0;
        this.startClaimTickerAnimation();
        this.renderPredictedClaimZones();
      },
      error: () => {
        this.isLiveClaimsData = false;
        this.predictedClaimEvents = [];
        this.predictedClaimZones = [];
        this.claimTickerMessages = [];
        this.renderPredictedClaimZones();
      },
    });
  }

  private startClaimTickerAnimation(): void {
    if (this.claimTickerInterval) clearInterval(this.claimTickerInterval);
    this.claimTickerPosition = 0;
    this.claimTickerInterval = setInterval(() => {
      this.claimTickerPosition -= 1;
      if (this.claimTickerPosition < -(this.claimTickerMessages.length * 400)) {
        this.claimTickerPosition = 0;
      }
    }, 30);
  }

  renderPredictedClaimZones(): void {
    if (!this.mapReady) return;

    const circles: typeof this.claimZoneCircles = [];
    const markers: typeof this.claimZoneExtraMarkers = [];

    for (const zone of this.predictedClaimZones) {
      if (!zone.active) continue;

      const color = this.getClaimSeverityColor(zone.severity);
      const center: google.maps.LatLngLiteral = { lat: zone.center[0], lng: zone.center[1] };

      circles.push({
        center,
        radius: zone.radiusMeters,
        zone,
        options: {
          fillColor: color,
          fillOpacity: 0.15,
          strokeColor: color,
          strokeWeight: 2,
          clickable: true,
        },
      });

      if (zone.severity === 'critical') {
        markers.push({
          position: center,
          zone,
          options: {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: color,
              fillOpacity: 0.8,
              strokeColor: color,
              strokeWeight: 3,
            },
          },
        });
      }
    }

    this.claimZoneCircles = circles;
    this.claimZoneExtraMarkers = markers;
  }

  togglePredictedClaimZonesLayer(): void {
    this.predictedClaimZonesLayerVisible = !this.predictedClaimZonesLayerVisible;
  }

  selectClaimZone(zone: PredictedClaimZone): void {
    this.selectedClaimZone = zone;
    this.claimZonePanelOpen = true;
    if (this.mapReady && this.googleMap?.googleMap) {
      this.googleMap.googleMap.panTo({ lat: zone.center[0], lng: zone.center[1] });
      this.googleMap.googleMap.setZoom(12);
    }
  }

  closeClaimZonePanel(): void {
    this.claimZonePanelOpen = false;
    this.selectedClaimZone = null;
  }

  getClaimSeverityColor(severity: ClaimSeverity): string {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'moderate': return '#eab308';
      case 'monitor': return '#3b82f6';
    }
  }

  getClaimSeverityBg(severity: ClaimSeverity): string {
    switch (severity) {
      case 'critical': return 'rgba(239, 68, 68, 0.12)';
      case 'high': return 'rgba(249, 115, 22, 0.12)';
      case 'moderate': return 'rgba(234, 179, 8, 0.12)';
      case 'monitor': return 'rgba(59, 130, 246, 0.12)';
    }
  }

  getClaimEventTypeIcon(type: ClaimEventType): string {
    switch (type) {
      case 'hail': return 'grain';
      case 'wind': return 'air';
      case 'lightning': return 'flash_on';
      case 'tornado': return 'cyclone';
      case 'flooding': return 'water';
      case 'fire': return 'local_fire_department';
    }
  }

  getClaimEventTypeLabel(type: ClaimEventType): string {
    switch (type) {
      case 'hail': return 'Hail';
      case 'wind': return 'Wind';
      case 'lightning': return 'Lightning';
      case 'tornado': return 'Tornado';
      case 'flooding': return 'Flooding';
      case 'fire': return 'Fire';
    }
  }

  getClaimPriorityColor(priority: ClaimPriority): string {
    switch (priority) {
      case 'P1': return '#ef4444';
      case 'P2': return '#f97316';
      case 'P3': return '#eab308';
      case 'P4': return '#3b82f6';
    }
  }

  getClaimTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  getActiveClaimZoneCount(): number {
    return this.predictedClaimZones.filter(z => z.active).length;
  }

  getCriticalClaimEventCount(): number {
    return this.predictedClaimEvents.filter(e => e.severity === 'critical').length;
  }

  getTotalClaimHomesAffected(): number {
    return this.predictedClaimZones
      .filter(z => z.active)
      .reduce((sum, z) => sum + z.estimatedHomesAffected, 0);
  }
}
