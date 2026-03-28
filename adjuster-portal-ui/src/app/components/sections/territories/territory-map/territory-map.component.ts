import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  NgZone,
  ViewChild,
} from '@angular/core';
import { GoogleMap } from '@angular/google-maps';
import { TerritoryWithAssignments } from 'src/app/models/territory.model';
import { GeoDataService } from 'src/app/services/geo-data.service';
import { UsStatesService } from 'src/app/services/us-states.service';

@Component({
  selector: 'app-territory-map',
  templateUrl: './territory-map.component.html',
  styleUrls: ['./territory-map.component.scss'],
  standalone: false,
})
export class TerritoryMapComponent implements OnChanges, OnDestroy {
  @Input() territories: TerritoryWithAssignments[] = [];
  @Input() adminMode = false;
  @Output() territoryClicked = new EventEmitter<TerritoryWithAssignments>();
  @Output() createTerritory = new EventEmitter<any>();

  @ViewChild(GoogleMap) googleMap!: GoogleMap;
  private mapReady = false;
  mapLoaded = false;

  private statesDataLayer: google.maps.Data | null = null;
  private countiesDataLayer: google.maps.Data | null = null;
  private customDataLayer: google.maps.Data | null = null;
  private selectedFeature: google.maps.Data.Feature | null = null;
  private clickTimer: any = null;
  private drawingManager: google.maps.drawing.DrawingManager | null = null;

  currentView: 'national' | 'counties' = 'national';
  currentStateName = '';
  private currentStateFips = '';
  selectedTerritory: TerritoryWithAssignments | null = null;
  drawingMode = false;

  mapCenter: google.maps.LatLngLiteral = { lat: 39.5, lng: -98.35 };
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

  constructor(
    private geoDataService: GeoDataService,
    private usStatesService: UsStatesService,
    private ngZone: NgZone
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['territories'] && this.mapReady) {
      this.renderCurrentView();
    }
  }

  ngOnDestroy(): void {
    this.clearLayers();
    if (this.drawingManager) {
      this.drawingManager.setMap(null);
    }
  }

  onMapReady(): void {
    this.mapReady = true;
    this.mapLoaded = true;

    if (this.adminMode && this.googleMap?.googleMap) {
      this.googleMap.googleMap.setOptions({ disableDoubleClickZoom: true });
    }

    this.renderNationalView();
  }

  // ── GeoJSON rendering ──────────────────────────────────────

  private renderCurrentView(): void {
    if (this.currentView === 'national') {
      this.renderNationalView();
    } else {
      this.renderCountyView(this.currentStateFips);
    }
  }

  private renderNationalView(): void {
    this.clearLayers();
    this.currentView = 'national';

    if (!this.googleMap?.googleMap) return;

    this.geoDataService.getStatesGeoJSON().subscribe((geojson) => {
      if (!this.googleMap?.googleMap) return;

      this.statesDataLayer = new google.maps.Data({ map: this.googleMap.googleMap });
      this.statesDataLayer.addGeoJson(geojson);

      // Style each feature
      this.statesDataLayer.setStyle((feature) => {
        const fips = String(feature.getId() || '');
        const stateInfo = this.usStatesService.getStateByFips(fips);
        if (!stateInfo) return this.defaultStyle();

        const territory = this.territories.find(
          (t) => t.territory_type === 'state' && t.state?.toUpperCase() === stateInfo.abbreviation
        );
        return this.getTerritoryStyle(territory);
      });

      // Click handler
      this.statesDataLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
        if (this.clickTimer) {
          clearTimeout(this.clickTimer);
          this.clickTimer = null;
        }

        const feature = event.feature;
        this.clickTimer = setTimeout(() => {
          this.clickTimer = null;
          this.ngZone.run(() => {
            this.applySelectionHighlight(feature);
            this.handleStateClick(feature);
          });
        }, 250);
      });

      // Double-click handler
      this.statesDataLayer.addListener('dblclick', (event: google.maps.Data.MouseEvent) => {
        if (this.clickTimer) {
          clearTimeout(this.clickTimer);
          this.clickTimer = null;
        }

        const fips = String(event.feature.getId() || '');
        this.ngZone.run(() => {
          this.selectedFeature = null;
          this.drillIntoStateByFips(fips);
        });
      });

      // Hover effects
      this.statesDataLayer.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
        if (event.feature === this.selectedFeature) return;
        this.statesDataLayer?.overrideStyle(event.feature, { strokeWeight: 3, fillOpacity: 0.6 });
      });

      this.statesDataLayer.addListener('mouseout', (event: google.maps.Data.MouseEvent) => {
        if (event.feature === this.selectedFeature) return;
        this.statesDataLayer?.revertStyle(event.feature);
      });

      this.renderCustomTerritories();
    });
  }

  private renderCountyView(stateFips: string): void {
    this.clearLayers();
    this.currentView = 'counties';
    this.currentStateFips = stateFips;
    const stateInfo = this.usStatesService.getStateByFips(stateFips);
    this.currentStateName = stateInfo?.name || '';

    if (!this.googleMap?.googleMap) return;

    this.geoDataService.getCountiesForState(stateFips).subscribe((geojson) => {
      if (!this.googleMap?.googleMap) return;

      this.countiesDataLayer = new google.maps.Data({ map: this.googleMap.googleMap });
      this.countiesDataLayer.addGeoJson(geojson);

      this.countiesDataLayer.setStyle((feature) => {
        const countyName = String(feature.getProperty('name') || '');
        const stInfo = this.usStatesService.getStateByFips(stateFips);
        if (!stInfo) return this.defaultStyle();

        const territory = this.territories.find(
          (t) =>
            t.territory_type === 'county' &&
            t.state?.toUpperCase() === stInfo.abbreviation &&
            t.county?.toLowerCase() === countyName.toLowerCase()
        );
        return this.getTerritoryStyle(territory);
      });

      // Click handler
      this.countiesDataLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
        this.ngZone.run(() => {
          this.applySelectionHighlight(event.feature);
          this.handleCountyClick(event.feature);
        });
      });

      // Hover effects
      this.countiesDataLayer.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
        if (event.feature === this.selectedFeature) return;
        this.countiesDataLayer?.overrideStyle(event.feature, { strokeWeight: 3, fillOpacity: 0.6 });
      });

      this.countiesDataLayer.addListener('mouseout', (event: google.maps.Data.MouseEvent) => {
        if (event.feature === this.selectedFeature) return;
        this.countiesDataLayer?.revertStyle(event.feature);
      });

      // Fit bounds
      const bounds = new google.maps.LatLngBounds();
      this.countiesDataLayer.forEach((feature) => {
        feature.getGeometry()?.forEachLatLng((latlng) => bounds.extend(latlng));
      });
      this.googleMap.googleMap.fitBounds(bounds, 20);
    });
  }

  private renderCustomTerritories(): void {
    const customTerritories = this.territories.filter(
      (t) => t.territory_type === 'custom' && t.custom_geometry
    );
    if (customTerritories.length === 0 || !this.googleMap?.googleMap) return;

    const features: GeoJSON.Feature[] = [];
    for (const t of customTerritories) {
      try {
        const geom = JSON.parse(t.custom_geometry!);
        features.push({
          type: 'Feature',
          geometry: geom,
          properties: { territoryId: t.id },
        });
      } catch {
        // skip invalid geometry
      }
    }

    if (features.length === 0) return;

    this.customDataLayer = new google.maps.Data({ map: this.googleMap.googleMap });
    this.customDataLayer.addGeoJson({ type: 'FeatureCollection', features });

    this.customDataLayer.setStyle((feature) => {
      const t = customTerritories.find(
        (ct) => ct.id === feature.getProperty('territoryId')
      );
      return this.getTerritoryStyle(t);
    });

    this.customDataLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
      const t = customTerritories.find(
        (ct) => ct.id === event.feature.getProperty('territoryId')
      );
      if (t) {
        this.ngZone.run(() => {
          if (this.adminMode) {
            this.territoryClicked.emit(t);
          } else {
            this.selectedTerritory = t;
          }
        });
      }
    });
  }

  /** Apply an orange selection ring on the clicked polygon */
  private applySelectionHighlight(feature: google.maps.Data.Feature): void {
    // Reset previous selection
    if (this.selectedFeature) {
      const activeLayer = this.currentView === 'national' ? this.statesDataLayer : this.countiesDataLayer;
      if (activeLayer) {
        activeLayer.revertStyle(this.selectedFeature);
      }
    }

    const activeLayer = this.currentView === 'national' ? this.statesDataLayer : this.countiesDataLayer;
    if (activeLayer) {
      activeLayer.overrideStyle(feature, {
        strokeWeight: 4,
        strokeColor: '#FF6F00',
        fillOpacity: 0.7,
      });
    }
    this.selectedFeature = feature;
  }

  // ── State / County click logic ──────────────────────────────

  private handleStateClick(feature: google.maps.Data.Feature): void {
    const fips = String(feature.getId() || '');
    const stateInfo = this.usStatesService.getStateByFips(fips);
    if (!stateInfo) return;

    const territory = this.territories.find(
      (t) =>
        t.territory_type === 'state' &&
        t.state?.toUpperCase() === stateInfo.abbreviation
    );

    if (territory) {
      if (this.adminMode) {
        this.territoryClicked.emit(territory);
      } else {
        this.selectedTerritory = territory;
      }
    } else {
      this.createTerritory.emit({
        type: 'state',
        state: stateInfo.abbreviation,
        name: stateInfo.name,
      });
    }
  }

  private handleCountyClick(feature: google.maps.Data.Feature): void {
    const countyName = String(feature.getProperty('name') || '');
    const stateInfo = this.usStatesService.getStateByFips(this.currentStateFips);
    if (!stateInfo) return;

    const territory = this.territories.find(
      (t) =>
        t.territory_type === 'county' &&
        t.state?.toUpperCase() === stateInfo.abbreviation &&
        t.county?.toLowerCase() === countyName.toLowerCase()
    );

    if (territory) {
      if (this.adminMode) {
        this.territoryClicked.emit(territory);
      } else {
        this.selectedTerritory = territory;
      }
    } else {
      this.createTerritory.emit({
        type: 'county',
        state: stateInfo.abbreviation,
        county: countyName,
        name: `${countyName}, ${stateInfo.abbreviation}`,
      });
    }
  }

  // ── Styles ─────────────────────────────────────────────────

  private getTerritoryStyle(
    territory: TerritoryWithAssignments | undefined
  ): google.maps.Data.StyleOptions {
    if (!territory) {
      return this.defaultStyle();
    }

    const status = territory.territory_status || this.computeStatus(territory);

    switch (status) {
      case 'Locked':
        return {
          fillColor: '#f44336',
          strokeWeight: 1,
          strokeOpacity: 1,
          strokeColor: '#c62828',
          fillOpacity: 0.4,
        };
      case 'CP Assigned':
        return {
          fillColor: '#2196F3',
          strokeWeight: 1,
          strokeOpacity: 1,
          strokeColor: '#1565C0',
          fillOpacity: 0.4,
        };
      case 'Full':
        return {
          fillColor: '#FF9800',
          strokeWeight: 1,
          strokeOpacity: 1,
          strokeColor: '#E65100',
          fillOpacity: 0.4,
        };
      case 'Available':
      default:
        return {
          fillColor: '#4CAF50',
          strokeWeight: 1,
          strokeOpacity: 1,
          strokeColor: '#2E7D32',
          fillOpacity: 0.4,
        };
    }
  }

  private computeStatus(territory: TerritoryWithAssignments): string {
    if (!territory.is_active) return 'Locked';
    const max = territory.max_adjusters || 3;
    if ((territory.adjuster_count || 0) >= max) return 'Full';
    if (territory.chapter_president) return 'CP Assigned';
    return 'Available';
  }

  private defaultStyle(): google.maps.Data.StyleOptions {
    return {
      fillColor: '#e0e0e0',
      strokeWeight: 1,
      strokeOpacity: 1,
      strokeColor: '#999',
      fillOpacity: 0.3,
    };
  }

  // ── Navigation ─────────────────────────────────────────────

  drillIntoState(stateAbbrev: string): void {
    const fips = this.usStatesService.getFipsForState(stateAbbrev);
    if (fips) {
      this.selectedTerritory = null;
      this.drillIntoStateByFips(fips);
    }
  }

  private drillIntoStateByFips(fips: string): void {
    this.selectedTerritory = null;
    this.selectedFeature = null;
    this.renderCountyView(fips);
  }

  backToNational(): void {
    this.selectedTerritory = null;
    this.selectedFeature = null;
    if (this.googleMap?.googleMap) {
      this.googleMap.googleMap.panTo({ lat: 39.5, lng: -98.35 });
      this.googleMap.googleMap.setZoom(4);
    }
    this.renderNationalView();
  }

  closeInfoPanel(): void {
    this.selectedTerritory = null;
  }

  toggleDrawMode(): void {
    if (!this.googleMap?.googleMap) return;

    this.drawingMode = !this.drawingMode;

    if (this.drawingMode) {
      this.drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.POLYGON,
        drawingControl: false,
        polygonOptions: {
          fillColor: '#FF6F00',
          fillOpacity: 0.3,
          strokeWeight: 2,
          strokeColor: '#FF6F00',
          editable: true,
        },
      });
      this.drawingManager.setMap(this.googleMap.googleMap);

      google.maps.event.addListener(this.drawingManager, 'polygoncomplete', (polygon: google.maps.Polygon) => {
        const path = polygon.getPath();
        const coordinates: number[][] = [];
        for (let i = 0; i < path.getLength(); i++) {
          const point = path.getAt(i);
          coordinates.push([point.lng(), point.lat()]);
        }
        // Close the polygon
        if (coordinates.length > 0) {
          coordinates.push(coordinates[0]);
        }

        const geojsonGeometry = {
          type: 'Polygon',
          coordinates: [coordinates],
        };

        polygon.setMap(null);
        this.toggleDrawMode();

        this.ngZone.run(() => {
          this.createTerritory.emit({
            type: 'custom',
            geometry: JSON.stringify(geojsonGeometry),
            name: 'Custom Territory',
          });
        });
      });
    } else {
      if (this.drawingManager) {
        this.drawingManager.setMap(null);
        this.drawingManager = null;
      }
    }
  }

  private clearLayers(): void {
    this.selectedFeature = null;
    if (this.statesDataLayer) {
      this.statesDataLayer.setMap(null);
      this.statesDataLayer = null;
    }
    if (this.countiesDataLayer) {
      this.countiesDataLayer.setMap(null);
      this.countiesDataLayer = null;
    }
    if (this.customDataLayer) {
      this.customDataLayer.setMap(null);
      this.customDataLayer = null;
    }
  }
}
