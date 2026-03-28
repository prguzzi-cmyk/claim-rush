import { Component, OnInit, OnDestroy, Input, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { GoogleMap } from '@angular/google-maps';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { TerritoryOverlayData, AudienceSegment, AudienceFilter, CaRole, AdvocateProfile } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-territory-audience',
  templateUrl: './ca-territory-audience.component.html',
  styleUrls: ['./ca-territory-audience.component.scss'],
  standalone: false,
})
export class CaTerritoryAudienceComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  @ViewChild(GoogleMap) googleMap!: GoogleMap;

  territories: TerritoryOverlayData[] = [];
  segments: AudienceSegment[] = [];

  // Map config
  mapCenter: google.maps.LatLngLiteral = { lat: 30.0, lng: -90.0 };
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
  mapLoaded = false;
  private infoWindow: google.maps.InfoWindow | null = null;

  territoryCircles: { center: google.maps.LatLngLiteral; radius: number; options: google.maps.CircleOptions; popupHtml: string }[] = [];

  showSegmentForm = false;
  segmentForm: Partial<AudienceSegment> = {};

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.loadData();
  }

  onMapReady(): void {
    this.mapLoaded = true;
  }

  private loadData(): void {
    const terSub = this.caService.getTerritoryOverlays().subscribe(data => {
      this.territories = data;
      this.buildCircles();
    });
    this.subs.push(terSub);

    const segSub = this.caService.getAudienceSegments().subscribe(data => {
      this.segments = data;
    });
    this.subs.push(segSub);
  }

  private buildCircles(): void {
    this.territoryCircles = this.territories.map(t => ({
      center: { lat: t.center.lat, lng: t.center.lng },
      radius: t.radius_miles * 1609.34,
      options: {
        fillColor: '#3949ab',
        fillOpacity: 0.15 + (t.saturation * 0.3),
        strokeColor: '#1a237e',
        strokeWeight: 2,
        clickable: true,
      },
      popupHtml: `<strong>${t.territory_name}</strong><br>Advocate: ${t.advocate_name}<br>Homeowners: ${t.homeowner_count}<br>Saturation: ${Math.round(t.saturation * 100)}%`,
    }));
  }

  onCircleClick(idx: number): void {
    const c = this.territoryCircles[idx];
    if (!c || !this.googleMap?.googleMap) return;

    if (!this.infoWindow) this.infoWindow = new google.maps.InfoWindow();
    this.infoWindow.setContent(c.popupHtml);
    this.infoWindow.setPosition(c.center);
    this.infoWindow.open(this.googleMap.googleMap);
  }

  openSegmentForm(): void {
    this.segmentForm = { name: '', description: '', filters: [], estimated_reach: 0 };
    this.showSegmentForm = true;
  }

  closeSegmentForm(): void {
    this.showSegmentForm = false;
  }

  saveSegment(): void {
    const sub = this.caService.createSegment(this.segmentForm).subscribe(() => {
      this.closeSegmentForm();
      this.loadData();
    });
    this.subs.push(sub);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.infoWindow) this.infoWindow.close();
  }
}
