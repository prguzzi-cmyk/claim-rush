import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, of, interval, Subscription } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { StormDataService } from './storm-data.service';
import { FireIncidentService } from './fire-incident.service';
import { DashboardService } from './dashboard.service';

const LOG_PREFIX = '[IncidentFeed]';

export interface NormalizedIncident {
  id: string;
  type: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  lead_status: string;
  estimated_property_value: number | null;
}

@Injectable({ providedIn: 'root' })
export class IncidentFeedService {

  private incidents$ = new BehaviorSubject<NormalizedIncident[]>([]);
  private pollSub: Subscription | null = null;

  constructor(
    private stormService: StormDataService,
    private fireService: FireIncidentService,
    private dashboardService: DashboardService,
  ) {}

  /** Observable of current incidents. */
  getIncidents(): Observable<NormalizedIncident[]> {
    return this.incidents$.asObservable();
  }

  /** Get current snapshot. */
  getSnapshot(): NormalizedIncident[] {
    return this.incidents$.value;
  }

  /** Start 30s polling. */
  startPolling(intervalMs = 30000): void {
    this.stopPolling(); // prevent poll stacking on re-navigation
    console.log(LOG_PREFIX, 'startPolling', intervalMs + 'ms');
    this.refresh();
    this.pollSub = interval(intervalMs).subscribe(() => this.refresh());
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  /** Aggregate from fire + storm services. */
  refresh(): void {
    console.log(LOG_PREFIX, 'refresh → request start');
    this.aggregateFromSources().pipe(
      timeout(15000),
      catchError(err => {
        console.error(LOG_PREFIX, 'refresh failed, using mock data:', err?.message || err);
        return of(this.getMockIncidents());
      }),
    ).subscribe(incidents => {
      const sorted = incidents.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200);
      console.log(LOG_PREFIX, 'refresh → success,', sorted.length, 'incidents');
      if (sorted.length === 0) console.warn(LOG_PREFIX, 'refresh → empty response');
      this.incidents$.next(sorted);
    });
  }

  /** Aggregate from fire + storm services when /incidents/live isn't available. */
  private aggregateFromSources(): Observable<NormalizedIncident[]> {
    const dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return forkJoin({
      fires: this.dashboardService.getRecentFireIncidents(1, 100, dateFrom).pipe(catchError(() => of([]))),
      storms: this.stormService.getStormEvents({ dateRange: '7d', eventTypes: [], state: '', county: '', minSeverity: '' } as any).pipe(catchError(() => of([]))),
    }).pipe(
      map(({ fires, storms }) => {
        const items: NormalizedIncident[] = [];

        // Normalize fire incidents
        const fireItems = fires?.items || fires?.data || fires || [];
        if (Array.isArray(fireItems)) {
          for (const f of fireItems.slice(0, 100)) {
            items.push({
              id: f.id || `fire-${items.length}`,
              type: 'fire',
              address: f.address || '',
              city: f.agency?.city || '',
              state: f.agency?.state || '',
              zip: f.agency?.zip_code || '',
              latitude: f.latitude || 0,
              longitude: f.longitude || 0,
              timestamp: f.received_at || f.created_at || new Date().toISOString(),
              lead_status: f.lead_id ? 'contacted' : 'not_contacted',
              estimated_property_value: null,
            });
          }
        }

        // Normalize storm events
        if (Array.isArray(storms)) {
          for (const s of storms.slice(0, 100)) {
            items.push({
              id: s.id || `storm-${items.length}`,
              type: s.event_type || 'storm',
              address: `${s.county || ''} County`,
              city: s.county || '',
              state: s.state || '',
              zip: (s.zip_codes || [])[0] || '',
              latitude: s.latitude || 0,
              longitude: s.longitude || 0,
              timestamp: s.reported_at ? (typeof s.reported_at === 'string' ? s.reported_at : new Date(s.reported_at).toISOString()) : new Date().toISOString(),
              lead_status: 'not_contacted',
              estimated_property_value: null,
            });
          }
        }

        return items.length > 0 ? items : this.getMockIncidents();
      })
    );
  }

  private getMockIncidents(): NormalizedIncident[] {
    const now = Date.now();
    const t = (min: number) => new Date(now - min * 60000).toISOString();
    return [
      { id: 'i1', type: 'fire', address: '4521 Oak Ridge Dr', city: 'Dallas', state: 'TX', zip: '75204', latitude: 32.79, longitude: -96.80, timestamp: t(2), lead_status: 'not_contacted', estimated_property_value: 285000 },
      { id: 'i2', type: 'hail', address: 'Dallas County', city: 'Plano', state: 'TX', zip: '75024', latitude: 33.02, longitude: -96.75, timestamp: t(5), lead_status: 'contacted', estimated_property_value: 320000 },
      { id: 'i3', type: 'wind', address: 'Tarrant County', city: 'Fort Worth', state: 'TX', zip: '76102', latitude: 32.76, longitude: -97.33, timestamp: t(8), lead_status: 'not_contacted', estimated_property_value: 245000 },
      { id: 'i4', type: 'lightning', address: 'Hillsborough County', city: 'Tampa', state: 'FL', zip: '33601', latitude: 27.95, longitude: -82.46, timestamp: t(9), lead_status: 'not_contacted', estimated_property_value: 198000 },
      { id: 'i5', type: 'crime', address: '890 Elm St', city: 'Chicago', state: 'IL', zip: '60601', latitude: 41.88, longitude: -87.63, timestamp: t(12), lead_status: 'not_contacted', estimated_property_value: 175000 },
      { id: 'i6', type: 'fire', address: '1420 Oak St', city: 'Plano', state: 'TX', zip: '75075', latitude: 33.02, longitude: -96.70, timestamp: t(15), lead_status: 'converted', estimated_property_value: 310000 },
      { id: 'i7', type: 'hail', address: 'Oklahoma County', city: 'Oklahoma City', state: 'OK', zip: '73102', latitude: 35.47, longitude: -97.52, timestamp: t(18), lead_status: 'not_contacted', estimated_property_value: 225000 },
      { id: 'i8', type: 'wind', address: 'Fulton County', city: 'Atlanta', state: 'GA', zip: '30301', latitude: 33.75, longitude: -84.39, timestamp: t(22), lead_status: 'contacted', estimated_property_value: 275000 },
      { id: 'i9', type: 'fire', address: '2100 Pine Blvd', city: 'Charlotte', state: 'NC', zip: '28202', latitude: 35.23, longitude: -80.84, timestamp: t(25), lead_status: 'not_contacted', estimated_property_value: 340000 },
      { id: 'i10', type: 'hail', address: 'Travis County', city: 'Austin', state: 'TX', zip: '78701', latitude: 30.27, longitude: -97.74, timestamp: t(30), lead_status: 'not_contacted', estimated_property_value: 415000 },
    ];
  }
}
