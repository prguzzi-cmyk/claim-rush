import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, forkJoin, interval, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LiveActivityItem, ActivityEventType } from '../models/live-activity.model';
import { DashboardService } from './dashboard.service';
import { PlatformActivityService, PlatformActivityEvent } from './platform-activity.service';

// ─────────────────────────────────────────────────────────────────────
// CLAIM-OPPORTUNITY FILTERING (display-only)
// ─────────────────────────────────────────────────────────────────────
// The Dashboard Live Activity Feed is for ACI/ClaimRush fire-lead
// operations, NOT a general-purpose dispatch feed. Medical, traffic,
// training, public-service, and EMS-only calls are noise — no claim
// opportunity, and they damage trust on the operator-facing surface.
//
// Raw `/fire-incidents` data is preserved upstream — the Fire Incidents
// page (`/app/fire-incidents`) does its own fetch and shows everything.
// This filter is display-only, applied at feed-build time.
//
// Order matters: BLOCK list runs FIRST so a description like "Medical
// at Fire Department" never slips through on the "fire" allow keyword.
const CLAIM_OPPORTUNITY_KEYWORDS = [
  'fire', 'structure', 'residential', 'commercial', 'smoke',
  'explosion', 'gas leak', 'water', 'storm', 'wind', 'hail', 'flood',
  'alarm',
];
const NON_CLAIM_BLOCK_KEYWORDS = [
  'medical', 'ems', 'traffic', 'collision', 'mva', 'crash',
  'public service', 'service call', 'training', 'drill',
  'investigation only',
];
function isClaimOpportunityIncident(desc: string): boolean {
  const d = (desc || '').toLowerCase();
  if (NON_CLAIM_BLOCK_KEYWORDS.some(k => d.includes(k))) return false;
  return CLAIM_OPPORTUNITY_KEYWORDS.some(k => d.includes(k));
}

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
        const fireList: LiveActivityItem[] = (Array.isArray(fireItems) ? fireItems : [])
          // Claim-opportunity filtering — drop dispatches that aren't a
          // property-damage / fire-claim opportunity (Medical, Traffic,
          // Training, Public Service, EMS-only). See top of file.
          .filter((fi: any) =>
            isClaimOpportunityIncident(fi.call_type_description || fi.call_type || ''))
          .map((fi: any, idx: number) => {
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

        // Map platform events (skip fire_incident to avoid duplicates).
        // Trust filter: drop `claim_opened` events whose `detail` is empty.
        // The backend builds claim activity titles as "Claim Opened — CLM-{N}"
        // and uses `insurance_company` as `detail`. An empty `detail` means
        // the claim row is a half-formed / orphan record — surfacing these
        // on the dashboard misleads operators because the Claims page
        // can't render anything useful for the click-through. Backend
        // data is unchanged; this is display-only suppression. Once a
        // claim has a real carrier populated, it appears in the feed.
        const platformList: LiveActivityItem[] = (Array.isArray(platform) ? platform : [])
          .filter((pe: PlatformActivityEvent) => pe.event_type !== 'fire_incident')
          .filter((pe: PlatformActivityEvent) =>
            pe.event_type !== 'claim_opened' || (pe.detail && pe.detail.trim().length > 0))
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

        // Always emit the real result — even if empty. The previous code
        // here injected hardcoded demo events ("Structure Fire — 4521 Oak
        // Ridge Dr, Dallas TX", "Client Signed — Patricia Hernandez Claim
        // #8834", etc.) when the APIs returned no data. Those demo rows
        // looked indistinguishable from live events, eroding operator
        // trust. The dashboard template already renders an honest empty
        // state when activityFeed is empty, so no fake fill-in is needed.
        this.isLive = combined.length > 0;
        this.activities$.next(combined);
      },
      error: () => {
        // Both APIs failed — emit empty so the dashboard renders its
        // empty state. Do NOT seed demo data on failure.
        this.isLive = false;
        this.activities$.next([]);
      },
    });
  }

  ngOnDestroy() {
    this.stopPolling();
  }
}
