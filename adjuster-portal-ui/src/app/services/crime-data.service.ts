import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CrimeIncident,
  CrimeIncidentListResponse,
  CrimeIncidentStats,
  CrimeDataSourceStatus,
} from '../models/crime-incident.model';

@Injectable({ providedIn: 'root' })
export class CrimeDataService {

  constructor(private http: HttpClient) {}

  getIncidents(params?: {
    incident_type?: string;
    severity?: string;
    city?: string;
    state?: string;
    date_from?: string;
    date_to?: string;
    is_mock?: boolean;
    skip?: number;
    limit?: number;
  }): Observable<CrimeIncidentListResponse> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.incident_type) httpParams = httpParams.set('incident_type', params.incident_type);
      if (params.severity) httpParams = httpParams.set('severity', params.severity);
      if (params.city) httpParams = httpParams.set('city', params.city);
      if (params.state) httpParams = httpParams.set('state', params.state);
      if (params.date_from) httpParams = httpParams.set('date_from', params.date_from);
      if (params.date_to) httpParams = httpParams.set('date_to', params.date_to);
      if (params.is_mock !== undefined) httpParams = httpParams.set('is_mock', params.is_mock.toString());
      if (params.skip !== undefined) httpParams = httpParams.set('skip', params.skip.toString());
      if (params.limit !== undefined) httpParams = httpParams.set('limit', params.limit.toString());
    }
    return this.http.get<CrimeIncidentListResponse>('crime-incidents', { params: httpParams });
  }

  getIncidentStats(): Observable<CrimeIncidentStats> {
    return this.http.get<CrimeIncidentStats>('crime-incidents/stats');
  }

  getSourceStatuses(): Observable<{ items: CrimeDataSourceStatus[] }> {
    return this.http.get<{ items: CrimeDataSourceStatus[] }>('crime-data-sources');
  }

  triggerPoll(sourceId: string): Observable<{ msg: string }> {
    return this.http.post<{ msg: string }>(`crime-data-sources/${sourceId}/poll`, {});
  }
}
