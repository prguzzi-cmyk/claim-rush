import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { GoogleMap } from '@angular/google-maps';
import { FireIncident, FireFilterState } from 'src/app/models/fire-incident.model';
import { FireIncidentService } from 'src/app/services/fire-incident.service';

// Marker colors by call type category
const STRUCTURE_FIRE_COLOR = '#e53935';
const WILDLAND_FIRE_COLOR = '#2e7d32';
const SATELLITE_COLOR = '#1565c0';
const HIGHLIGHT_COLOR = '#ff6f00';

@Component({
  selector: 'app-fire-incidents-map',
  templateUrl: './fire-incidents-map.component.html',
  styleUrls: ['./fire-incidents-map.component.scss'],
  standalone: false,
})
export class FireIncidentsMapComponent implements OnChanges, OnDestroy {
  @Input() filters: FireFilterState;
  @Input() focusIncident: FireIncident | null = null;
  @Output() markerClicked = new EventEmitter<FireIncident>();

  @ViewChild(GoogleMap) googleMap!: GoogleMap;
  private mapReady = false;
  mapLoaded = false;
  private infoWindow: google.maps.InfoWindow | null = null;
  private highlightedMarkerId: string | null = null;

  incidents: FireIncident[] = [];
  isLoading = false;
  totalIncidents = 0;

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

  mapMarkers: { position: google.maps.LatLngLiteral; options: google.maps.MarkerOptions; popupHtml: string; incident: FireIncident }[] = [];

  constructor(private fireIncidentService: FireIncidentService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters']) {
      this.loadIncidents();
    }
    if (changes['focusIncident'] && this.focusIncident && this.mapReady) {
      this.focusOnIncident(this.focusIncident);
    }
  }

  ngOnDestroy(): void {
    if (this.infoWindow) this.infoWindow.close();
  }

  onMapReady(): void {
    this.mapReady = true;
    this.mapLoaded = true;

    if (this.incidents.length > 0) {
      this.renderMarkers();
    }
    if (this.focusIncident) {
      this.focusOnIncident(this.focusIncident);
    }
  }

  loadIncidents(): void {
    this.isLoading = true;
    const params: any = {};
    if (this.filters) {
      if (this.filters.agencyId) params.agency_id = this.filters.agencyId;
      if (this.filters.callType) params.call_type = this.filters.callType;
      if (this.filters.dateFrom) params.date_from = this.filters.dateFrom;
      if (this.filters.dateTo) params.date_to = this.filters.dateTo;
    }

    this.fireIncidentService.getIncidents(1, 2000, params).subscribe({
      next: (res) => {
        this.incidents = (res.items || []).filter(
          (i: FireIncident) => i.latitude != null && i.longitude != null
        );
        this.totalIncidents = res.total || 0;
        this.isLoading = false;
        if (this.mapReady) {
          this.renderMarkers();
        }
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  renderMarkers(): void {
    if (!this.mapReady) return;

    this.highlightedMarkerId = null;
    const markers: typeof this.mapMarkers = [];
    const boundsCoords: google.maps.LatLngLiteral[] = [];

    for (const incident of this.incidents) {
      if (incident.latitude == null || incident.longitude == null) continue;

      const pos: google.maps.LatLngLiteral = { lat: incident.latitude, lng: incident.longitude };
      const color = this.getColorForCallType(incident.call_type);

      markers.push({
        position: pos,
        options: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        },
        popupHtml: this.buildPopupHtml(incident),
        incident,
      });
      boundsCoords.push(pos);
    }

    this.mapMarkers = markers;

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

    this.markerClicked.emit(m.incident);
  }

  private focusOnIncident(incident: FireIncident): void {
    if (!this.googleMap?.googleMap) return;

    // Restore previous highlight
    if (this.highlightedMarkerId && this.highlightedMarkerId !== incident.id) {
      const prevIdx = this.mapMarkers.findIndex(m => m.incident.id === this.highlightedMarkerId);
      if (prevIdx >= 0) {
        const prevIncident = this.mapMarkers[prevIdx].incident;
        this.mapMarkers[prevIdx] = {
          ...this.mapMarkers[prevIdx],
          options: {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: this.getColorForCallType(prevIncident.call_type),
              fillOpacity: 0.9,
              strokeColor: '#fff',
              strokeWeight: 2,
            },
          },
        };
      }
    }

    const idx = this.mapMarkers.findIndex(m => m.incident.id === incident.id);
    if (idx >= 0) {
      // Set highlight icon (larger, orange)
      this.mapMarkers[idx] = {
        ...this.mapMarkers[idx],
        options: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: HIGHLIGHT_COLOR,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
          },
          zIndex: 999,
        },
      };
      this.highlightedMarkerId = incident.id;
      // Trigger change detection
      this.mapMarkers = [...this.mapMarkers];

      this.googleMap.googleMap.panTo(this.mapMarkers[idx].position);
      this.googleMap.googleMap.setZoom(Math.max(this.googleMap.googleMap.getZoom() || 5, 15));

      // Show popup
      if (!this.infoWindow) this.infoWindow = new google.maps.InfoWindow();
      this.infoWindow.setContent(this.mapMarkers[idx].popupHtml);
      this.infoWindow.setPosition(this.mapMarkers[idx].position);
      this.infoWindow.open(this.googleMap.googleMap);
    } else if (incident.latitude != null && incident.longitude != null) {
      this.googleMap.googleMap.panTo({ lat: incident.latitude, lng: incident.longitude });
      this.googleMap.googleMap.setZoom(15);
    }
  }

  private buildPopupHtml(incident: FireIncident): string {
    const unitsHtml = this.getUnitsDisplay(incident.units);
    const receivedAt = incident.received_at
      ? new Date(incident.received_at).toLocaleString()
      : 'Unknown';
    const sourceLabel = 'UPA Incident Intelligence Network';

    return `
      <div class="incident-popup">
        <strong>${this.escapeHtml(incident.call_type_description || incident.call_type)}</strong><br/>
        <span>${this.escapeHtml(incident.address || 'Unknown address')}</span><br/>
        <small>Agency: ${this.escapeHtml(incident.agency?.name || '—')}</small><br/>
        <small>Source: ${this.escapeHtml(sourceLabel)}</small><br/>
        <small>Units: ${this.escapeHtml(unitsHtml)}</small><br/>
        <small>Received: ${this.escapeHtml(receivedAt)}</small>
      </div>
    `;
  }

  getColorForCallType(callType: string | undefined): string {
    const wildlandTypes = ['VEG', 'WVEG', 'GF', 'OF', 'FF', 'VF', 'WF', 'CB', 'IF'];
    const satelliteTypes = ['SAT'];
    if (callType && wildlandTypes.includes(callType)) return WILDLAND_FIRE_COLOR;
    if (callType && satelliteTypes.includes(callType)) return SATELLITE_COLOR;
    return STRUCTURE_FIRE_COLOR;
  }

  getUnitsDisplay(unitsJson: string | null): string {
    if (!unitsJson) return '—';
    try {
      const units = JSON.parse(unitsJson);
      return Array.isArray(units) ? units.join(', ') : '—';
    } catch {
      return '—';
    }
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
