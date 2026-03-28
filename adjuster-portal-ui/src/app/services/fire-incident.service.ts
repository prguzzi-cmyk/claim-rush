import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  FireIncident,
  FireAgency,
  FireAgencyCreate,
  FireAgencyUpdate,
  FireDataSourceConfig,
  FireDataSourceConfigCreate,
  FireDataSourceConfigUpdate,
  FireIncidentConvertToLead,
  PropertyIntelligence,
  SkipTraceResponse,
} from '../models/fire-incident.model';

@Injectable({
  providedIn: 'root',
})
export class FireIncidentService {
  constructor(private http: HttpClient) {}

  getIncidents(
    pageIndex: number = 1,
    pageSize: number = 25,
    params: {
      agency_id?: string;
      call_type?: string;
      is_active?: boolean;
      date_from?: string;
      date_to?: string;
    } = {}
  ): Observable<any> {
    const queryParams: any = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
    };
    if (params.agency_id) queryParams['agency_id'] = params.agency_id;
    if (params.call_type) queryParams['call_type'] = params.call_type;
    if (params.is_active !== undefined) queryParams['is_active'] = params.is_active.toString();
    if (params.date_from) queryParams['date_from'] = params.date_from;
    if (params.date_to) queryParams['date_to'] = params.date_to;

    return this.http.get<any>('fire-incidents', { params: queryParams }).pipe(
      map((response) => response)
    );
  }

  getIncident(id: string): Observable<FireIncident> {
    return this.http.get<FireIncident>(`fire-incidents/${id}`).pipe(
      map((response) => response)
    );
  }

  getAgencies(pageIndex: number = 1, pageSize: number = 100): Observable<any> {
    const params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
    };
    return this.http.get<any>('fire-agencies', { params }).pipe(
      map((response) => response)
    );
  }

  addAgency(agency: FireAgencyCreate): Observable<FireAgency> {
    return this.http.post<FireAgency>('fire-agencies', agency).pipe(
      map((response) => response)
    );
  }

  updateAgency(id: string, agency: FireAgencyUpdate): Observable<FireAgency> {
    return this.http.put<FireAgency>(`fire-agencies/${id}`, agency).pipe(
      map((response) => response)
    );
  }

  deleteAgency(id: string): Observable<any> {
    return this.http.delete<any>(`fire-agencies/${id}`).pipe(
      map((response) => response)
    );
  }

  pollAgency(id: string): Observable<any> {
    return this.http.post<any>(`fire-agencies/${id}/poll`, {}).pipe(
      map((response) => response)
    );
  }

  // --- Fire Data Source Config methods ---

  getDataSourceConfigs(pageIndex: number = 1, pageSize: number = 100): Observable<any> {
    const params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
    };
    return this.http.get<any>('fire-data-source-configs', { params }).pipe(
      map((response) => response)
    );
  }

  addDataSourceConfig(config: FireDataSourceConfigCreate): Observable<FireDataSourceConfig> {
    return this.http.post<FireDataSourceConfig>('fire-data-source-configs', config).pipe(
      map((response) => response)
    );
  }

  updateDataSourceConfig(id: string, config: FireDataSourceConfigUpdate): Observable<FireDataSourceConfig> {
    return this.http.put<FireDataSourceConfig>(`fire-data-source-configs/${id}`, config).pipe(
      map((response) => response)
    );
  }

  deleteDataSourceConfig(id: string): Observable<any> {
    return this.http.delete<any>(`fire-data-source-configs/${id}`).pipe(
      map((response) => response)
    );
  }

  pollDataSource(id: string): Observable<any> {
    return this.http.post<any>(`fire-data-source-configs/${id}/poll`, {}).pipe(
      map((response) => response)
    );
  }

  getPropertyIntelligence(incidentId: string): Observable<PropertyIntelligence> {
    return this.http.get<PropertyIntelligence>(`fire-incidents/${incidentId}/property-intelligence`).pipe(
      map((response) => response)
    );
  }

  skipTrace(incidentId: string): Observable<SkipTraceResponse> {
    return this.http.get<SkipTraceResponse>(`fire-incidents/${incidentId}/skip-trace`).pipe(
      map((response) => response)
    );
  }

  convertToLead(incidentId: string, data: FireIncidentConvertToLead): Observable<any> {
    return this.http.post<any>(`fire-incidents/${incidentId}/convert-to-lead`, data).pipe(
      map((response) => response)
    );
  }

  sendOutreachSms(incidentId: string, phone: string, message: string): Observable<any> {
    return this.http.post<any>(`fire-incidents/${incidentId}/send-sms`, { phone, message }).pipe(
      map((response) => response)
    );
  }
}
