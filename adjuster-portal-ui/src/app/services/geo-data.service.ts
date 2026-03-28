import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import * as topojson from 'topojson-client';

@Injectable({
  providedIn: 'root',
})
export class GeoDataService {
  private statesGeoJSON$: Observable<GeoJSON.FeatureCollection> | null = null;
  private countiesTopo: any = null;
  private countiesLoading$: Observable<any> | null = null;

  constructor(private http: HttpClient) {}

  getStatesGeoJSON(): Observable<GeoJSON.FeatureCollection> {
    if (!this.statesGeoJSON$) {
      // Use fetch() to bypass the API interceptor for local assets
      this.statesGeoJSON$ = from(
        fetch('assets/geo/us-states.json').then((res) => res.json())
      ).pipe(
        map((topo: any) => topojson.feature(topo, topo.objects.states) as unknown as GeoJSON.FeatureCollection),
        shareReplay(1)
      );
    }
    return this.statesGeoJSON$;
  }

  getCountiesForState(stateFips: string): Observable<GeoJSON.FeatureCollection> {
    if (this.countiesTopo) {
      return of(this.filterCountiesByState(this.countiesTopo, stateFips));
    }

    if (!this.countiesLoading$) {
      // Use fetch() to bypass the API interceptor for CDN requests
      this.countiesLoading$ = from(
        fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json').then((res) => res.json())
      ).pipe(
        tap((topo) => {
          this.countiesTopo = topo;
          this.countiesLoading$ = null;
        }),
        shareReplay(1)
      );
    }

    return this.countiesLoading$.pipe(
      map((topo) => this.filterCountiesByState(topo, stateFips))
    );
  }

  private filterCountiesByState(topo: any, stateFips: string): GeoJSON.FeatureCollection {
    const allCounties = topojson.feature(topo, topo.objects.counties) as unknown as GeoJSON.FeatureCollection;
    const filtered = allCounties.features.filter((f) => {
      const id = String(f.id || '');
      // County FIPS: first 2 digits = state FIPS
      return id.substring(0, 2) === stateFips;
    });
    return { type: 'FeatureCollection', features: filtered };
  }
}
