import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { GoogleMap } from '@angular/google-maps';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CrimeDataService } from '../../../services/crime-data.service';
import {
  CrimeIncident as ApiCrimeIncident,
  CrimeDataSourceStatus,
} from '../../../models/crime-incident.model';
import { LeadIntelligenceService } from 'src/app/shared/services/lead-intelligence.service';

// ── Crime Claims Types ─────────────────────────────────────────

type CrimeIncidentType = 'burglary' | 'break_in' | 'vandalism' | 'theft' | 'forced_entry' | 'property_damage';
type CrimeSeverity = 'critical' | 'high' | 'moderate' | 'low';
type CrimeConfidence = 'confirmed' | 'high' | 'moderate' | 'unverified';
type CrimePriority = 'P1' | 'P2' | 'P3' | 'P4';

interface CrimeIncident {
  id: string;
  incidentType: CrimeIncidentType;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  coordinates: [number, number];
  timestamp: Date;
  severity: CrimeSeverity;
  confidence: CrimeConfidence;
  claimRelevanceScore: number;
  estimatedLoss: number;
  propertyType: 'residential' | 'commercial' | 'mixed';
  territoryId: string | null;
  territoryName: string | null;
  description: string;
  source: string;
  outreachStatus: 'pending' | 'contacted' | 'scheduled' | 'not_started';
  skipTraceStatus: 'available' | 'pending' | 'not_available';
  ownerName: string | null;
  active: boolean;
  isMock?: boolean;
  sourceFreshness?: string;
}

interface CrimeClaimZone {
  id: string;
  name: string;
  incidentType: CrimeIncidentType;
  center: [number, number];
  radiusMeters: number;
  severity: CrimeSeverity;
  priority: CrimePriority;
  claimRelevanceScore: number;
  incidentCount: number;
  estimatedTotalLoss: number;
  affectedZips: string[];
  county: string;
  state: string;
  territoryId: string | null;
  territoryName: string | null;
  trend: string;
  timestamp: Date;
  active: boolean;
}

interface CrimeTickerMessage {
  id: string;
  text: string;
  severity: CrimeSeverity;
  timestamp: Date;
}

// ── Territory Enforcement ──────────────────────────────────────

interface TerritoryConfig {
  id: string;
  name: string;
  boundingBox: [[number, number], [number, number]];
  assignedAgentIds: string[];
}

const DEFAULT_TERRITORIES: TerritoryConfig[] = [
  { id: 'TER-TX-COLLIN', name: 'Collin County Territory', boundingBox: [[33.0, -97.0], [33.4, -96.4]], assignedAgentIds: [] },
  { id: 'TER-TX-DALLAS', name: 'Dallas County Territory', boundingBox: [[32.6, -97.0], [33.0, -96.4]], assignedAgentIds: [] },
  { id: 'TER-TX-DENTON', name: 'Denton County Territory', boundingBox: [[33.1, -97.2], [33.5, -96.7]], assignedAgentIds: [] },
  { id: 'TER-TX-KAUFMAN', name: 'Kaufman County Territory', boundingBox: [[32.5, -96.6], [32.9, -96.2]], assignedAgentIds: [] },
];

@Component({
  selector: 'app-crime-claims-intelligence',
  templateUrl: './crime-claims-intelligence.component.html',
  styleUrls: ['./crime-claims-intelligence.component.scss'],
  standalone: false,
})
export class CrimeClaimsIntelligenceComponent implements OnInit, OnDestroy {
  @ViewChild(GoogleMap) googleMap!: GoogleMap;
  private mapReady = false;
  mapLoaded = false;
  private infoWindow: google.maps.InfoWindow | null = null;

  // Google Maps config
  mapCenter: google.maps.LatLngLiteral = { lat: 32.95, lng: -96.75 };
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

  // Map overlay arrays
  incidentMarkers: { position: google.maps.LatLngLiteral; options: google.maps.MarkerOptions; incident: CrimeIncident }[] = [];
  zoneCircles: { center: google.maps.LatLngLiteral; radius: number; options: google.maps.CircleOptions }[] = [];
  zonePulseCircles: { center: google.maps.LatLngLiteral; options: google.maps.CircleOptions }[] = [];
  heatCircles: { center: google.maps.LatLngLiteral; radius: number; options: google.maps.CircleOptions }[] = [];
  territoryRectangles: { bounds: google.maps.LatLngBoundsLiteral; options: google.maps.RectangleOptions; tooltipHtml: string }[] = [];

  // Data
  crimeIncidents: CrimeIncident[] = [];
  crimeZones: CrimeClaimZone[] = [];
  tickerMessages: CrimeTickerMessage[] = [];
  territories: TerritoryConfig[] = [];

  // Source status dashboard
  sourceStatuses: CrimeDataSourceStatus[] = [];
  sourceStatusExpanded = false;
  apiAvailable = true;

  // UI state
  selectedIncident: CrimeIncident | null = null;
  incidentPanelOpen = false;
  incidentsLayerVisible = true;
  zonesLayerVisible = true;
  territoryLayerVisible = false;

  // Ticker
  private tickerInterval: ReturnType<typeof setInterval> | null = null;
  tickerPosition = 0;

  // Data source indicator
  isLiveData = false;

  // Territory enforcement
  currentUserRole: 'agent' | 'admin' | 'national' = 'admin';
  currentUserTerritoryId: string | null = 'TER-TX-COLLIN';

  // Track which incidents already have leads
  createdLeadIds = new Set<string>();

  constructor(
    private crimeDataService: CrimeDataService,
    private leadIntel: LeadIntelligenceService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.territories = [...DEFAULT_TERRITORIES];

    // Hydrate createdLeadIds from existing leads so buttons show correct state after reload
    const existingLeads = this.leadIntel.getSnapshot();
    for (const l of existingLeads) {
      if (l.source === 'crime-intelligence' && l.opportunityId) {
        // opportunityId is "crime-{incidentId}" — extract the incident ID
        const incId = l.opportunityId.replace('crime-', '');
        if (incId) this.createdLeadIds.add(incId);
      }
    }

    this.loadSourceStatuses();
    this.loadApiIncidents();
  }

  private loadSourceStatuses(): void {
    this.crimeDataService.getSourceStatuses().subscribe({
      next: (response) => {
        this.sourceStatuses = (response as any)?.items || [];
      },
      error: () => {
        this.sourceStatuses = [];
      },
    });
  }

  private loadApiIncidents(): void {
    console.log('[CrimeIntel] loadApiIncidents: fetching...');
    this.crimeDataService.getIncidents({ limit: 50, is_mock: false }).subscribe({
      next: (response) => {
        this.apiAvailable = true;
        const items = response.items || [];
        console.log('[CrimeIntel] API returned:', items.length, 'items');

        const real = items.filter(i => !i.is_mock && (i.address || i.city));
        this.isLiveData = real.length > 0;

        const mapped: CrimeIncident[] = real.map(item => this.mapApiToLocal(item));
        let incidents = this.deduplicateIncidents(mapped);

        if (this.currentUserRole === 'agent' && this.currentUserTerritoryId) {
          incidents = incidents.filter(i => i.territoryId === this.currentUserTerritoryId);
        }

        // Cap at 50 for stable rendering
        incidents = incidents.slice(0, 50);
        console.log('[CrimeIntel] After dedup+cap:', incidents.length, 'incidents');

        if (!incidents || incidents.length === 0) {
          this.crimeIncidents = [];
          this.crimeZones = [];
          this.tickerMessages = [];
          this.selectedIncident = null;
          return;
        }

        this.crimeIncidents = incidents.sort((a, b) => {
          const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
          const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
          return tb - ta;
        });

        this.selectedIncident = this.crimeIncidents[0] || null;
        this.incidentPanelOpen = false;

        // Build ticker from first 20 incidents (rendered once, animated via CSS)
        try {
          this.tickerMessages = this.buildTickerFromIncidents(this.crimeIncidents).slice(0, 20);
          console.log('[CrimeIntel] Ticker initialized with', this.tickerMessages.length, 'items');
        } catch { this.tickerMessages = []; }

        // Build zones from incidents (computed once, not reactive)
        try {
          this.crimeZones = this.buildZonesFromIncidents(this.crimeIncidents);
          console.log('[CrimeIntel] Zones:', this.crimeZones.length,
            this.crimeZones.map(z => `${z.name}(${z.incidentCount})`).join(', '));
        } catch { this.crimeZones = []; }

        // Render map (markers + zone circles, no heatmap)
        if (this.mapReady) {
          this.renderMarkersAndZones();
        }

        console.log('[CrimeIntel] Rendering:', this.crimeIncidents.length, 'incidents,',
          this.incidentMarkers.length, 'markers,', this.crimeZones.length, 'zones');
      },
      error: (err) => {
        console.error('[CrimeIntel] loadApiIncidents failed:', err?.message || err);
        this.apiAvailable = false;
        this.isLiveData = false;
        this.crimeIncidents = [];
        this.crimeZones = [];
        this.tickerMessages = [];
      },
    });
  }

  // ── Incident Deduplication ─────────────────────────────────────

  private static readonly SUFFIX_MAP: Record<string, string> = {
    'road': 'rd', 'street': 'st', 'avenue': 'ave', 'boulevard': 'blvd',
    'drive': 'dr', 'lane': 'ln', 'court': 'ct', 'place': 'pl',
    'circle': 'cir', 'trail': 'trl', 'terrace': 'ter', 'parkway': 'pkwy',
    'highway': 'hwy', 'expressway': 'expy', 'north': 'n', 'south': 's',
    'east': 'e', 'west': 'w', 'northeast': 'ne', 'northwest': 'nw',
    'southeast': 'se', 'southwest': 'sw',
  };

  private normalizeAddress(addr: string): string {
    if (!addr) return '';
    let norm = addr.toLowerCase().trim();
    // Remove punctuation
    norm = norm.replace(/[.,#\-\/\\()]/g, '');
    // Strip unit/apartment/suite numbers: "apt 6", "unit 3b", "ste 100", "# 5"
    norm = norm.replace(/\b(apt|unit|ste|suite|apartment|floor|fl|rm|room|bldg|building)\s*[a-z0-9]*\b/gi, '');
    // Collapse whitespace
    norm = norm.replace(/\s+/g, ' ').trim();
    // Standardize suffixes
    const words = norm.split(' ');
    return words.map(w => CrimeClaimsIntelligenceComponent.SUFFIX_MAP[w] || w).join(' ');
  }

  private incidentFingerprint(inc: CrimeIncident): string {
    const normAddr = this.normalizeAddress(inc.address || inc.city);
    const eventType = (inc.incidentType || 'unknown').toLowerCase();
    // 4-hour time bucket
    const hourBucket = Math.floor(inc.timestamp.getTime() / (4 * 3600_000));
    return `${normAddr}|${eventType}|${hourBucket}`;
  }

  private static readonly SEV_RANK: Record<string, number> = {
    critical: 4, high: 3, moderate: 2, low: 1,
  };

  private deduplicateIncidents(incidents: CrimeIncident[]): CrimeIncident[] {
    const map = new Map<string, CrimeIncident>();
    let dupeCount = 0;

    for (const inc of incidents) {
      const fp = this.incidentFingerprint(inc);
      const existing = map.get(fp);

      if (existing) {
        dupeCount++;
        // Keep highest severity; tie-break by latest timestamp
        const existSev = CrimeClaimsIntelligenceComponent.SEV_RANK[existing.severity] ?? 0;
        const incSev = CrimeClaimsIntelligenceComponent.SEV_RANK[inc.severity] ?? 0;
        if (incSev > existSev || (incSev === existSev && inc.timestamp > existing.timestamp)) {
          map.set(fp, inc);
        }
      } else {
        map.set(fp, inc);
      }
    }

    if (dupeCount > 0) {
      console.log(`[CrimeIntel] dedup: ${incidents.length} → ${map.size} (removed ${dupeCount} duplicates)`);
    }

    return Array.from(map.values());
  }

  // Approximate city-center coordinates for geocoding fallback
  private static readonly CITY_COORDS: Record<string, [number, number]> = {
    'philadelphia_pa': [39.9526, -75.1652],
    'houston_tx': [29.7604, -95.3698],
    'dallas_tx': [32.7767, -96.7970],
    'chicago_il': [41.8781, -87.6298],
    'los angeles_ca': [34.0522, -118.2437],
    'new york_ny': [40.7128, -74.0060],
    'miami_fl': [25.7617, -80.1918],
    'atlanta_ga': [33.7490, -84.3880],
    'phoenix_az': [33.4484, -112.0740],
    'san antonio_tx': [29.4241, -98.4936],
  };

  private approximateCoords(city: string, state: string, address: string): [number, number] {
    const key = `${(city || '').toLowerCase()}_${(state || '').toLowerCase()}`;
    const base = CrimeClaimsIntelligenceComponent.CITY_COORDS[key];
    if (base) {
      // Add small jitter from address hash so markers don't stack
      const hash = (address || '').split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
      const jitterLat = ((hash % 1000) / 1000) * 0.04 - 0.02; // ±0.02 degrees (~2km)
      const jitterLng = (((hash >> 10) % 1000) / 1000) * 0.04 - 0.02;
      return [base[0] + jitterLat, base[1] + jitterLng];
    }
    // Generic US center with jitter
    const hash = (address || city || '').split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    return [39.8 + ((hash % 100) / 100) * 0.1, -75.2 + (((hash >> 8) % 100) / 100) * 0.1];
  }

  // Estimate loss based on incident type when backend doesn't provide it
  private estimateLoss(type: string, severity: string): number {
    const baseLoss: Record<string, number> = {
      burglary: 25000, theft: 12000, vandalism: 8000,
      break_in: 20000, forced_entry: 18000, property_damage: 15000,
    };
    const sevMultiplier: Record<string, number> = {
      critical: 3.0, high: 2.0, moderate: 1.0, low: 0.5,
    };
    return Math.round((baseLoss[type] || 10000) * (sevMultiplier[severity] || 1.0));
  }

  private mapApiToLocal(item: ApiCrimeIncident): CrimeIncident {
    const incidentType = (item.incident_type || 'theft') as CrimeIncidentType;
    const severity = (item.severity || 'moderate') as CrimeSeverity;

    // Use real coords or approximate from city
    let coords: [number, number];
    if (item.latitude && item.longitude) {
      coords = [item.latitude, item.longitude];
    } else {
      coords = this.approximateCoords(item.city || '', item.state || '', item.address || '');
    }

    // Use real loss or estimate
    const loss = item.estimated_loss || this.estimateLoss(incidentType, severity);

    // Derive confidence from source freshness
    const confidence: CrimeConfidence = item.source_freshness === 'live' ? 'confirmed'
      : item.source_freshness === 'near_real_time' ? 'high'
      : item.source_freshness === 'daily_refresh' ? 'moderate'
      : 'moderate';

    return {
      id: item.id,
      incidentType,
      address: item.address || '',
      city: item.city || '',
      state: item.state || '',
      zip: item.zip_code || '',
      county: item.county || '',
      coordinates: coords,
      timestamp: item.occurred_at ? new Date(item.occurred_at) : new Date(),
      severity,
      confidence,
      claimRelevanceScore: Math.round((item.claim_relevance_score || 0.5) * 100),
      estimatedLoss: loss,
      propertyType: (item.property_type || 'residential') as any,
      territoryId: null,
      territoryName: null,
      description: item.description || `${incidentType.replace(/_/g, ' ')} reported at ${item.address || 'unknown location'}`,
      source: item.data_source || 'API',
      outreachStatus: 'not_started',
      skipTraceStatus: 'not_available',
      ownerName: null,
      active: item.active !== false,
      isMock: false, // We already filtered out mock data
      sourceFreshness: item.source_freshness || 'daily_refresh',
    };
  }

  toggleSourceStatus(): void {
    this.sourceStatusExpanded = !this.sourceStatusExpanded;
  }

  triggerSourcePoll(sourceId: string): void {
    this.crimeDataService.triggerPoll(sourceId).subscribe({
      next: () => {
        this.loadSourceStatuses();
        this.loadApiIncidents();
      },
    });
  }

  getStatusDotClass(status: string): string {
    switch (status) {
      case 'connected': return 'status-dot connected';
      case 'error': return 'status-dot error';
      case 'pending': return 'status-dot pending';
      case 'mock': return 'status-dot mock';
      default: return 'status-dot pending';
    }
  }

  getFreshnessChipClass(freshness: string): string {
    switch (freshness) {
      case 'live': return 'freshness-chip freshness-live';
      case 'near_real_time': return 'freshness-chip freshness-near-real-time';
      case 'daily_refresh': return 'freshness-chip freshness-daily';
      case 'historical': return 'freshness-chip freshness-historical';
      default: return 'freshness-chip';
    }
  }

  getFreshnessLabel(freshness: string): string {
    switch (freshness) {
      case 'live': return 'LIVE';
      case 'near_real_time': return 'NEAR REAL-TIME';
      case 'daily_refresh': return 'DAILY';
      case 'historical': return 'HISTORICAL';
      default: return freshness?.toUpperCase() || '';
    }
  }

  ngOnDestroy(): void {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
    }
    if (this.infoWindow) this.infoWindow.close();
  }

  onMapReady(): void {
    this.mapReady = true;
    this.mapLoaded = true;
    if (this.crimeIncidents.length > 0) {
      this.renderMarkersAndZones();
    }
  }

  private buildZonesFromIncidents(incidents: CrimeIncident[]): CrimeClaimZone[] {
    // Group by city+state (more meaningful than county for urban data)
    const byArea = new Map<string, CrimeIncident[]>();
    for (const inc of incidents) {
      const key = (inc.city && inc.state) ? `${inc.city}|${inc.state}` : (inc.county || inc.state || 'Unknown');
      if (!byArea.has(key)) byArea.set(key, []);
      byArea.get(key)!.push(inc);
    }

    const now = Date.now();
    const zones: CrimeClaimZone[] = [];
    let idx = 0;

    for (const [areaKey, group] of byArea) {
      if (group.length < 2) continue; // Skip singleton incidents — not a zone

      idx++;
      const avgLat = group.reduce((s, i) => s + i.coordinates[0], 0) / group.length;
      const avgLng = group.reduce((s, i) => s + i.coordinates[1], 0) / group.length;
      const totalLoss = group.reduce((s, i) => s + i.estimatedLoss, 0);
      const count = group.length;

      // Risk score: frequency (count) + recency (decay) + loss magnitude
      const recentCount = group.filter(i => (now - i.timestamp.getTime()) < 7 * 86400000).length;
      const recencyFactor = recentCount / Math.max(count, 1); // 0-1: what fraction is from last 7d
      const frequencyScore = Math.min(count / 20, 1.0) * 40; // max 40 pts for 20+ incidents
      const recencyScore = recencyFactor * 30; // max 30 pts if all are recent
      const lossScore = Math.min(totalLoss / 200000, 1.0) * 30; // max 30 pts for $200k+ total
      const riskScore = Math.round(frequencyScore + recencyScore + lossScore);

      // Find dominant type
      const typeCounts = new Map<CrimeIncidentType, number>();
      for (const i of group) typeCounts.set(i.incidentType, (typeCounts.get(i.incidentType) || 0) + 1);
      let topType: CrimeIncidentType = 'theft';
      let topCount = 0;
      for (const [t, c] of typeCounts) { if (c > topCount) { topType = t; topCount = c; } }

      const severity: CrimeSeverity = riskScore >= 70 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 30 ? 'moderate' : 'low';
      const priority: CrimePriority = severity === 'critical' ? 'P1' : severity === 'high' ? 'P2' : severity === 'moderate' ? 'P3' : 'P4';
      const zips = [...new Set(group.map(i => i.zip).filter(z => z))];
      const city = group[0]?.city || '';
      const state = group[0]?.state || '';
      const county = group[0]?.county || city;
      const latestTs = group.reduce((latest, i) => (i.timestamp && i.timestamp > latest) ? i.timestamp : latest, group[0]?.timestamp || new Date());

      const zoneName = city ? `${city} ${this.getIncidentTypeLabel(topType)} Zone` : `${county} ${this.getIncidentTypeLabel(topType)} Zone`;

      zones.push({
        id: `CCZ-${idx.toString().padStart(3, '0')}`,
        name: zoneName,
        incidentType: topType,
        center: [avgLat, avgLng],
        radiusMeters: Math.min(2000 + count * 300, 6000),
        severity,
        priority,
        claimRelevanceScore: riskScore,
        incidentCount: count,
        estimatedTotalLoss: totalLoss,
        affectedZips: zips,
        county,
        state,
        territoryId: null,
        territoryName: null,
        trend: recencyFactor > 0.7 ? 'Increasing — recent cluster' : recencyFactor > 0.4 ? 'Active — monitoring' : 'Historical',
        timestamp: latestTs,
        active: true,
      });
    }

    return zones.sort((a, b) => b.claimRelevanceScore - a.claimRelevanceScore);
  }

  private buildTickerFromIncidents(incidents: CrimeIncident[]): CrimeTickerMessage[] {
    return incidents
      .slice(0, 10)
      .map((inc, i) => ({
        id: `CT-GEN-${(i + 1).toString().padStart(3, '0')}`,
        text: `${this.getIncidentTypeLabel(inc.incidentType)} at ${inc.address}, ${inc.city} ${inc.state} — $${inc.estimatedLoss.toLocaleString()} estimated loss`,
        severity: inc.severity,
        timestamp: inc.timestamp,
      }));
  }

  private startTickerAnimation(): void {
    // DISABLED — 30ms setInterval causes 33 change detection cycles/second, freezing the page
    if (this.tickerInterval) clearInterval(this.tickerInterval);
    this.tickerPosition = 0;
  }

  private mapRendered = false;

  private renderMarkersAndZones(): void {
    if (!this.mapReady || this.mapRendered) return;
    this.mapRendered = true;

    // ── Incident markers ──
    this.incidentMarkers = [];
    this.heatCircles = []; // heatmap still disabled

    for (const incident of this.crimeIncidents) {
      if (!incident.active) continue;
      const lat = incident.coordinates?.[0] ?? 0;
      const lng = incident.coordinates?.[1] ?? 0;
      if (lat === 0 && lng === 0) continue;

      this.incidentMarkers.push({
        position: { lat, lng },
        options: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: this.getSeverityColor(incident.severity),
            fillOpacity: 0.85,
            strokeColor: '#fff',
            strokeWeight: 1.5,
          },
        },
        incident,
      });
    }

    // ── Zone circles ──
    this.zoneCircles = [];
    this.zonePulseCircles = [];

    for (const zone of this.crimeZones) {
      if (!zone.active) continue;
      const lat = zone.center?.[0] ?? 0;
      const lng = zone.center?.[1] ?? 0;
      if (lat === 0 && lng === 0) continue;

      const color = this.getSeverityColor(zone.severity);
      const center: google.maps.LatLngLiteral = { lat, lng };

      this.zoneCircles.push({
        center,
        radius: zone.radiusMeters,
        options: {
          fillColor: color,
          fillOpacity: 0.1,
          strokeColor: color,
          strokeWeight: 1.5,
          clickable: false,
        },
      });

      if (zone.severity === 'critical') {
        this.zonePulseCircles.push({
          center,
          options: {
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: color,
            strokeWeight: 3,
            radius: 150,
            clickable: false,
          },
        });
      }
    }

    console.log('[CrimeIntel] Map rendered — markers:', this.incidentMarkers.length,
      'zoneCircles:', this.zoneCircles.length, 'pulseCircles:', this.zonePulseCircles.length);

    // Fit map bounds to markers
    if (this.incidentMarkers.length > 0 && this.googleMap?.googleMap) {
      const bounds = new google.maps.LatLngBounds();
      for (const m of this.incidentMarkers) {
        bounds.extend(m.position);
      }
      this.googleMap.googleMap.fitBounds(bounds, 50);
    }
  }

  renderCrimeIncidents(): void {
    if (!this.mapReady) return;
    this.incidentMarkers = [];
    this.heatCircles = [];

    // Build density grid for heatmap circles
    const grid = new Map<string, { lat: number; lng: number; count: number }>();

    for (const incident of this.crimeIncidents) {
      if (!incident.active) continue;
      const lat = incident.coordinates[0];
      const lng = incident.coordinates[1];
      if (lat === 0 && lng === 0) continue;

      const color = this.getSeverityColor(incident.severity);
      const scale = incident.severity === 'critical' ? 8 : incident.severity === 'high' ? 7 : 6;

      this.incidentMarkers.push({
        position: { lat, lng },
        options: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale,
            fillColor: color,
            fillOpacity: 0.85,
            strokeColor: '#fff',
            strokeWeight: 1.5,
          },
        },
        incident,
      });

      // Aggregate into density grid (0.01 degree cells ~1km)
      const cellKey = `${lat.toFixed(2)}_${lng.toFixed(2)}`;
      const cell = grid.get(cellKey);
      if (cell) {
        cell.count++;
      } else {
        grid.set(cellKey, { lat: parseFloat(lat.toFixed(2)), lng: parseFloat(lng.toFixed(2)), count: 1 });
      }
    }

    // Generate heatmap density circles from grid
    for (const cell of grid.values()) {
      if (cell.count < 3) continue; // Only show clusters of 3+
      const opacity = Math.min(cell.count / 20, 0.4); // max 40% opacity
      const radius = Math.min(500 + cell.count * 100, 3000); // 500m–3km
      this.heatCircles.push({
        center: { lat: cell.lat, lng: cell.lng },
        radius,
        options: {
          fillColor: '#ef4444',
          fillOpacity: opacity,
          strokeColor: '#ef4444',
          strokeOpacity: opacity * 0.5,
          strokeWeight: 1,
          clickable: false,
        },
      });
    }
  }

  private fitMapToIncidents(): void {
    if (!this.googleMap?.googleMap || this.incidentMarkers.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const m of this.incidentMarkers) {
      bounds.extend(m.position);
    }
    this.googleMap.googleMap.fitBounds(bounds, 50);
  }

  renderCrimeZones(): void {
    if (!this.mapReady) return;
    this.zoneCircles = [];
    this.zonePulseCircles = [];

    for (const zone of this.crimeZones) {
      if (!zone.active) continue;

      const color = this.getSeverityColor(zone.severity);
      const center: google.maps.LatLngLiteral = { lat: zone.center[0], lng: zone.center[1] };

      this.zoneCircles.push({
        center,
        radius: zone.radiusMeters,
        options: {
          fillColor: color,
          fillOpacity: 0.1,
          strokeColor: color,
          strokeWeight: 1.5,
          clickable: false,
        },
      });

      if (zone.severity === 'critical') {
        this.zonePulseCircles.push({
          center,
          options: {
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: color,
            strokeWeight: 3,
            radius: 150,
            clickable: false,
          },
        });
      }
    }
  }

  renderTerritoryOverlays(): void {
    this.territoryRectangles = [];

    for (const terr of this.territories) {
      this.territoryRectangles.push({
        bounds: {
          south: terr.boundingBox[0][0],
          west: terr.boundingBox[0][1],
          north: terr.boundingBox[1][0],
          east: terr.boundingBox[1][1],
        },
        options: {
          fillColor: '#6366f1',
          fillOpacity: 0.05,
          strokeColor: '#6366f1',
          strokeWeight: 1.5,
          clickable: false,
        },
        tooltipHtml: `<strong>${terr.name}</strong><br>${terr.assignedAgentIds.length} agents`,
      });
    }
  }

  toggleIncidentsLayer(): void {
    this.incidentsLayerVisible = !this.incidentsLayerVisible;
  }

  toggleZonesLayer(): void {
    this.zonesLayerVisible = !this.zonesLayerVisible;
  }

  toggleTerritoryLayer(): void {
    this.territoryLayerVisible = !this.territoryLayerVisible;
    if (this.territoryLayerVisible) {
      this.renderTerritoryOverlays();
    }
  }

  onIncidentMarkerClick(idx: number): void {
    const m = this.incidentMarkers[idx];
    if (!m) return;
    this.selectIncident(m.incident);
  }

  selectIncident(incident: CrimeIncident): void {
    if (!incident) return;
    this.selectedIncident = incident;
    this.incidentPanelOpen = true;
    if (this.mapReady && this.googleMap?.googleMap && incident.coordinates?.[0] && incident.coordinates?.[1]) {
      this.googleMap.googleMap.panTo({ lat: incident.coordinates[0], lng: incident.coordinates[1] });
      this.googleMap.googleMap.setZoom(14);
    }
  }

  closeIncidentPanel(): void {
    this.incidentPanelOpen = false;
    this.selectedIncident = null;
  }

  // ── Lead Creation ─────────────────────────────────────────────

  createLeadFromIncident(incident: CrimeIncident, event?: MouseEvent): void {
    if (event) event.stopPropagation();

    if (this.createdLeadIds.has(incident.id)) {
      this.snackBar.open('Lead already created for this incident', 'OK', { duration: 2000 });
      return;
    }

    const lead = {
      id: `crime-lead-${incident.id}`,
      opportunityId: `crime-${incident.id}`,
      incidentType: incident.incidentType,
      address: incident.address,
      city: incident.city,
      state: incident.state,
      dateDetected: new Date().toISOString().slice(0, 10),
      leadStatus: 'new',
      assignedAgent: '',
      assignedAgentId: '',
      estimatedValue: incident.estimatedLoss,
      opportunityScore: incident.claimRelevanceScore,
      damageProbability: incident.claimRelevanceScore / 100,
      source: 'crime-intelligence',
      territoryName: incident.territoryName || '',
      assignmentReason: 'crime-incident',
    };

    this.leadIntel.createLead(lead).subscribe({
      next: (created) => {
        this.createdLeadIds.add(incident.id);
        console.log('[LeadFlow] Lead created from Crime Intel:',
          created.id, incident.incidentType, incident.address || incident.city, incident.state);
        this.snackBar.open(
          'Lead created successfully',
          'OK', { duration: 3000 },
        );
      },
      error: () => {
        this.snackBar.open('Failed to create lead', 'Dismiss', { duration: 3000 });
      },
    });
  }

  generateLeadsFromZone(zone: CrimeClaimZone, event?: MouseEvent): void {
    if (event) event.stopPropagation();

    const zoneIncidents = this.crimeIncidents.filter(i => {
      if (this.createdLeadIds.has(i.id)) return false;
      const cityMatch = i.city && zone.name.toLowerCase().includes(i.city.toLowerCase());
      const countyMatch = i.county && zone.county && i.county === zone.county;
      return cityMatch || countyMatch;
    });

    if (zoneIncidents.length === 0) {
      this.snackBar.open('All incidents in this zone already have leads', 'OK', { duration: 2000 });
      return;
    }

    this.snackBar.open(`Creating ${zoneIncidents.length} leads...`, '', { duration: 2000 });

    let created = 0;
    for (const incident of zoneIncidents) {
      this.leadIntel.createLead({
        id: `crime-lead-${incident.id}`,
        opportunityId: `crime-${incident.id}`,
        incidentType: incident.incidentType,
        address: incident.address,
        city: incident.city,
        state: incident.state,
        dateDetected: new Date().toISOString().slice(0, 10),
        leadStatus: 'new',
        assignedAgent: '',
        assignedAgentId: '',
        estimatedValue: incident.estimatedLoss,
        opportunityScore: incident.claimRelevanceScore,
        damageProbability: incident.claimRelevanceScore / 100,
        source: 'crime-intelligence',
        territoryName: zone.name,
        assignmentReason: `zone-${zone.id}`,
      }).subscribe(() => {
        this.createdLeadIds.add(incident.id);
        created++;
      });
    }

    // Show summary after a short delay for async completions
    setTimeout(() => {
      this.snackBar.open(
        `${created} lead${created !== 1 ? 's' : ''} created from ${zone.name}`,
        'OK', { duration: 3000 },
      );
    }, 2000);
  }

  hasLeadForIncident(incidentId: string): boolean {
    return this.createdLeadIds.has(incidentId);
  }

  // ── KPI Helpers ─────────────────────────────────────────────

  getCrimeIncidentsToday(): number {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return this.crimeIncidents.filter(i => i.timestamp.getTime() >= startOfDay).length;
  }

  getHighValueTheftCount(): number {
    return this.crimeIncidents.filter(i =>
      (i.incidentType === 'theft' || i.incidentType === 'burglary') && i.estimatedLoss >= 20000
    ).length;
  }

  getVandalismClaimCount(): number {
    return this.crimeIncidents.filter(i => i.incidentType === 'vandalism').length;
  }

  getBreakInLeadCount(): number {
    return this.crimeIncidents.filter(i =>
      (i.incidentType === 'break_in' || i.incidentType === 'forced_entry')
    ).length;
  }

  getTotalEstimatedLoss(): number {
    return this.crimeIncidents.reduce((sum, i) => sum + i.estimatedLoss, 0);
  }

  getActiveZoneCount(): number {
    return this.crimeZones.filter(z => z.active).length;
  }

  getCriticalIncidentCount(): number {
    return this.crimeIncidents.filter(i => i.severity === 'critical').length;
  }

  // ── Display Helpers ─────────────────────────────────────────

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'moderate': return '#eab308';
      case 'low': return '#6366f1';
      default: return '#6366f1';
    }
  }

  getSeverityBg(severity: string): string {
    switch (severity) {
      case 'critical': return 'rgba(239, 68, 68, 0.12)';
      case 'high': return 'rgba(249, 115, 22, 0.12)';
      case 'moderate': return 'rgba(234, 179, 8, 0.12)';
      case 'low': return 'rgba(99, 102, 241, 0.12)';
      default: return 'rgba(99, 102, 241, 0.12)';
    }
  }

  getIncidentTypeIcon(type: string): string {
    switch (type) {
      case 'burglary': return 'home_lock';
      case 'break_in': return 'door_front';
      case 'vandalism': return 'format_paint';
      case 'theft': return 'shopping_bag';
      case 'forced_entry': return 'lock_open';
      case 'property_damage': return 'dangerous';
      case 'arson': return 'local_fire_department';
      case 'robbery': return 'report';
      case 'assault': return 'person_alert';
      default: return 'warning';
    }
  }

  getIncidentTypeLabel(type: string): string {
    switch (type) {
      case 'burglary': return 'Burglary';
      case 'break_in': return 'Break-In';
      case 'vandalism': return 'Vandalism';
      case 'theft': return 'Theft';
      case 'forced_entry': return 'Forced Entry';
      case 'property_damage': return 'Property Damage';
      case 'arson': return 'Arson';
      case 'robbery': return 'Robbery';
      case 'assault': return 'Assault';
      default: return type ? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'P1': return '#ef4444';
      case 'P2': return '#f97316';
      case 'P3': return '#eab308';
      case 'P4': return '#6366f1';
      default: return '#6366f1';
    }
  }

  getConfidenceLabel(confidence: string): string {
    switch (confidence) {
      case 'confirmed': return 'Confirmed';
      case 'high': return 'High';
      case 'moderate': return 'Moderate';
      case 'unverified': return 'Unverified';
      default: return confidence || 'Unknown';
    }
  }

  getOutreachLabel(status: string): string {
    switch (status) {
      case 'not_started': return 'Not Started';
      case 'pending': return 'Pending';
      case 'contacted': return 'Contacted';
      case 'scheduled': return 'Scheduled';
      default: return status || 'N/A';
    }
  }

  getOutreachColor(status: string): string {
    switch (status) {
      case 'not_started': return '#9ca3af';
      case 'pending': return '#eab308';
      case 'contacted': return '#3b82f6';
      case 'scheduled': return '#22c55e';
      default: return '#9ca3af';
    }
  }

  getSkipTraceLabel(status: string): string {
    switch (status) {
      case 'available': return 'Available';
      case 'pending': return 'Pending';
      case 'not_available': return 'N/A';
      default: return status || 'N/A';
    }
  }

  getPropertyTypeLabel(type: string): string {
    switch (type) {
      case 'residential': return 'Residential';
      case 'commercial': return 'Commercial';
      case 'mixed': return 'Mixed Use';
      default: return type || 'Unknown';
    }
  }

  getTimeAgo(date: Date): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 0) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
