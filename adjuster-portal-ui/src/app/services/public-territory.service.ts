import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { PublicTerritory } from '../models/public-territory.model';

export interface TerritoryApplication {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  state_of_interest: string;
  city_county_of_interest: string;
  experience_background: string;
  notes: string;
}

@Injectable({ providedIn: 'root' })
export class PublicTerritoryService {
  /**
   * Uses native fetch() to bypass ApiInterceptor (auth headers, 401 handling).
   */
  getPublicTerritories(): Observable<PublicTerritory[]> {
    return from(
      fetch('/v1/public/territories').then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<PublicTerritory[]>;
      })
    );
  }

  submitApplication(application: TerritoryApplication): Observable<{ success: boolean; message: string }> {
    return from(
      fetch('/v1/public/territories/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(application),
      }).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ success: boolean; message: string }>;
      })
    );
  }
}
