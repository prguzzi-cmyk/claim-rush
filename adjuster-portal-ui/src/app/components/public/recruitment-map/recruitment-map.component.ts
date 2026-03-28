import {
  Component,
  NgZone,
  OnInit,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { GoogleMap } from '@angular/google-maps';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PublicTerritory } from 'src/app/models/public-territory.model';
import { PublicTerritoryService, TerritoryApplication } from 'src/app/services/public-territory.service';
import { GeoDataService } from 'src/app/services/geo-data.service';
import { UsStatesService } from 'src/app/services/us-states.service';

@Component({
  selector: 'app-recruitment-map',
  templateUrl: './recruitment-map.component.html',
  styleUrls: ['./recruitment-map.component.scss'],
  standalone: false,
})
export class RecruitmentMapComponent implements OnInit, OnDestroy {
  @ViewChild(GoogleMap) googleMap!: GoogleMap;

  territories: PublicTerritory[] = [];
  selectedTerritory: PublicTerritory | null = null;
  loading = true;
  submitting = false;
  submitted = false;

  private mapReady = false;
  mapLoaded = false;
  private statesDataLayer: google.maps.Data | null = null;
  private countiesDataLayer: google.maps.Data | null = null;
  private customDataLayer: google.maps.Data | null = null;
  private clickTimer: any = null;

  currentView: 'national' | 'counties' = 'national';
  currentStateName = '';
  private currentStateFips = '';

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

  /** Available states for the dropdown (derived from territory data) */
  availableStates: string[] = [];

  /** Computed from live backend data */
  totalTerritories = 0;
  availableTerritoryCount = 0;
  takenTerritoryCount = 0;

  /**
   * Territory status per state — computed from backend data.
   * 'taken'   = all territories in this state are claimed       → RED
   * 'partial' = some territories available, some taken          → YELLOW
   * 'available' = all territories in this state are available   → GREEN
   */
  territoryStatusMap: Record<string, 'taken' | 'partial' | 'available'> = {};

  /** Live ticker messages — rebuilt after data loads */
  tickerMessages: string[] = [];

  /** Platform modules — top feature section (no company names) */
  platformModules = [
    { icon: 'dashboard', title: 'Claims Platform', desc: 'Full CRM, case management, lead tracking, commission intelligence, and team hierarchy.' },
    { icon: 'bolt', title: 'Lead Generation Engine', desc: 'Storm tracking, fire monitoring, crime intel, skip tracing, and AI-powered lead scoring.' },
    { icon: 'engineering', title: 'Field Operations', desc: 'Inspection scheduling, remote capture, voice outreach, and boots-on-the-ground coordination.' },
    { icon: 'school', title: 'Training & Licensing', desc: 'Licensing prep, continuing education, onboarding systems, and adjuster certification.' },
    { icon: 'precision_manufacturing', title: 'AI Estimating Engine', desc: 'AI-powered damage estimates, carrier comparison, defense reports, and supplement workflows.' },
  ];

  /** Ecosystem companies — company structure only */
  ecosystemBrands = [
    { name: 'UPA', letter: 'U', color: '#800020', tagline: 'Nonprofit Advocacy' },
    { name: 'ACI', letter: 'A', color: '#F97316', tagline: 'Licensed Adjusting' },
    { name: 'Respro', letter: 'R', color: '#3B82F6', tagline: 'Restoration' },
    { name: 'Academy', letter: 'L', color: '#8B5CF6', tagline: 'Adjuster Training' },
    { name: 'Maximus', letter: 'M', color: '#22C55E', tagline: 'Enterprise Marketing System' },
  ];

  /** Feature cards */
  features = [
    { icon: 'lock', title: 'Exclusive Territory', desc: 'One Chapter President per territory. No internal competition. The territory is yours to build and protect.' },
    { icon: 'trending_up', title: 'Recurring Revenue', desc: 'Earn from every claim in your state — commissions, overrides, and platform fees from your downline.' },
    { icon: 'groups', title: 'Recruit & Lead', desc: 'Build a team of adjusters under your territory. You recruit, train, and earn from their production.' },
    { icon: 'hub', title: 'Full Platform Access', desc: 'CRM, lead engine, estimating, voice outreach, AI intake, and marketing — all included in your territory.' },
  ];

  /** Marketing firepower stats */
  marketingStats = [
    { value: '100+', label: 'Person Marketing Team', icon: 'groups' },
    { value: '24/7', label: 'Lead Generation Engine', icon: 'bolt' },
    { value: '5', label: 'Integrated Brands', icon: 'hub' },
    { value: 'AI', label: 'Powered Outreach', icon: 'smart_toy' },
  ];

  /** Application form */
  applyForm = new FormGroup({
    firstName: new FormControl('', [Validators.required]),
    lastName: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    phone: new FormControl('', [Validators.required]),
    stateOfInterest: new FormControl('', [Validators.required]),
    cityCountyOfInterest: new FormControl(''),
    experienceBackground: new FormControl(''),
    notes: new FormControl(''),
  });

  constructor(
    private publicTerritoryService: PublicTerritoryService,
    private geoDataService: GeoDataService,
    private usStatesService: UsStatesService,
    private snackBar: MatSnackBar,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.publicTerritoryService.getPublicTerritories().subscribe({
      next: (data) => {
        this.territories = data;
        this.loading = false;

        // Build unique state list for form dropdown
        const stateSet = new Set<string>();
        for (const t of data) {
          if (t.state) stateSet.add(t.state);
        }
        this.availableStates = Array.from(stateSet).sort();

        // Compute territory counts and status map from live data
        this.computeTerritoryStats(data);

        if (this.mapReady) {
          this.renderCurrentView();
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  /**
   * Compute all territory stats from the live backend dataset.
   * This is the SINGLE source of truth — no hardcoded numbers.
   */
  private computeTerritoryStats(data: PublicTerritory[]): void {
    this.totalTerritories = data.length;

    // A territory is "taken" if it has a CP assigned OR is full OR is locked
    const isTaken = (t: PublicTerritory) =>
      t.status === 'cp_assigned' || t.status === 'full' || t.status === 'locked';

    this.takenTerritoryCount = data.filter(isTaken).length;
    this.availableTerritoryCount = data.filter((t) => t.status === 'available').length;

    // Build per-state status map for the map coloring
    // Group territories by state
    const byState = new Map<string, PublicTerritory[]>();
    for (const t of data) {
      if (!t.state) continue;
      const key = t.state.toUpperCase();
      if (!byState.has(key)) byState.set(key, []);
      byState.get(key)!.push(t);
    }

    this.territoryStatusMap = {};
    for (const [state, territories] of byState) {
      const allTaken = territories.every(isTaken);
      const allAvailable = territories.every((t) => t.status === 'available');

      if (allTaken) {
        this.territoryStatusMap[state] = 'taken';
      } else if (allAvailable) {
        this.territoryStatusMap[state] = 'available';
      } else {
        this.territoryStatusMap[state] = 'partial';
      }
    }

    // Rebuild ticker messages from live data
    this.tickerMessages = [
      `${this.availableTerritoryCount} territories available nationwide`,
      'Full-stack revenue-generating infrastructure included',
      'Platform ecosystem: 5 brands, 1 license',
      'Territories assigned by market size, not just state lines',
      `${this.totalTerritories} total territories across the network`,
    ];
  }

  ngOnDestroy(): void {
    this.clearLayers();
  }

  onMapReady(): void {
    this.mapReady = true;
    this.mapLoaded = true;
    if (this.territories.length > 0) {
      this.renderNationalView();
    }
  }

  /** Territory status from live computed map */
  getTerritoryStatus(stateAbbrev: string | null): 'taken' | 'partial' | 'available' {
    if (!stateAbbrev) return 'available';
    return this.territoryStatusMap[stateAbbrev.toUpperCase()] || 'available';
  }

  getPublicStatus(territory: PublicTerritory): string {
    const status = this.getTerritoryStatus(territory.state);
    if (status === 'taken') return 'Fully Claimed';
    if (status === 'partial') return 'Partially Available';
    return 'Available';
  }

  getPublicStatusClass(territory: PublicTerritory): string {
    const status = this.getTerritoryStatus(territory.state);
    if (status === 'taken') return 'status-claimed';
    if (status === 'partial') return 'status-limited';
    return 'status-available';
  }

  scrollToForm(): void {
    document.getElementById('application-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollToMap(): void {
    document.getElementById('territory-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Pre-fill state from map click */
  selectTerritoryFromMap(territory: PublicTerritory): void {
    this.selectedTerritory = territory;

    if (territory.state) {
      this.applyForm.patchValue({ stateOfInterest: territory.state });
    }
    if (territory.county) {
      this.applyForm.patchValue({ cityCountyOfInterest: territory.county });
    }

    // Scroll to form
    setTimeout(() => {
      document.getElementById('application-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  onSubmitApplication(): void {
    if (this.applyForm.invalid || this.submitting) return;

    this.submitting = true;
    const v = this.applyForm.value;

    const payload: TerritoryApplication = {
      first_name: v.firstName || '',
      last_name: v.lastName || '',
      email: v.email || '',
      phone: v.phone || '',
      state_of_interest: v.stateOfInterest || '',
      city_county_of_interest: v.cityCountyOfInterest || '',
      experience_background: v.experienceBackground || '',
      notes: v.notes || '',
    };

    this.publicTerritoryService.submitApplication(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.submitted = true;
        this.snackBar.open('Application submitted successfully!', 'Close', {
          duration: 6000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      },
      error: () => {
        this.submitting = false;
        this.snackBar.open('Something went wrong. Please try again.', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      },
    });
  }

  // ── View rendering (map logic unchanged) ──

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

      this.statesDataLayer.setStyle((feature) => {
        const fips = String(feature.getId() || '');
        const stateInfo = this.usStatesService.getStateByFips(fips);
        if (!stateInfo) return this.defaultStyle();
        return this.getStateStyle(stateInfo.abbreviation);
      });

      this.statesDataLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
        if (this.clickTimer) clearTimeout(this.clickTimer);
        this.clickTimer = setTimeout(() => {
          this.zone.run(() => this.onStateClick(event.feature));
        }, 250);
      });

      this.statesDataLayer.addListener('dblclick', (event: google.maps.Data.MouseEvent) => {
        if (this.clickTimer) {
          clearTimeout(this.clickTimer);
          this.clickTimer = null;
        }
        const fips = String(event.feature.getId() || '');
        this.zone.run(() => this.drillIntoStateByFips(fips));
      });

      this.statesDataLayer.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
        this.statesDataLayer?.overrideStyle(event.feature, { strokeWeight: 3, fillOpacity: 0.6 });
      });
      this.statesDataLayer.addListener('mouseout', (event: google.maps.Data.MouseEvent) => {
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

      this.countiesDataLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
        this.zone.run(() => this.onCountyClick(event.feature, stateFips));
      });

      this.countiesDataLayer.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
        this.countiesDataLayer?.overrideStyle(event.feature, { strokeWeight: 3, fillOpacity: 0.6 });
      });
      this.countiesDataLayer.addListener('mouseout', (event: google.maps.Data.MouseEvent) => {
        this.countiesDataLayer?.revertStyle(event.feature);
      });

      const bounds = new google.maps.LatLngBounds();
      this.countiesDataLayer.forEach((feature) => {
        feature.getGeometry()?.forEachLatLng((latlng) => bounds.extend(latlng));
      });
      this.googleMap.googleMap.fitBounds(bounds, 20);
    });
  }

  private renderCustomTerritories(): void {
    const custom = this.territories.filter(
      (t) => t.territory_type === 'custom' && t.custom_geometry
    );
    if (custom.length === 0 || !this.googleMap?.googleMap) return;

    const features: GeoJSON.Feature[] = [];
    for (const t of custom) {
      try {
        const geom = JSON.parse(t.custom_geometry!);
        features.push({
          type: 'Feature',
          geometry: geom,
          properties: { name: t.name },
        });
      } catch {
        // skip invalid geometry
      }
    }

    if (features.length === 0) return;

    this.customDataLayer = new google.maps.Data({ map: this.googleMap.googleMap });
    this.customDataLayer.addGeoJson({ type: 'FeatureCollection', features });

    this.customDataLayer.setStyle((feature) => {
      const t = custom.find((ct) => ct.name === feature.getProperty('name'));
      return this.getTerritoryStyle(t);
    });

    this.customDataLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
      const t = custom.find((ct) => ct.name === event.feature.getProperty('name'));
      if (t) {
        this.zone.run(() => this.selectTerritoryFromMap(t));
      }
    });
  }

  // ── Styling ──

  /** Color states by territory assignment: RED=taken, YELLOW=partial, GREEN=available */
  private getStateStyle(stateAbbrev: string): google.maps.Data.StyleOptions {
    const status = this.getTerritoryStatus(stateAbbrev);
    if (status === 'taken') {
      // RED — fully claimed
      return { fillColor: '#EF4444', strokeWeight: 1, strokeOpacity: 1, strokeColor: '#B91C1C', fillOpacity: 0.5 };
    }
    if (status === 'partial') {
      // YELLOW — partially available
      return { fillColor: '#EAB308', strokeWeight: 1, strokeOpacity: 1, strokeColor: '#A16207', fillOpacity: 0.5 };
    }
    // GREEN — fully available
    return { fillColor: '#22C55E', strokeWeight: 1, strokeOpacity: 1, strokeColor: '#15803D', fillOpacity: 0.45 };
  }

  private getTerritoryStyle(territory: PublicTerritory | undefined): google.maps.Data.StyleOptions {
    if (!territory?.state) return this.defaultStyle();
    return this.getStateStyle(territory.state);
  }

  private defaultStyle(): google.maps.Data.StyleOptions {
    // GREEN — no assignment data means available
    return { fillColor: '#22C55E', strokeWeight: 1, strokeOpacity: 1, strokeColor: '#15803D', fillOpacity: 0.45 };
  }

  // ── Interaction ──

  private onStateClick(feature: google.maps.Data.Feature): void {
    const fips = String(feature.getId() || '');
    const stateInfo = this.usStatesService.getStateByFips(fips);
    if (!stateInfo) return;

    const territory = this.territories.find(
      (t) =>
        t.territory_type === 'state' &&
        t.state?.toUpperCase() === stateInfo.abbreviation
    );

    const t = territory || {
      name: stateInfo.name,
      territory_type: 'state',
      state: stateInfo.abbreviation,
      county: null,
      zip_code: null,
      custom_geometry: null,
      status: 'available' as const,
      chapter_president_name: null,
      adjuster_count: 0,
      max_adjusters: 3,
      slots_remaining: 3,
    };

    this.selectTerritoryFromMap(t);
  }

  private onCountyClick(feature: google.maps.Data.Feature, stateFips: string): void {
    const countyName = String(feature.getProperty('name') || '');
    const stateInfo = this.usStatesService.getStateByFips(stateFips);
    if (!stateInfo) return;

    const territory = this.territories.find(
      (t) =>
        t.territory_type === 'county' &&
        t.state?.toUpperCase() === stateInfo.abbreviation &&
        t.county?.toLowerCase() === countyName.toLowerCase()
    );

    const t = territory || {
      name: `${countyName}, ${stateInfo.abbreviation}`,
      territory_type: 'county',
      state: stateInfo.abbreviation,
      county: countyName,
      zip_code: null,
      custom_geometry: null,
      status: 'available' as const,
      chapter_president_name: null,
      adjuster_count: 0,
      max_adjusters: 3,
      slots_remaining: 3,
    };

    this.selectTerritoryFromMap(t);
  }

  drillIntoState(stateAbbrev: string): void {
    const fips = this.usStatesService.getFipsForState(stateAbbrev);
    if (fips) {
      this.selectedTerritory = null;
      this.drillIntoStateByFips(fips);
    }
  }

  private drillIntoStateByFips(fips: string): void {
    this.selectedTerritory = null;
    this.renderCountyView(fips);
  }

  backToNational(): void {
    this.selectedTerritory = null;
    if (this.googleMap?.googleMap) {
      this.googleMap.googleMap.panTo({ lat: 39.5, lng: -98.35 });
      this.googleMap.googleMap.setZoom(4);
    }
    this.renderNationalView();
  }

  closeInfoPanel(): void {
    this.selectedTerritory = null;
  }

  private clearLayers(): void {
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
