import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError, timeout } from 'rxjs/operators';
import { GoogleMap } from '@angular/google-maps';

import { FireIncident } from '../../../models/fire-incident.model';
import { StormEvent, StormEventType, StormFilterState } from '../../../models/storm-event.model';
import { FireIncidentService } from '../../../services/fire-incident.service';
import { StormDataService } from '../../../services/storm-data.service';
import { ExcelService } from '../../../services/excel.service';
import { EVENT_COLORS, SEVERITY_COLORS, SEVERITY_COLOR_DEFAULT } from '../../../config/event-colors';

/**
 * Unified incident record — normalises fire incidents and storm events
 * into a single shape for the list view.
 *
 * STRICT SCHEMA:
 *   id        — globally unique across fire + storm (composite: `${type}::${originalId}`)
 *   type      — 'fire' | 'storm', assigned at normalization, NEVER from API flag
 *   timestampMs — UTC milliseconds, used for ALL time filtering (never null in master)
 *   timestamp — Date object for display only, derived from timestampMs
 */
export interface UnifiedIncident {
  id: string;
  type: 'fire' | 'storm';
  incidentType: string;
  typeIcon: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  timestampMs: number;
  timestamp: Date;
  timestampSource: 'received_at' | 'reported_at' | 'fallback';
  source: string;
  severity: string;
  severityColor: string;
  raw: FireIncident | StormEvent;
  // Priority system
  priorityTier: 'high' | 'medium' | 'low';
  priorityScore: number;
  routingLabel: 'ACI Lead Queue' | 'UPA Outreach' | 'Data Only';
}

/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  DATA FLOW — instrumented pipeline with explicit stages          ║
 * ║                                                                  ║
 * ║  API (fire$ + storm$)  ← ALWAYS fetches ALL types                ║
 * ║    ↓                                                             ║
 * ║  normalize()           ← unified format, exclusions applied      ║
 * ║    ↓                                                             ║
 * ║  dedupeAndSort()       ← removes duplicate IDs, sorts desc       ║
 * ║    ↓                                                             ║
 * ║  masterRecords         ← IMMUTABLE between fetches               ║
 * ║    ↓                     NEVER written by filters                 ║
 * ║  rebuildFilteredView() ← SINGLE entry point for all filtering    ║
 * ║    ↓                                                             ║
 * ║    A. start from masterRecords                                   ║
 * ║    B. apply client-side time filter (verification)               ║
 * ║    C. apply source filter                                        ║
 * ║    D. apply type filter                                          ║
 * ║    E. sort                                                       ║
 * ║    F. assign filteredRecords                                     ║
 * ║    G. update dataSource                                          ║
 * ║    H. recompute KPIs from SAME filtered result                   ║
 * ║    ↓                                                             ║
 * ║  ┌────────┬────────┬────────┬────────┐                           ║
 * ║  │ KPIs   │ Table  │ Map    │ Export │                           ║
 * ║  └────────┴────────┴────────┴────────┘                           ║
 * ║  ALL four read from filteredRecords. Period.                      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
@Component({
  selector: 'app-incident-intelligence',
  templateUrl: './incident-intelligence.component.html',
  styleUrls: ['./incident-intelligence.component.scss'],
  standalone: false,
})
export class IncidentIntelligenceComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  @ViewChild(GoogleMap) googleMap!: GoogleMap;

  private destroy$ = new Subject<void>();
  private mapReady = false;
  mapLoaded = false;
  private infoWindow: google.maps.InfoWindow | null = null;
  private autoRefreshHandle: ReturnType<typeof setInterval> | null = null;

  /** Monotonic counter to detect stale async responses */
  private loadGeneration = 0;

  selectedTabIndex = 0;

  // Google Maps config
  mapCenter: google.maps.LatLngLiteral = { lat: 39.5, lng: -98.35 };
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

  // Map markers
  mapMarkers: { position: google.maps.LatLngLiteral; options: google.maps.MarkerOptions; popupHtml: string }[] = [];

  // ── Explicit data pipeline stages ─────────────────────────────
  /** Stable master dataset — written ONLY inside loadData()'s subscribe callback. */
  private masterRecords: UnifiedIncident[] = [];
  /** Derived from masterRecords via rebuildFilteredView(). Everything reads from here. */
  filteredRecords: UnifiedIncident[] = [];

  dataSource: MatTableDataSource<UnifiedIncident> = new MatTableDataSource([]);
  isLoading = false;
  loadError: string | null = null;
  lastRefreshTime: Date | null = null;

  // ── KPIs — ALL computed from filteredRecords ──────────────────
  fireCount = 0;
  stormCount = 0;
  highSeverityCount = 0;
  highPriorityCount = 0;
  mediumPriorityCount = 0;
  lowPriorityCount = 0;

  // ── Counts ────────────────────────────────────────────────────
  masterCount = 0;
  filteredCount = 0;

  // ── Debug panel (temporary — visible in UI) ───────────────────
  debug = {
    // Pipeline stage counts
    rawFireCount: 0,
    fireApiTotal: 0,
    fireTruncated: false,
    rawStormCount: 0,
    normalizedCount: 0,
    rejectedCount: 0,
    rejectedReasons: '' as string,
    dedupedMasterCount: 0,
    afterTimeFilterCount: 0,
    afterSourceFilterCount: 0,
    afterTypeFilterCount: 0,
    filteredCount: 0,
    dataSourceCount: 0,
    // KPIs
    fireCount: 0,
    stormCount: 0,
    totalCount: 0,
    highSev: 0,
    // State
    selectedTimeWindow: '',
    selectedType: '',
    selectedSource: '',
    lastRefreshTimestamp: '',
    duplicatesRemoved: 0,
    // Timestamp diagnostics
    fireTimestampRange: '',
    stormTimestampRange: '',
    timeFilterCutoff: '',
    timeFilterCutoffMs: 0,
    nowMs: 0,
    timeFilterDroppedFire: 0,
    timeFilterDroppedStorm: 0,
    beforeTimeFilterCount: 0,
    droppedByTimeFilterCount: 0,
    // Timestamp source distribution (which raw field was used)
    tsSourceReceived: 0,
    tsSourceReported: 0,
    tsSourceFallback: 0,
    // Min/max timestamps from masterRecords
    earliestTimestampMs: 0,
    latestTimestampMs: 0,
    earliestTimestampISO: '',
    latestTimestampISO: '',
    // Range bucket distribution (how many masterRecords fall into each window)
    bucketLast24h: 0,
    bucketLast7d: 0,
    bucketLast30d: 0,
    bucketOlderThan30d: 0,
    // Diagnosis
    allRecordsWithin24h: false,
  };

  // ── Assertion failures (shown as red warnings in UI) ──────────
  assertionFailures: string[] = [];

  /** Debug panel is hidden by default — toggle via "Show Debug Diagnostics" button.
   *  The toggle button itself is hidden until Ctrl+Shift+D is pressed (dev-only). */
  showDebugPanel = false;
  showDebugToggle = false;

  /** Pause live refresh — when true, auto-refresh is disabled and time chip /
   *  dropdown changes only re-filter the existing snapshot (no API calls).
   *  Manual Refresh button always works regardless of this flag.
   *  Default ON so we can test filters against a fixed dataset. */
  liveRefreshPaused = true;

  /** ISO timestamp of when the current masterRecords snapshot was loaded. */
  snapshotTime: string | null = null;

  availableSources: string[] = [];

  displayedColumns: string[] = [
    'incidentType',
    'location',
    'timestamp',
    'source',
    'severity',
    'priority',
  ];

  // ── UI Filters ────────────────────────────────────────────────
  typeFilter: string = '';
  sourceFilter: string = '';
  selectedDateRange: string = '7d';
  priorityFilter: string = 'all';

  // ── Priority scoring config ─────────────────────────────────
  private static readonly PRIORITY_TIER_HIGH = 65;
  private static readonly PRIORITY_TIER_MEDIUM = 40;

  private static readonly FIRE_BASE_SCORES: Record<string, number> = {
    SF: 95, CF: 90, RF: 90, WSF: 95, WCF: 90, WRF: 90,
    FIRE: 85, FULL: 85,
    EXP: 70, GL: 60, ELF: 55,
    FA: 40,
  };

  private static readonly STORM_SEVERITY_SCORES: Record<string, number> = {
    extreme: 65, severe: 60, high: 50, moderate: 35, low: 20,
  };

  private static readonly ROUTING_LABELS: Record<string, 'ACI Lead Queue' | 'UPA Outreach' | 'Data Only'> = {
    high: 'ACI Lead Queue',
    medium: 'UPA Outreach',
    low: 'Data Only',
  };

  // Removed PROPERTY_CALL_TYPES — see loadData(). The backend's
  // call_type_config.is_enabled whitelist is the canonical filter; the
  // frontend no longer overrides it with a hard-coded PulsePoint list.

  private readonly EXCLUDED_CALL_TYPES = new Set([
    'VF', 'VEH',
    'VEG', 'WVEG',
    'GF',
    'OF',
    'MA', 'AED',
    'SD',
    'CB',
  ]);

  stormFilters: StormFilterState = {
    dateRange: '24h',
    eventTypes: [],
    state: '',
    county: '',
    minSeverity: '',
  };

  constructor(
    private fireService: FireIncidentService,
    private stormService: StormDataService,
    private excelService: ExcelService,
    private snackBar: MatSnackBar,
  ) {}

  private debugKeyHandler = (e: KeyboardEvent) => {
    // Ctrl+Shift+D toggles debug panel visibility
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      this.showDebugToggle = true;
      this.showDebugPanel = !this.showDebugPanel;
    }
  };

  ngOnInit(): void {
    this.loadData();
    this.startAutoRefresh();
    window.addEventListener('keydown', this.debugKeyHandler);
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    if (!this.liveRefreshPaused) {
      this.autoRefreshHandle = setInterval(() => this.loadData(), 60000);
    }
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshHandle) {
      clearInterval(this.autoRefreshHandle);
      this.autoRefreshHandle = null;
    }
  }

  toggleLiveRefresh(): void {
    this.liveRefreshPaused = !this.liveRefreshPaused;
    this.startAutoRefresh();
  }

  ngAfterViewInit(): void {
    // No-op — Google Maps handles its own sizing
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAutoRefresh();
    if (this.infoWindow) this.infoWindow.close();
    window.removeEventListener('keydown', this.debugKeyHandler);
  }

  // ═══════════════════════════════════════════════════════════════
  //  STAGE 1 — Fetch raw data from BOTH APIs
  //
  //  We fetch the maximum window (30d) and do ALL time filtering
  //  client-side. This eliminates inconsistency between API
  //  date_from handling for fire vs storm.
  // ═══════════════════════════════════════════════════════════════

  loadData(): void {
    // Race condition guard: bump generation so stale responses are ignored
    const thisGeneration = ++this.loadGeneration;

    this.isLoading = true;
    this.loadError = null;

    const fetchTimestamp = new Date().toISOString();

    // Always fetch max window (30d) — time filtering is done client-side only
    const maxWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fire API — let the backend auto-filter to call_type_config.is_enabled
    // codes. Hard-coding PROPERTY_CALL_TYPES used to ship only PulsePoint
    // codes (SF/CF/RF/...) which excluded every socrata (`911`) and NIFC
    // (`WF`) row that the active ingestion sources actually produce.
    // Omitting the param triggers the backend's enabled-codes whitelist.
    const fireParams: any = {
      date_from: maxWindow,
    };

    // Page size 5000 — previous value of 500 was silently capping results.
    // The backend (fastapi-pagination) honors any requested size with no max.
    const fire$ = this.fireService.getIncidents(1, 5000, fireParams).pipe(
      catchError(err => { console.warn('[IncidentIntel] fire fetch failed:', err?.message); return of({ items: [], total: 0 }); }),
    );

    // Storm API — always fetch 30d, client filters to actual window
    this.stormFilters.dateRange = '30d';
    const storm$ = this.stormService.getStormEvents(this.stormFilters).pipe(
      catchError(err => { console.warn('[IncidentIntel] storm fetch failed:', err?.message); return of([] as StormEvent[]); }),
    );

    console.log(`[IncidentIntel] loadData START (gen=${thisGeneration}) — fetch at ${fetchTimestamp}, API window=30d (client filters to ${this.selectedDateRange})`);

    forkJoin([fire$, storm$])
      .pipe(takeUntil(this.destroy$), timeout(15000))
      .subscribe({
        next: ([fireRes, stormEvents]) => {
          // Race condition check: if a newer loadData() was called, discard this result
          if (thisGeneration !== this.loadGeneration) {
            console.warn(`[IncidentIntel] STALE RESPONSE DISCARDED (gen=${thisGeneration}, current=${this.loadGeneration})`);
            return;
          }

          const rawFire: FireIncident[] = fireRes.items || [];
          const fireApiTotal: number = fireRes.total ?? rawFire.length;
          const rawStorm: StormEvent[] = stormEvents || [];

          console.log(`[IncidentIntel] API returned (gen=${thisGeneration}) — fire: ${rawFire.length} items / ${fireApiTotal} total, storm: ${rawStorm.length} raw`);

          if (rawFire.length < fireApiTotal) {
            console.warn(`[IncidentIntel] FIRE TRUNCATED: API has ${fireApiTotal} total but only returned ${rawFire.length} items (page size limit)`);
          }

          // ── STAGE 2 — Normalize + validate ──
          const { valid: normalized, rejected } = this.normalizeAndValidate(rawFire, rawStorm);

          // ── STAGE 2.5 — Priority scoring ──
          for (const record of normalized) {
            this.scorePriority(record);
          }

          // ── STAGE 3 — Dedupe → master ──
          const { deduped, duplicateCount } = this.dedupe(normalized);

          console.log(`[IncidentIntel] Pipeline — normalized: ${normalized.length}, rejected: ${rejected.length}, duplicatesRemoved: ${duplicateCount}, master: ${deduped.length}`);

          // Write master — the ONLY line that mutates masterRecords
          this.masterRecords = deduped;
          this.masterCount = deduped.length;

          // Derive available sources from master (full set, not filtered)
          const srcSet = new Set(this.masterRecords.map(i => i.source).filter(Boolean));
          this.availableSources = Array.from(srcSet).sort();

          // Update debug fetch metadata
          this.debug.rawFireCount = rawFire.length;
          this.debug.fireApiTotal = fireApiTotal;
          this.debug.fireTruncated = rawFire.length < fireApiTotal;
          this.debug.rawStormCount = rawStorm.length;
          this.debug.normalizedCount = normalized.length;
          this.debug.rejectedCount = rejected.length;
          this.debug.rejectedReasons = this.summarizeRejections(rejected);
          this.debug.dedupedMasterCount = deduped.length;
          this.debug.duplicatesRemoved = duplicateCount;
          this.debug.lastRefreshTimestamp = fetchTimestamp;

          // Timestamp source distribution
          let rcv = 0, rpt = 0, fb = 0;
          for (const r of normalized) {
            if (r.timestampSource === 'received_at') rcv++;
            else if (r.timestampSource === 'reported_at') rpt++;
            else fb++;
          }
          this.debug.tsSourceReceived = rcv;
          this.debug.tsSourceReported = rpt;
          this.debug.tsSourceFallback = fb;

          // Log timestamp ranges for fire and storm to detect timezone issues
          this.debugTimestampRanges();

          // Compute min/max + range buckets from masterRecords
          this.debugTimestampBuckets();

          // ── STAGE 4+ — Rebuild filtered view from master ──
          this.rebuildFilteredView();

          this.lastRefreshTime = new Date();
          this.snapshotTime = this.lastRefreshTime.toISOString();
          this.isLoading = false;
        },
        error: (err: any) => {
          if (thisGeneration !== this.loadGeneration) return; // stale
          console.error('[IncidentIntel] loadData FAILED:', err?.message || err);
          this.isLoading = false;
          this.loadError = 'Failed to load incident data. Retrying in 60s...';
          this.lastRefreshTime = new Date();
        },
      });
  }

  // ═══════════════════════════════════════════════════════════════
  //  STAGE 2 — Normalize + validate
  //
  //  Every record must pass strict schema:
  //    id          — globally unique composite key: `fire::${originalId}` or `storm::${originalId}`
  //    type        — assigned HERE, never from an API flag
  //    timestampMs — parsed to UTC ms; record REJECTED if missing/invalid
  //    source      — non-empty string
  //
  //  Records that fail validation are returned in `rejected` with reason.
  //  They NEVER enter masterRecords.
  // ═══════════════════════════════════════════════════════════════

  private normalizeAndValidate(
    rawFire: FireIncident[],
    rawStorm: StormEvent[],
  ): { valid: UnifiedIncident[]; rejected: { source: string; reason: string; raw: any }[] } {
    const valid: UnifiedIncident[] = [];
    const rejected: { source: string; reason: string; raw: any }[] = [];

    // ── Fire records ──
    for (const fi of rawFire) {
      // Exclusion filter (not a rejection — these call types are intentionally ignored)
      if (this.EXCLUDED_CALL_TYPES.has(fi.call_type)) continue;

      // Validate ID
      if (!fi.id) {
        rejected.push({ source: 'fire', reason: 'missing id', raw: fi });
        continue;
      }

      // Normalize timestamp: try received_at → reported_at → timestamp (fallback)
      const { ms: tsMs, field: tsField } = this.resolveTimestamp(fi);
      if (tsMs === null) {
        rejected.push({ source: 'fire', reason: `no valid timestamp (received_at="${fi.received_at}")`, raw: fi });
        continue;
      }

      const agencyName = (fi as any).agency?.name || '';
      valid.push({
        id: `fire::${fi.id}`,
        type: 'fire',
        incidentType: fi.call_type_description || fi.call_type,
        typeIcon: this.getFireIcon(fi.call_type),
        location: fi.address || 'Unknown',
        latitude: fi.latitude,
        longitude: fi.longitude,
        timestampMs: tsMs,
        timestamp: new Date(tsMs),
        timestampSource: tsField,
        source: agencyName || 'UPA Incident Intelligence Network',
        severity: this.getFireSeverity(fi.call_type),
        severityColor: this.getFireSeverityColor(fi.call_type),
        raw: fi,
        priorityTier: 'low', priorityScore: 0, routingLabel: 'Data Only',
      });
    }

    // ── Storm records ──
    for (const se of rawStorm) {
      // Validate ID
      if (!se.id) {
        rejected.push({ source: 'storm', reason: 'missing id', raw: se });
        continue;
      }

      // Normalize timestamp: try reported_at → received_at → timestamp (fallback)
      const { ms: tsMs, field: tsField } = this.resolveTimestamp(se);
      if (tsMs === null) {
        rejected.push({ source: 'storm', reason: `no valid timestamp (reported_at="${se.reported_at}")`, raw: se });
        continue;
      }

      valid.push({
        id: `storm::${se.id}`,
        type: 'storm',
        incidentType: this.getStormLabel(se.event_type),
        typeIcon: this.getStormIcon(se.event_type),
        location: `${se.county}, ${se.state}`,
        latitude: se.latitude,
        longitude: se.longitude,
        timestampMs: tsMs,
        timestamp: new Date(tsMs),
        timestampSource: tsField,
        source: se.source || 'NWS',
        severity: se.severity,
        severityColor: SEVERITY_COLORS[se.severity] || SEVERITY_COLOR_DEFAULT,
        raw: se,
        priorityTier: 'low', priorityScore: 0, routingLabel: 'Data Only',
      });
    }

    if (rejected.length > 0) {
      console.warn(`[IncidentIntel] REJECTED ${rejected.length} records:`, rejected);
    }

    return { valid, rejected };
  }

  /**
   * Parse any timestamp value to UTC milliseconds.
   * Returns null if the value is missing, empty, or produces an invalid Date.
   */
  private parseTimestampToMs(value: any): number | null {
    if (value == null || value === '') return null;
    const ms = new Date(value).getTime();
    if (isNaN(ms)) return null;
    return ms;
  }

  /**
   * Resolve a single unified timestamp from any raw record.
   *
   * Fallback chain:
   *   1. received_at  (fire primary)
   *   2. reported_at  (storm primary)
   *   3. timestamp    (generic fallback)
   *
   * Returns { ms, field } so we can track which raw field was actually used.
   * Returns { ms: null, field } if no valid timestamp found.
   */
  private resolveTimestamp(raw: any): { ms: number | null; field: 'received_at' | 'reported_at' | 'fallback' } {
    // Try received_at first
    const fromReceived = this.parseTimestampToMs(raw.received_at);
    if (fromReceived !== null) return { ms: fromReceived, field: 'received_at' };

    // Try reported_at
    const fromReported = this.parseTimestampToMs(raw.reported_at);
    if (fromReported !== null) return { ms: fromReported, field: 'reported_at' };

    // Fallback: try .timestamp
    const fromFallback = this.parseTimestampToMs(raw.timestamp);
    if (fromFallback !== null) return { ms: fromFallback, field: 'fallback' };

    return { ms: null, field: 'fallback' };
  }

  /**
   * Summarize rejection reasons for the debug panel.
   */
  private summarizeRejections(rejected: { source: string; reason: string }[]): string {
    if (rejected.length === 0) return 'none';
    const counts: Record<string, number> = {};
    for (const r of rejected) {
      const key = `${r.source}:${r.reason.split(':')[0]}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([k, v]) => `${k}(${v})`).join(', ');
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════
  //  STAGE 2.5 — Priority scoring
  //
  //  Pure function: takes a normalized UnifiedIncident, returns
  //  { priorityScore, priorityTier, routingLabel }.
  //  Designed for future replacement by AI-based scorer.
  // ═══════════════════════════════════════════════════════════════

  private scorePriority(record: UnifiedIncident): void {
    let score = 0;

    if (record.type === 'fire') {
      const raw = record.raw as FireIncident;
      const callType = raw.call_type;

      // Base score from call type
      score = IncidentIntelligenceComponent.FIRE_BASE_SCORES[callType] ?? 25;

      // Signal: notes contain high-value keywords
      const desc = (raw.call_type_description || '').toLowerCase();
      if (/smoke|visible fire|units responding/.test(desc)) {
        score += 15;
      }

      // Signal: residential property indicator (structure fire types)
      if (['SF', 'RF', 'WSF', 'WRF'].includes(callType)) {
        score += 20;
      }

    } else {
      // Storm
      const raw = record.raw as StormEvent;
      score = IncidentIntelligenceComponent.STORM_SEVERITY_SCORES[raw.severity] ?? 20;

      // Signal: tornado or hurricane
      if (raw.event_type === 'tornado' || raw.event_type === 'hurricane') {
        score += 10;
      }
    }

    // Signal: has geocoordinates (actionable for outreach)
    if (record.latitude != null && record.longitude != null) {
      score += 5;
    }

    // Signal: recency (fresher = more actionable)
    const ageMs = Date.now() - record.timestampMs;
    if (ageMs < 6 * 60 * 60 * 1000) score += 10;       // < 6h
    else if (ageMs < 24 * 60 * 60 * 1000) score += 5;  // < 24h

    // Signal: has specific agency source (not generic)
    if (record.source !== 'UPA Incident Intelligence Network' && record.source !== 'NWS') {
      score += 5;
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    // Derive tier and routing
    const C = IncidentIntelligenceComponent;
    const tier: 'high' | 'medium' | 'low' =
      score >= C.PRIORITY_TIER_HIGH ? 'high' :
      score >= C.PRIORITY_TIER_MEDIUM ? 'medium' : 'low';

    record.priorityScore = score;
    record.priorityTier = tier;
    record.routingLabel = C.ROUTING_LABELS[tier];
  }

  getPriorityColor(tier: string): string {
    switch (tier) {
      case 'high': return '#E5533D';
      case 'medium': return '#F39C12';
      default: return '#6b7280';
    }
  }

  //  STAGE 3 — Deduplicate by composite id (already globally unique)
  //
  //  IDs are now `fire::${originalId}` and `storm::${originalId}`,
  //  so collisions across sources are impossible.
  // ═══════════════════════════════════════════════════════════════

  private dedupe(records: UnifiedIncident[]): { deduped: UnifiedIncident[]; duplicateCount: number } {
    const seen = new Set<string>();
    const deduped: UnifiedIncident[] = [];
    let duplicateCount = 0;

    for (const r of records) {
      if (seen.has(r.id)) {
        duplicateCount++;
        continue;
      }
      seen.add(r.id);
      deduped.push(r);
    }

    return { deduped, duplicateCount };
  }

  // ═══════════════════════════════════════════════════════════════
  //  rebuildFilteredView() — THE SINGLE ENTRY POINT
  //
  //  Every dropdown change, time chip click, and refresh completion
  //  calls this function. It recomputes everything from scratch
  //  from masterRecords only.
  //
  //  Order:
  //    A. start from masterRecords
  //    B. apply client-side time filter (verification layer)
  //    C. apply source filter
  //    D. apply type filter
  //    E. sort
  //    F. assign filteredRecords
  //    G. update dataSource
  //    H. recompute KPIs from the SAME filtered result
  // ═══════════════════════════════════════════════════════════════

  rebuildFilteredView(): void {
    console.log(`[IncidentIntel] rebuildFilteredView() — dateRange=${this.selectedDateRange}, type=${this.typeFilter || 'all'}, source=${this.sourceFilter || 'all'}`);

    // ── A. Start from masterRecords ──
    const master = this.masterRecords;
    console.log(`[IncidentIntel]   A. masterRecords.length = ${master.length}`);

    // ── B. Time filter (authoritative — uses timestampMs, same field for both types) ──
    const nowMs = Date.now();
    let cutoffMs: number;
    switch (this.selectedDateRange) {
      case '24h': cutoffMs = nowMs - 24 * 60 * 60 * 1000; break;
      case '7d':  cutoffMs = nowMs - 7 * 24 * 60 * 60 * 1000; break;
      case '30d': cutoffMs = nowMs - 30 * 24 * 60 * 60 * 1000; break;
      default:    cutoffMs = 0; // no filter
    }

    let fireDropped = 0;
    let stormDropped = 0;
    const afterTimeFilter = master.filter(r => {
      if (r.timestampMs >= cutoffMs) return true;
      if (r.type === 'fire') fireDropped++;
      else stormDropped++;
      return false;
    });

    const totalDropped = fireDropped + stormDropped;
    this.debug.nowMs = nowMs;
    this.debug.timeFilterCutoffMs = cutoffMs;
    this.debug.timeFilterCutoff = cutoffMs > 0 ? new Date(cutoffMs).toISOString() : 'none';
    this.debug.beforeTimeFilterCount = master.length;
    this.debug.timeFilterDroppedFire = fireDropped;
    this.debug.timeFilterDroppedStorm = stormDropped;
    this.debug.droppedByTimeFilterCount = totalDropped;
    this.debug.afterTimeFilterCount = afterTimeFilter.length;
    console.log(`[IncidentIntel]   B. afterTimeFilter.length = ${afterTimeFilter.length} (dropped fire=${fireDropped}, storm=${stormDropped}, total=${totalDropped})`);

    // ── C. Source filter ──
    const afterSourceFilter = this.sourceFilter
      ? afterTimeFilter.filter(r => r.source === this.sourceFilter)
      : afterTimeFilter;
    this.debug.afterSourceFilterCount = afterSourceFilter.length;
    console.log(`[IncidentIntel]   C. afterSourceFilter.length = ${afterSourceFilter.length}`);

    // ── D. Type filter (uses normalized .type only, never API flags) ──
    const afterTypeFilter = this.typeFilter
      ? afterSourceFilter.filter(r => r.type === this.typeFilter)
      : afterSourceFilter;
    this.debug.afterTypeFilterCount = afterTypeFilter.length;
    console.log(`[IncidentIntel]   D. afterTypeFilter.length = ${afterTypeFilter.length}`);

    // ── D2. Priority queue filter ──
    //   high-value   → only HIGH tier (real fires, score >= 65)
    //   upa-outreach → only MEDIUM + LOW tier (alarms/smoke, no structure fires)
    //   all          → everything
    let afterPriorityFilter: UnifiedIncident[];
    switch (this.priorityFilter) {
      case 'high-value':
        afterPriorityFilter = afterTypeFilter.filter(r => r.priorityTier === 'high');
        break;
      case 'upa-outreach':
        afterPriorityFilter = afterTypeFilter.filter(r => r.priorityTier === 'medium' || r.priorityTier === 'low');
        break;
      default:
        afterPriorityFilter = afterTypeFilter;
    }
    console.log(`[IncidentIntel] FILTER: "${this.priorityFilter}" ROWS: ${afterPriorityFilter.length} (from ${afterTypeFilter.length})`);

    // ── E. Sort by priorityScore desc, then timestampMs desc ──
    const sorted = afterPriorityFilter.slice().sort((a, b) => b.priorityScore - a.priorityScore || b.timestampMs - a.timestampMs);

    // ── F. Assign filteredRecords — single source of truth for table, map, KPIs, export ──
    this.filteredRecords = sorted;
    this.filteredCount = sorted.length;
    this.debug.filteredCount = sorted.length;

    // ── G. Update dataSource — new instance forces table re-render ──
    this.dataSource = new MatTableDataSource(sorted);
    if (this.paginator) {
      this.paginator.firstPage();
      this.dataSource.paginator = this.paginator;
    }
    this.debug.dataSourceCount = this.dataSource.data.length;
    console.log(`[IncidentIntel] TABLE UPDATED: dataSource.data.length = ${this.dataSource.data.length}`);

    // ── H. Recompute KPIs from the SAME filteredRecords ──
    this.fireCount = 0;
    this.stormCount = 0;
    this.highSeverityCount = 0;
    this.highPriorityCount = 0;
    this.mediumPriorityCount = 0;
    this.lowPriorityCount = 0;
    for (const r of sorted) {
      if (r.type === 'fire') this.fireCount++;
      else this.stormCount++;
      if (r.severity === 'high' || r.severity === 'severe' || r.severity === 'extreme') {
        this.highSeverityCount++;
      }
      if (r.priorityTier === 'high') this.highPriorityCount++;
      else if (r.priorityTier === 'medium') this.mediumPriorityCount++;
      else this.lowPriorityCount++;
    }

    // Update debug KPIs
    this.debug.fireCount = this.fireCount;
    this.debug.stormCount = this.stormCount;
    this.debug.totalCount = this.fireCount + this.stormCount;
    this.debug.highSev = this.highSeverityCount;
    this.debug.selectedTimeWindow = this.selectedDateRange;
    this.debug.selectedType = this.typeFilter || 'all';
    this.debug.selectedSource = this.sourceFilter || 'all';

    // ── Map ──
    if (this.mapReady) {
      this.renderMarkers();
    }

    // ═════ HARD ASSERTIONS ═════
    this.assertionFailures = [];

    if (this.filteredRecords.length !== this.dataSource.data.length) {
      this.assertionFailures.push(
        `filteredRecords(${this.filteredRecords.length}) !== dataSource.data(${this.dataSource.data.length})`
      );
    }

    const total = this.fireCount + this.stormCount;
    if (total !== this.filteredRecords.length) {
      this.assertionFailures.push(
        `fire(${this.fireCount}) + storm(${this.stormCount}) = ${total} !== filteredRecords(${this.filteredRecords.length})`
      );
    }

    if (this.typeFilter === 'fire' && this.stormCount !== 0) {
      this.assertionFailures.push(
        `typeFilter=fire but stormCount=${this.stormCount}`
      );
    }

    if (this.typeFilter === 'storm' && this.fireCount !== 0) {
      this.assertionFailures.push(
        `typeFilter=storm but fireCount=${this.fireCount}`
      );
    }

    if (!this.typeFilter && total !== this.filteredRecords.length) {
      this.assertionFailures.push(
        `typeFilter=all but fire(${this.fireCount})+storm(${this.stormCount})=${total} !== filtered(${this.filteredRecords.length})`
      );
    }

    if (this.filteredRecords.length > this.masterRecords.length) {
      this.assertionFailures.push(
        `filteredRecords(${this.filteredRecords.length}) > masterRecords(${this.masterRecords.length})`
      );
    }

    if (this.assertionFailures.length > 0) {
      console.error('[IncidentIntel] ASSERTION FAILURES:', this.assertionFailures);
    }

    this.logDiagnostic('rebuildFilteredView');
  }

  /** @deprecated Use rebuildFilteredView() — kept as alias for safety */
  applyFilters(): void {
    this.rebuildFilteredView();
  }

  onFilterChanged(): void {
    this.rebuildFilteredView();
  }

  /** Called when a time chip is clicked. When paused, re-filters the existing
   *  snapshot instead of re-fetching from APIs. */
  onDateRangeChanged(range: string): void {
    this.selectedDateRange = range;
    if (this.liveRefreshPaused) {
      // Re-filter existing masterRecords — no API call
      this.rebuildFilteredView();
    } else {
      this.loadData();
    }
  }

  clearFilters(): void {
    this.typeFilter = '';
    this.sourceFilter = '';
    this.priorityFilter = 'all';
    if (this.selectedDateRange !== '7d') {
      this.selectedDateRange = '7d';
      this.loadData(); // loadData → rebuildFilteredView
    } else {
      this.rebuildFilteredView();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Map — reads from filteredRecords (same as table/export/KPIs)
  // ═══════════════════════════════════════════════════════════════

  onMapReady(): void {
    this.mapReady = true;
    this.mapLoaded = true;

    if (this.filteredRecords.length > 0) {
      this.renderMarkers();
    }
  }

  private renderMarkers(): void {
    if (!this.mapReady) return;
    this.mapMarkers = [];

    const boundsCoords: google.maps.LatLngLiteral[] = [];

    for (const inc of this.filteredRecords) {
      if (inc.latitude == null || inc.longitude == null) continue;
      const pos: google.maps.LatLngLiteral = { lat: inc.latitude, lng: inc.longitude };
      boundsCoords.push(pos);

      this.mapMarkers.push({
        position: pos,
        options: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: inc.severityColor,
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        },
        popupHtml: `
          <div style="min-width:200px">
            <strong>${inc.incidentType}</strong><br>
            <span style="font-size:12px;color:#666">${inc.location}</span><br>
            <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin:4px 0;background:${inc.severityColor};color:#fff">
              ${inc.severity.toUpperCase()}
            </span><br>
            <span style="font-size:11px;color:#999">Source: ${inc.source}</span><br>
            <span style="font-size:11px;color:#999">${inc.timestamp.toLocaleString()}</span>
          </div>
        `,
      });
    }

    if (boundsCoords.length > 0 && this.googleMap?.googleMap) {
      const bounds = new google.maps.LatLngBounds();
      boundsCoords.forEach(c => bounds.extend(c));
      this.googleMap.googleMap.fitBounds(bounds, 40);
    }
  }

  onMarkerClick(idx: number): void {
    const m = this.mapMarkers[idx];
    if (!m || !this.googleMap?.googleMap) return;

    if (!this.infoWindow) this.infoWindow = new google.maps.InfoWindow();
    this.infoWindow.setContent(m.popupHtml);
    this.infoWindow.setPosition(m.position);
    this.infoWindow.open(this.googleMap.googleMap);
  }

  // ── Tab Switch ──────────────────────────────────────────────────

  onTabChanged(index: number): void {
    this.selectedTabIndex = index;
  }

  // ═══════════════════════════════════════════════════════════════
  //  Refresh — re-fetches raw data, rebuilds master, reapplies filters
  //  NEVER touches masterRecords with filtered data.
  // ═══════════════════════════════════════════════════════════════

  refresh(): void {
    this.loadData(); // loadData → rebuildFilteredView
    this.snackBar.open('Refreshing: re-fetching all data, reapplying filters', '', { duration: 2000 });
  }

  // ═══════════════════════════════════════════════════════════════
  //  Timestamp range diagnostics — detect fire vs storm timezone drift
  // ═══════════════════════════════════════════════════════════════

  private debugTimestampRanges(): void {
    const fireTimes = this.masterRecords
      .filter(r => r.type === 'fire')
      .map(r => r.timestampMs);
    const stormTimes = this.masterRecords
      .filter(r => r.type === 'storm')
      .map(r => r.timestampMs);

    if (fireTimes.length > 0) {
      const min = new Date(Math.min(...fireTimes));
      const max = new Date(Math.max(...fireTimes));
      this.debug.fireTimestampRange = `${min.toISOString()} → ${max.toISOString()}`;
    } else {
      this.debug.fireTimestampRange = 'no fire records';
    }

    if (stormTimes.length > 0) {
      const min = new Date(Math.min(...stormTimes));
      const max = new Date(Math.max(...stormTimes));
      this.debug.stormTimestampRange = `${min.toISOString()} → ${max.toISOString()}`;
    } else {
      this.debug.stormTimestampRange = 'no storm records';
    }
  }

  /**
   * Compute min/max timestamp and range-bucket distribution from masterRecords.
   * This tells us exactly how many records fall in each time window.
   */
  private debugTimestampBuckets(): void {
    const records = this.masterRecords;
    if (records.length === 0) {
      this.debug.earliestTimestampMs = 0;
      this.debug.latestTimestampMs = 0;
      this.debug.earliestTimestampISO = 'no records';
      this.debug.latestTimestampISO = 'no records';
      this.debug.bucketLast24h = 0;
      this.debug.bucketLast7d = 0;
      this.debug.bucketLast30d = 0;
      this.debug.bucketOlderThan30d = 0;
      this.debug.allRecordsWithin24h = true;
      return;
    }

    const nowMs = Date.now();
    const cutoff24h = nowMs - 24 * 60 * 60 * 1000;
    const cutoff7d  = nowMs - 7 * 24 * 60 * 60 * 1000;
    const cutoff30d = nowMs - 30 * 24 * 60 * 60 * 1000;

    let earliest = Infinity;
    let latest = -Infinity;
    let in24h = 0, in7d = 0, in30d = 0, older = 0;

    for (const r of records) {
      const ts = r.timestampMs;
      if (ts < earliest) earliest = ts;
      if (ts > latest) latest = ts;

      if (ts >= cutoff24h) { in24h++; in7d++; in30d++; }
      else if (ts >= cutoff7d) { in7d++; in30d++; }
      else if (ts >= cutoff30d) { in30d++; }
      else { older++; }
    }

    this.debug.earliestTimestampMs = earliest;
    this.debug.latestTimestampMs = latest;
    this.debug.earliestTimestampISO = new Date(earliest).toISOString();
    this.debug.latestTimestampISO = new Date(latest).toISOString();
    this.debug.bucketLast24h = in24h;
    this.debug.bucketLast7d = in7d;
    this.debug.bucketLast30d = in30d;
    this.debug.bucketOlderThan30d = older;
    this.debug.allRecordsWithin24h = (in24h === records.length);

    console.log(`[IncidentIntel] Timestamp buckets — 24h:${in24h}, 7d:${in7d}, 30d:${in30d}, older:${older}, earliest:${this.debug.earliestTimestampISO}, latest:${this.debug.latestTimestampISO}, allWithin24h:${this.debug.allRecordsWithin24h}`);
  }

  // ═══════════════════════════════════════════════════════════════
  //  Diagnostic logging — after every loadData and rebuildFilteredView
  // ═══════════════════════════════════════════════════════════════

  private logDiagnostic(trigger: string): void {
    console.log(`[IncidentIntel] ${trigger}`, {
      selectedIncidentType: this.typeFilter || 'All Types',
      selectedSource: this.sourceFilter || 'All Sources',
      selectedDateRange: this.selectedDateRange,
      masterCount: this.masterRecords.length,
      afterTimeFilter: this.debug.afterTimeFilterCount,
      afterSourceFilter: this.debug.afterSourceFilterCount,
      afterTypeFilter: this.debug.afterTypeFilterCount,
      filteredCount: this.filteredRecords.length,
      dataSourceCount: this.dataSource.data.length,
      fireCount: this.fireCount,
      stormCount: this.stormCount,
      highSeverityCount: this.highSeverityCount,
      totalKpi: this.fireCount + this.stormCount,
      assertionFailures: this.assertionFailures.length,
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────

  getRelativeTime(date: Date | null | undefined): string {
    if (!date) return '—';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  private getFireIcon(callType: string): string {
    const wildland = ['VEG', 'WVEG', 'GF', 'OF', 'FF', 'WF', 'CB', 'IF'];
    if (wildland.includes(callType)) return 'park';
    if (callType === 'SAT') return 'satellite_alt';
    return 'local_fire_department';
  }

  private getFireSeverity(callType: string): string {
    const high = ['SF', 'CF', 'RF', 'WSF', 'WCF', 'WRF', 'FIRE', 'FULL', 'EXP'];
    const moderate = ['FA', 'BA', 'AED', 'MA', 'SD'];
    if (high.includes(callType)) return 'high';
    if (moderate.includes(callType)) return 'moderate';
    return 'low';
  }

  private getFireSeverityColor(callType: string): string {
    const sev = this.getFireSeverity(callType);
    return SEVERITY_COLORS[sev] || SEVERITY_COLOR_DEFAULT;
  }

  private getStormLabel(type: StormEventType): string {
    const labels: Record<StormEventType, string> = {
      hail: 'Hail Storm',
      wind: 'Wind Damage',
      hurricane: 'Hurricane',
      lightning: 'Lightning',
      tornado: 'Tornado',
    };
    return labels[type] || type;
  }

  private getStormIcon(type: StormEventType): string {
    const icons: Record<StormEventType, string> = {
      hail: 'ac_unit',
      wind: 'air',
      hurricane: 'cyclone',
      lightning: 'bolt',
      tornado: 'cyclone',
    };
    return icons[type] || 'cloud';
  }

  getSeverityColor(severity: string): string {
    return SEVERITY_COLORS[severity] || SEVERITY_COLOR_DEFAULT;
  }

  // ═══════════════════════════════════════════════════════════════
  //  Export — reads from filteredRecords (same as table/map/KPIs)
  // ═══════════════════════════════════════════════════════════════

  private getExportRows(): Record<string, string>[] | null {
    if (!this.filteredRecords || this.filteredRecords.length === 0) {
      this.snackBar.open('No filtered incidents available to export', '', { duration: 3000, panelClass: 'export-snackbar' });
      return null;
    }
    return this.filteredRecords.map(r => ({
      'Incident Type': r.incidentType,
      'Location': r.location,
      'Timestamp': r.timestamp ? r.timestamp.toISOString() : '',
      'Source': r.source,
      'Severity': r.severity,
      'Priority': r.routingLabel,
      'Priority Score': r.priorityScore.toString(),
    }));
  }

  private makeFilename(ext: string): string {
    return `fire-leads-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private showDownloadToast(filename: string, rowCount: number): void {
    const ref = this.snackBar.open(
      `Exported ${rowCount} leads — ${filename}  ·  Check Downloads`,
      'Copy filename',
      { duration: 6000, panelClass: 'export-snackbar' },
    );
    ref.onAction().subscribe(() => {
      navigator.clipboard.writeText(filename).catch(() => {});
    });
  }

  exportToCsv(): void {
    const rows = this.getExportRows();
    if (!rows) return;

    this.snackBar.open('Preparing CSV...', '', { duration: 1500, panelClass: 'export-snackbar' });

    const headers = Object.keys(rows[0]);
    const csvRows = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(field =>
          `"${(row[field] ?? '').toString().replace(/"/g, '""')}"`
        ).join(',')
      ),
    ];
    const csvContent = csvRows.join('\n');
    const filename = this.makeFilename('csv');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, filename);
    this.showDownloadToast(filename, rows.length);
  }

  exportToExcel(): void {
    const rows = this.getExportRows();
    if (!rows) return;

    this.snackBar.open('Preparing XLSX...', '', { duration: 1500, panelClass: 'export-snackbar' });

    const filename = this.makeFilename('xlsx');
    this.excelService.exportAsExcelFile(rows, filename.replace('.xlsx', ''));
    this.showDownloadToast(filename, rows.length);
  }
}
