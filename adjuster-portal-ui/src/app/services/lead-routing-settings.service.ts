import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  LeadRoutingSettings,
  LeadRoutingSettingsUpsert,
} from '../models/lead-routing-settings.model';

@Injectable({ providedIn: 'root' })
export class LeadRoutingSettingsService {
  private readonly base = 'lead-routing-settings';

  constructor(private http: HttpClient) {}

  list(): Observable<LeadRoutingSettings[]> {
    return this.http.get<LeadRoutingSettings[]>(this.base);
  }

  get(leadSource: string): Observable<LeadRoutingSettings> {
    return this.http.get<LeadRoutingSettings>(`${this.base}/${leadSource}`);
  }

  upsert(leadSource: string, body: LeadRoutingSettingsUpsert): Observable<LeadRoutingSettings> {
    return this.http.put<LeadRoutingSettings>(`${this.base}/${leadSource}`, body);
  }

  deactivate(leadSource: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${leadSource}`);
  }
}
