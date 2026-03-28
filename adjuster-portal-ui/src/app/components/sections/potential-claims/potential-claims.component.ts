import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { GoogleMap } from '@angular/google-maps';
import { PotentialClaimsService } from '../../../services/potential-claims.service';

// ── Potential Claims Types ──────────────────────────────────────

type ClaimEventType = 'hail' | 'wind' | 'lightning' | 'tornado' | 'flooding' | 'fire' | 'hurricane';
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
  selector: 'app-potential-claims',
  templateUrl: './potential-claims.component.html',
  styleUrls: ['./potential-claims.component.scss'],
  standalone: false,
})
export class PotentialClaimsComponent implements OnInit, OnDestroy {
  @ViewChild(GoogleMap) googleMap!: GoogleMap;
  private mapReady = false;
  mapLoaded = false;
  private infoWindow: google.maps.InfoWindow | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  // Data source indicators
  isLiveData = false;
  useLiveData = true;
  isLoading = false;
  loadError: string | null = null;

  // Google Maps config
  mapCenter: google.maps.LatLngLiteral = { lat: 32.95, lng: -96.70 };
  mapZoom = 7;
  mapOptions: google.maps.MapOptions = {
    mapTypeId: 'hybrid',
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [],
  };

  // Data
  predictedClaimEvents: PredictedClaimEvent[] = [];
  predictedClaimZones: PredictedClaimZone[] = [];
  claimTickerMessages: ClaimTickerMessage[] = [];

  // Map overlays — rebuilt by renderPredictedClaimZones() on every data load
  claimZoneCircles: { center: google.maps.LatLngLiteral; radius: number; options: google.maps.CircleOptions; zone: PredictedClaimZone }[] = [];
  fireMarkers: { position: google.maps.LatLngLiteral; options: google.maps.MarkerOptions; zone: PredictedClaimZone }[] = [];
  pulseMarkers: { center: google.maps.LatLngLiteral; options: google.maps.CircleOptions; zone: PredictedClaimZone }[] = [];
  eventMarkers: { position: google.maps.LatLngLiteral; options: google.maps.MarkerOptions; event: PredictedClaimEvent }[] = [];

  // UI state
  selectedClaimZone: PredictedClaimZone | null = null;
  claimZonePanelOpen = false;
  claimZonesLayerVisible = true;

  // Ticker
  private claimTickerInterval: ReturnType<typeof setInterval> | null = null;
  claimTickerPosition = 0;

  constructor(private claimsService: PotentialClaimsService) {}

  ngOnInit(): void {
    this.loadPredictedClaims();
    this.refreshInterval = setInterval(() => {
      if (this.useLiveData) {
        this.loadPredictedClaims();
      }
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.claimTickerInterval) {
      clearInterval(this.claimTickerInterval);
    }
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.infoWindow) this.infoWindow.close();
  }

  toggleDataSource(): void {
    this.useLiveData = !this.useLiveData;
    this.loadPredictedClaims();
  }

  onMapReady(): void {
    this.mapReady = true;
    this.mapLoaded = true;
    this.renderPredictedClaimZones();
  }

  private loadPredictedClaims(): void {
    if (this.useLiveData) {
      this.isLoading = true;
      this.loadError = null;
      console.log('[PotentialClaims] loadPredictedClaims → request start');
      forkJoin({
        events: this.claimsService.getEvents(24).pipe(catchError(err => { console.warn('[PotentialClaims] events failed:', err?.message); return of([]); })),
        zones: this.claimsService.getZones(24).pipe(catchError(err => { console.warn('[PotentialClaims] zones failed:', err?.message); return of([]); })),
        ticker: this.claimsService.getTicker(24, 20).pipe(catchError(err => { console.warn('[PotentialClaims] ticker failed:', err?.message); return of([]); })),
      }).pipe(
        timeout(45000),
        catchError(err => {
          console.error('[PotentialClaims] forkJoin timeout/error:', err?.message);
          return of({ events: [] as any[], zones: [] as any[], ticker: [] as any[] });
        }),
      ).subscribe({
        next: ({ events, zones, ticker }) => {
          this.predictedClaimEvents = events
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
            }))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

          this.predictedClaimZones = zones
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
            }))
            .sort((a, b) => {
              const sevOrder: Record<ClaimSeverity, number> = { critical: 0, high: 1, moderate: 2, monitor: 3 };
              return sevOrder[a.severity] - sevOrder[b.severity];
            });

          this.claimTickerMessages = ticker.map(t => ({
            id: t.id,
            text: t.text,
            severity: t.severity as ClaimSeverity,
            timestamp: new Date(t.timestamp),
          }));

          this.isLiveData = events.length > 0 || zones.length > 0;
          this.isLoading = false;
          this.loadError = this.isLiveData ? null : 'No predicted claims data available.';
          console.log('[PotentialClaims] loaded — events:', this.predictedClaimEvents.length,
            'zones:', this.predictedClaimZones.length,
            'ticker:', this.claimTickerMessages.length,
            'mapReady:', this.mapReady);
          this.startClaimTickerAnimation();
          this.renderPredictedClaimZones();
        },
        error: (err: any) => {
          console.error('[PotentialClaims] loadPredictedClaims → failed:', err?.message || err);
          this.isLiveData = false;
          this.isLoading = false;
          this.loadError = 'Failed to load predicted claims. Retrying in 60s...';
          this.predictedClaimEvents = [];
          this.predictedClaimZones = [];
          this.claimTickerMessages = [];
          this.renderPredictedClaimZones();
        },
      });
    }
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

    this.claimZoneCircles = [];
    this.fireMarkers = [];
    this.pulseMarkers = [];
    this.eventMarkers = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    for (const zone of this.predictedClaimZones) {
      if (!zone.active) continue;

      const color = this.getClaimSeverityColor(zone.severity);
      const center: google.maps.LatLngLiteral = { lat: zone.center[0], lng: zone.center[1] };
      bounds.extend(center);
      hasPoints = true;

      this.claimZoneCircles.push({
        center,
        radius: zone.radiusMeters,
        options: {
          fillColor: color,
          fillOpacity: 0.15,
          strokeColor: color,
          strokeWeight: 2,
          clickable: true,
        },
        zone,
      });

      // Icon marker for every zone (not just fire)
      const iconColor = zone.eventType === 'fire' ? '#ef4444'
        : zone.eventType === 'flooding' ? '#3b82f6'
        : zone.eventType === 'tornado' ? '#7c3aed'
        : color;

      this.fireMarkers.push({
        position: center,
        options: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: zone.severity === 'critical' ? 12 : 9,
            fillColor: iconColor,
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        },
        zone,
      });

      if (zone.severity === 'critical') {
        this.pulseMarkers.push({
          center,
          options: {
            fillColor: color,
            fillOpacity: 0.8,
            strokeColor: color,
            strokeWeight: 3,
            radius: 200,
            clickable: true,
          },
          zone,
        });
      }
    }

    console.log('[PotentialClaims] renderPredictedClaimZones — circles:', this.claimZoneCircles.length,
      'markers:', this.fireMarkers.length, 'pulse:', this.pulseMarkers.length,
      'from', this.predictedClaimZones.length, 'zones');

    // Auto-fit map to show all zones
    if (hasPoints && this.googleMap?.googleMap) {
      this.googleMap.googleMap.fitBounds(bounds, 50);
      // Prevent zooming in too far on a single zone
      const listener = this.googleMap.googleMap.addListener('idle', () => {
        const zoom = this.googleMap.googleMap!.getZoom();
        if (zoom && zoom > 10) {
          this.googleMap.googleMap!.setZoom(10);
        }
        google.maps.event.removeListener(listener);
      });
    }
  }

  toggleClaimZonesLayer(): void {
    this.claimZonesLayerVisible = !this.claimZonesLayerVisible;
  }

  onClaimZoneCircleClick(idx: number): void {
    const c = this.claimZoneCircles[idx];
    if (!c) return;
    this.selectClaimZone(c.zone);
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
      case 'hurricane': return 'storm';
      default: return 'warning';
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
      case 'hurricane': return 'Hurricane';
      default: return type;
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

  trackEventById(_index: number, event: PredictedClaimEvent): string { return event.id; }
  trackZoneById(_index: number, zone: PredictedClaimZone): string { return zone.id; }
  trackCircleByIdx(index: number): number { return index; }

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
