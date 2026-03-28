import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  StormEvent,
  StormTargetArea,
  StormKpiSummary,
  StormFilterState,
  OutreachBatchPayload,
  ZipBoundaryCollection,
  ImpactedProperty,
  RoofAnalysisResponse,
} from '../models/storm-event.model';

// ── Mock Data ────────────────────────────────────────────────────────
// Placeholder data so the Storm Intelligence page renders before
// live weather APIs are integrated.

const MOCK_EVENTS: StormEvent[] = [
  {
    id: 'mock-hail-1',
    event_type: 'hail',
    title: '1.75" Hail — Tarrant County',
    description: 'Large hail reported across multiple ZIP codes.',
    severity: 'severe',
    latitude: 32.75,
    longitude: -97.33,
    radius_miles: 12,
    state: 'TX',
    county: 'Tarrant',
    zip_codes: ['76107', '76109', '76110'],
    reported_at: new Date(Date.now() - 2 * 3600000),
    expires_at: new Date(Date.now() + 6 * 3600000),
    source: 'NWS',
    hail_size_inches: 1.75,
  },
  {
    id: 'mock-hail-2',
    event_type: 'hail',
    title: '1.25" Hail — Oklahoma County',
    description: 'Quarter-sized hail with high winds.',
    severity: 'high',
    latitude: 35.47,
    longitude: -97.52,
    radius_miles: 8,
    state: 'OK',
    county: 'Oklahoma',
    zip_codes: ['73102', '73104'],
    reported_at: new Date(Date.now() - 5 * 3600000),
    expires_at: new Date(Date.now() + 3 * 3600000),
    source: 'NWS',
    hail_size_inches: 1.25,
  },
  {
    id: 'mock-wind-1',
    event_type: 'wind',
    title: '70 mph Wind — Miami-Dade',
    description: 'Severe thunderstorm wind damage.',
    severity: 'high',
    latitude: 25.76,
    longitude: -80.19,
    radius_miles: 15,
    state: 'FL',
    county: 'Miami-Dade',
    zip_codes: ['33101', '33130', '33132'],
    reported_at: new Date(Date.now() - 8 * 3600000),
    expires_at: new Date(Date.now() + 2 * 3600000),
    source: 'NWS',
    wind_speed_mph: 70,
    gust_speed_mph: 85,
  },
  {
    id: 'mock-wind-2',
    event_type: 'wind',
    title: '60 mph Wind — Harris County',
    description: 'Damaging wind gusts along I-10 corridor.',
    severity: 'moderate',
    latitude: 29.76,
    longitude: -95.37,
    radius_miles: 10,
    state: 'TX',
    county: 'Harris',
    zip_codes: ['77002', '77003'],
    reported_at: new Date(Date.now() - 12 * 3600000),
    expires_at: new Date(Date.now() + 1 * 3600000),
    source: 'SPC',
    wind_speed_mph: 60,
    gust_speed_mph: 72,
  },
  {
    id: 'mock-lightning-1',
    event_type: 'lightning',
    title: 'Lightning Cluster — Hillsborough',
    description: 'Dense lightning activity with 200+ strikes.',
    severity: 'moderate',
    latitude: 27.95,
    longitude: -82.46,
    radius_miles: 8,
    state: 'FL',
    county: 'Hillsborough',
    zip_codes: ['33602', '33606'],
    reported_at: new Date(Date.now() - 3 * 3600000),
    expires_at: new Date(Date.now() + 4 * 3600000),
    source: 'Vaisala',
    strike_count: 237,
  },
  {
    id: 'mock-lightning-2',
    event_type: 'lightning',
    title: 'Lightning Cluster — Fulton County',
    description: 'Concentrated lightning in metro Atlanta.',
    severity: 'low',
    latitude: 33.75,
    longitude: -84.39,
    radius_miles: 6,
    state: 'GA',
    county: 'Fulton',
    zip_codes: ['30303', '30308'],
    reported_at: new Date(Date.now() - 18 * 3600000),
    expires_at: new Date(Date.now() - 10 * 3600000),
    source: 'Vaisala',
    strike_count: 142,
  },
  {
    id: 'mock-hail-3',
    event_type: 'hail',
    title: '2.0" Hail — Sedgwick County',
    description: 'Golf ball sized hail reported.',
    severity: 'extreme',
    latitude: 37.69,
    longitude: -97.34,
    radius_miles: 14,
    state: 'KS',
    county: 'Sedgwick',
    zip_codes: ['67202', '67203', '67211'],
    reported_at: new Date(Date.now() - 1 * 3600000),
    expires_at: new Date(Date.now() + 8 * 3600000),
    source: 'SPC',
    hail_size_inches: 2.0,
  },
  {
    id: 'mock-wind-3',
    event_type: 'wind',
    title: '55 mph Wind — Maricopa County',
    description: 'Dust storm with strong wind gusts.',
    severity: 'moderate',
    latitude: 33.45,
    longitude: -112.07,
    radius_miles: 18,
    state: 'AZ',
    county: 'Maricopa',
    zip_codes: ['85003', '85004', '85006'],
    reported_at: new Date(Date.now() - 24 * 3600000),
    expires_at: new Date(Date.now() - 20 * 3600000),
    source: 'NWS',
    wind_speed_mph: 55,
    gust_speed_mph: 68,
  },
];

const MOCK_TARGET_AREAS: StormTargetArea[] = [
  {
    id: 'TA-Tarrant-TX',
    rank: 1,
    county: 'Tarrant',
    state: 'TX',
    zip_codes: ['76107', '76109', '76110'],
    primary_event_type: 'hail',
    severity: 'severe',
    event_count: 1,
    affected_area_sq_miles: 85,
    estimated_properties: 3200,
    risk_score: 92,
    events: [],
  },
  {
    id: 'TA-Sedgwick-KS',
    rank: 2,
    county: 'Sedgwick',
    state: 'KS',
    zip_codes: ['67202', '67203', '67211'],
    primary_event_type: 'hail',
    severity: 'extreme',
    event_count: 1,
    affected_area_sq_miles: 120,
    estimated_properties: 4100,
    risk_score: 88,
    events: [],
  },
  {
    id: 'TA-Miami-Dade-FL',
    rank: 3,
    county: 'Miami-Dade',
    state: 'FL',
    zip_codes: ['33101', '33130', '33132'],
    primary_event_type: 'wind',
    severity: 'high',
    event_count: 1,
    affected_area_sq_miles: 95,
    estimated_properties: 5600,
    risk_score: 79,
    events: [],
  },
  {
    id: 'TA-Oklahoma-OK',
    rank: 4,
    county: 'Oklahoma',
    state: 'OK',
    zip_codes: ['73102', '73104'],
    primary_event_type: 'hail',
    severity: 'high',
    event_count: 1,
    affected_area_sq_miles: 60,
    estimated_properties: 2100,
    risk_score: 74,
    events: [],
  },
];

const MOCK_STATES = ['AZ', 'FL', 'GA', 'KS', 'OK', 'TX'];

const MOCK_COUNTIES: Record<string, string[]> = {
  TX: ['Harris', 'Tarrant'],
  FL: ['Hillsborough', 'Miami-Dade'],
  OK: ['Oklahoma'],
  KS: ['Sedgwick'],
  GA: ['Fulton'],
  AZ: ['Maricopa'],
};

// ── Service ──────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class StormDataService {

  constructor(private http: HttpClient) {}

  // ── Public API ──────────────────────────────────────────────────

  /** Compute KPI from a filtered event list — runs client-side. */
  computeKpiFromEvents(events: StormEvent[]): StormKpiSummary {
    return {
      hail_risk_areas: events.filter(e => e.event_type === 'hail').length,
      wind_damage_alerts: events.filter(e => e.event_type === 'wind' || e.event_type === 'tornado').length,
      hurricane_impact_zones: events.filter(e => e.event_type === 'hurricane').length,
      lightning_clusters: events.filter(e => e.event_type === 'lightning').length,
      total_events: events.length,
      last_updated: new Date(),
    };
  }

  /**
   * GET /storm-events with filters.
   * Returns empty array on error — no mock data fallback.
   * The component distinguishes API-failure from empty-results via the
   * isLiveStormData flag.
   */
  getStormEvents(filters: StormFilterState): Observable<StormEvent[]> {
    let params = new HttpParams();
    if (filters.dateRange) params = params.set('date_range', filters.dateRange);
    if (filters.eventTypes.length > 0) params = params.set('event_type', filters.eventTypes.join(','));
    if (filters.state) params = params.set('state', filters.state);
    if (filters.county) params = params.set('county', filters.county);
    if (filters.minSeverity) params = params.set('min_severity', filters.minSeverity);

    console.log('[StormData] getStormEvents →', params.toString() || '(no filters)');

    return this.http.get<StormEvent[]>('storm-events', { params }).pipe(
      map(events => {
        const mapped = events.map(e => ({
          ...e,
          reported_at: new Date(e.reported_at),
          expires_at: e.expires_at ? new Date(e.expires_at) : e.expires_at,
          zip_codes: typeof e.zip_codes === 'string' ? JSON.parse(e.zip_codes) : (e.zip_codes || []),
        }));
        console.log('[StormData] getStormEvents → %d events (hail:%d tornado:%d wind:%d hurricane:%d lightning:%d)',
          mapped.length,
          mapped.filter(e => e.event_type === 'hail').length,
          mapped.filter(e => e.event_type === 'tornado').length,
          mapped.filter(e => e.event_type === 'wind').length,
          mapped.filter(e => e.event_type === 'hurricane').length,
          mapped.filter(e => e.event_type === 'lightning').length,
        );
        return mapped;
      }),
    );
  }

  /** GET /storm-events/target-areas with filters, falls back to mock data on error. */
  getTargetAreas(filters: StormFilterState): Observable<StormTargetArea[]> {
    let params = new HttpParams();
    if (filters.dateRange) params = params.set('date_range', filters.dateRange);
    if (filters.eventTypes.length > 0) params = params.set('event_type', filters.eventTypes.join(','));
    if (filters.state) params = params.set('state', filters.state);
    if (filters.county) params = params.set('county', filters.county);

    return this.http.get<StormTargetArea[]>('storm-events/target-areas', { params }).pipe(
      catchError(() => {
        let areas = [...MOCK_TARGET_AREAS];
        if (filters.state) {
          areas = areas.filter(a => a.state === filters.state);
        }
        return of(areas);
      })
    );
  }

  /** POST /storm-events/outreach-batch */
  createOutreachBatch(payload: OutreachBatchPayload): Observable<{ success: boolean; batch_id: string }> {
    const body = {
      county: payload.county,
      state: payload.state,
      zip_codes: JSON.stringify(payload.zip_codes),
      event_type: payload.event_type,
      severity: payload.severity,
      estimated_properties: payload.estimated_properties,
      risk_score: payload.risk_score,
    };
    return this.http.post<any>('storm-events/outreach-batch', body).pipe(
      map(result => ({ success: true, batch_id: result.id || result.batch_id || 'unknown' }))
    );
  }

  /** GET /storm-events/zip-boundaries?zip_codes=... */
  getZipBoundaries(zipCodes: string[]): Observable<ZipBoundaryCollection> {
    if (!zipCodes || zipCodes.length === 0) {
      return of({ type: 'FeatureCollection' as const, features: [] });
    }
    const params = { zip_codes: zipCodes.join(',') };
    return this.http.get<ZipBoundaryCollection>('storm-events/zip-boundaries', { params });
  }

  /**
   * GET /storm-events/zip-boundaries?points=lat1,lng1,lat2,lng2,...
   * Derives ZIP codes from event coordinates via Census TIGERweb spatial query.
   */
  getZipBoundariesFromCoords(points: { lat: number; lng: number }[]): Observable<ZipBoundaryCollection> {
    if (!points || points.length === 0) {
      return of({ type: 'FeatureCollection' as const, features: [] });
    }
    // Deduplicate nearby coords (round to 2 decimals ≈ ~1km resolution)
    const seen = new Set<string>();
    const unique: { lat: number; lng: number }[] = [];
    for (const p of points) {
      const key = `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;
      if (!seen.has(key)) { seen.add(key); unique.push(p); }
    }
    const capped = unique.slice(0, 100);
    const coordStr = capped.map(p => `${p.lat},${p.lng}`).join(',');
    return this.http.get<ZipBoundaryCollection>('storm-events/zip-boundaries', { params: { points: coordStr } });
  }

  /** GET /storm-events/properties-in-radius?latitude=&longitude=&radius_miles= */
  getPropertiesInRadius(lat: number, lng: number, radiusMiles: number): Observable<ImpactedProperty[]> {
    const params = { latitude: lat.toString(), longitude: lng.toString(), radius_miles: radiusMiles.toString() };
    return this.http.get<ImpactedProperty[]>('storm-events/properties-in-radius', { params });
  }

  /** GET /storm-events/states, falls back to mock data on error. */
  getUniqueStates(): Observable<string[]> {
    return this.http.get<string[]>('storm-events/states').pipe(
      catchError(() => of(MOCK_STATES))
    );
  }

  /** GET /storm-events/counties, falls back to mock data on error. */
  getUniqueCounties(state?: string): Observable<string[]> {
    let params = new HttpParams();
    if (state) params = params.set('state', state);
    return this.http.get<string[]>('storm-events/counties', { params }).pipe(
      catchError(() => {
        if (state && MOCK_COUNTIES[state]) {
          return of(MOCK_COUNTIES[state]);
        }
        const all = Object.values(MOCK_COUNTIES).flat();
        return of([...new Set(all)].sort());
      })
    );
  }

  /** POST /storm-events/roof-analysis (max 50 properties per backend limit) */
  analyzeRoofs(properties: ImpactedProperty[]): Observable<RoofAnalysisResponse> {
    const body = {
      properties: properties.slice(0, 50).map(p => ({
        property_id: p.id,
        latitude: p.latitude,
        longitude: p.longitude,
      })),
    };
    return this.http.post<RoofAnalysisResponse>('storm-events/roof-analysis', body);
  }
}
