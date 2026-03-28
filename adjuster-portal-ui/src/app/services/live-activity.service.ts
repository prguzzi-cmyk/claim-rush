import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, forkJoin, interval, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LiveActivityItem, ActivityEventType } from '../models/live-activity.model';
import { DashboardService } from './dashboard.service';
import { PlatformActivityService, PlatformActivityEvent } from './platform-activity.service';

@Injectable({
  providedIn: 'root',
})
export class LiveActivityService implements OnDestroy {
  activities$ = new BehaviorSubject<LiveActivityItem[]>([]);
  focusEvent$ = new Subject<LiveActivityItem>();
  /** Emits when the drawer should toggle open/closed */
  drawerToggle$ = new Subject<void>();
  /** True when the last refresh got real API data */
  isLive = false;

  private pollSub: Subscription | null = null;
  private dashboardService = inject(DashboardService);
  private platformActivityService = inject(PlatformActivityService);

  startPolling(intervalMs = 30000) {
    if (this.pollSub) return; // Already polling
    this.refresh();
    this.pollSub = interval(intervalMs).subscribe(() => this.refresh());
  }

  stopPolling() {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = null;
    }
  }

  /** Force an immediate refresh from APIs */
  forceRefresh(): void {
    this.refresh();
  }

  focusOnEvent(item: LiveActivityItem) {
    this.focusEvent$.next(item);
  }

  private refresh() {
    const dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const routeMap: Record<string, string> = {
      lead_created: '/leads',
      skip_trace_completed: '/leads',
      voice_call: '/voice-campaigns',
      claim_opened: '/claims',
    };

    forkJoin({
      fires: this.dashboardService.getRecentFireIncidents(1, 50, dateFrom).pipe(
        catchError(() => of([] as any[]))
      ),
      platform: this.platformActivityService.getSnapshot()
        ? of(this.platformActivityService.getSnapshot())
        : of([] as PlatformActivityEvent[]),
    }).subscribe({
      next: ({ fires, platform }) => {
        const fireItems = fires?.items || fires?.data || fires || [];
        const fireList: LiveActivityItem[] = (Array.isArray(fireItems) ? fireItems : []).map(
          (fi: any, idx: number) => {
            const desc = fi.call_type_description || fi.call_type || 'Incident';
            const addr = fi.address || 'Unknown location';
            return {
              id: fi.id || `fi-${idx}`,
              eventType: 'fire_incident' as ActivityEventType,
              icon: 'local_fire_department',
              label: `${desc} — ${addr}`,
              sublabel: 'UPA Incident Intelligence Network',
              timestamp: new Date(fi.received_at || fi.created_at || Date.now()),
              route: '/fire-incidents',
              entityId: fi.id,
              entityType: 'fire_incident',
              latitude: fi.latitude ?? undefined,
              longitude: fi.longitude ?? undefined,
              state: fi.agency?.state || undefined,
              county: fi.agency?.county || undefined,
              zip_code: fi.agency?.zip_code || undefined,
            } as LiveActivityItem;
          }
        );

        // Map platform events (skip fire_incident to avoid duplicates)
        const platformList: LiveActivityItem[] = (Array.isArray(platform) ? platform : [])
          .filter((pe: PlatformActivityEvent) => pe.event_type !== 'fire_incident')
          .map((pe: PlatformActivityEvent) => ({
            id: pe.id,
            eventType: pe.event_type as ActivityEventType,
            icon: pe.icon,
            label: `${pe.title}${pe.detail ? ' — ' + pe.detail : ''}`,
            sublabel: pe.location || undefined,
            timestamp: new Date(pe.timestamp),
            route: routeMap[pe.event_type] || undefined,
            entityId: pe.id,
            entityType: pe.event_type,
          } as LiveActivityItem));

        const combined = [...fireList, ...platformList];
        combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (combined.length > 0) {
          this.isLive = true;
          this.activities$.next(combined);
        } else {
          // APIs succeeded but returned no data — show demo content, flagged as not-live
          this.isLive = false;
          // Only show fallback if we've never had real data
          if (this.activities$.getValue().length === 0) {
            this.activities$.next(this.generateFallbackData());
          }
        }
      },
      error: () => {
        // Both APIs failed — network is down. Show mock data
        // so the dashboard isn't empty, but flag it.
        this.isLive = false;
        this.activities$.next(this.generateFallbackData());
      },
    });
  }

  /**
   * Fallback data shown when APIs return no results or are unavailable.
   */
  private generateFallbackData(): LiveActivityItem[] {
    const now = Date.now();
    const m = (min: number) => new Date(now - min * 60000);

    const items: LiveActivityItem[] = [
      { id: 'demo-2', eventType: 'fire_incident' as ActivityEventType, icon: 'local_fire_department', label: 'Structure Fire — 4521 Oak Ridge Dr, Dallas TX', sublabel: 'UPA Incident Intelligence Network', timestamp: m(2), route: '/fire-incidents', entityType: 'fire_incident', latitude: 32.7876, longitude: -96.7985, state: 'TX', county: 'Dallas', zip_code: '75204' },
      { id: 'demo-3', eventType: 'storm_alert' as ActivityEventType, icon: 'thunderstorm', label: 'Severe Thunderstorm Warning — Tarrant County', sublabel: 'UPA Incident Intelligence Network', timestamp: m(3), route: '/storm-intelligence', entityType: 'storm_alert', latitude: 32.7593, longitude: -97.1467, state: 'TX', county: 'Tarrant', zip_code: '76006' },
      { id: 'demo-4', eventType: 'lead_assigned' as ActivityEventType, icon: 'assignment_ind', label: 'Lead Assigned — Maria Gonzalez → Agent Torres', timestamp: m(4), route: '/leads', entityType: 'lead' },
      { id: 'demo-5', eventType: 'client_signed' as ActivityEventType, icon: 'how_to_reg', label: 'Client Signed — Patricia Hernandez (Claim #8834)', timestamp: m(12), route: '/clients', entityType: 'client' },
    ];
    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  ngOnDestroy() {
    this.stopPolling();
  }
}
