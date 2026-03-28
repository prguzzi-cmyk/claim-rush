import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  RotationLead,
  RotationLeadCreate,
  RotationLeadUpdate,
  RotationConfig,
  RotationConfigUpdate,
  ContactAttemptRequest,
  ReassignRequest,
  RotationLeadMetrics,
} from '../models/rotation-lead.model';

@Injectable({ providedIn: 'root' })
export class RotationLeadService {
  private leadsPath = 'rotation-leads';
  private configPath = 'rotation-config';

  constructor(private http: HttpClient) {}

  // ── Rotation Leads ─────────────────────────────────────────────────

  create(data: RotationLeadCreate): Observable<RotationLead> {
    return this.http.post<RotationLead>(this.leadsPath, data);
  }

  list(filters?: { status?: string; agent_id?: string; incident_type?: string }): Observable<RotationLead[]> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('lead_status', filters.status);
    if (filters?.agent_id) params = params.set('agent_id', filters.agent_id);
    if (filters?.incident_type) params = params.set('incident_type', filters.incident_type);
    return this.http.get<RotationLead[]>(this.leadsPath, { params });
  }

  getById(id: string): Observable<RotationLead> {
    return this.http.get<RotationLead>(`${this.leadsPath}/${id}`);
  }

  update(id: string, data: RotationLeadUpdate): Observable<RotationLead> {
    return this.http.patch<RotationLead>(`${this.leadsPath}/${id}`, data);
  }

  recordContact(id: string, data: ContactAttemptRequest): Observable<RotationLead> {
    return this.http.post<RotationLead>(`${this.leadsPath}/${id}/contact`, data);
  }

  reassign(id: string, data: ReassignRequest): Observable<RotationLead> {
    return this.http.post<RotationLead>(`${this.leadsPath}/${id}/reassign`, data);
  }

  getMetrics(): Observable<RotationLeadMetrics> {
    return this.http.get<RotationLeadMetrics>(`${this.leadsPath}/metrics`);
  }

  // ── Rotation Config ────────────────────────────────────────────────

  listConfigs(): Observable<RotationConfig[]> {
    return this.http.get<RotationConfig[]>(this.configPath);
  }

  createConfig(data: { territory_id?: string }): Observable<RotationConfig> {
    return this.http.post<RotationConfig>(this.configPath, data);
  }

  updateConfig(id: string, data: RotationConfigUpdate): Observable<RotationConfig> {
    return this.http.patch<RotationConfig>(`${this.configPath}/${id}`, data);
  }
}
