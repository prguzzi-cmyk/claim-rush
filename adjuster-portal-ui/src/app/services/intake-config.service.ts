import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface IntakeConfig {
  id: string;
  // Identity
  intake_name: string;
  slug: string;
  is_active: boolean;
  campaign_tag: string | null;
  // Representative
  rep_name: string | null;
  rep_title: string | null;
  rep_phone: string | null;
  rep_email: string | null;
  ai_secretary_enabled: boolean;
  // Hierarchy
  assigned_cp_id: string | null;
  assigned_rvp_id: string | null;
  assigned_agent_id: string | null;
  territory_id: string | null;
  // Routing
  default_assignee_id: string | null;
  fallback_home_office: boolean;
  rescue_enabled: boolean;
  territory_enforcement: boolean;
  // Scripts
  voice_script_version: string | null;
  sms_script_version: string | null;
  intake_opening_script: string | null;
  brochure_link: string | null;
  // Links
  public_url: string | null;
  tracked_outreach_url: string | null;
  qr_link: string | null;
  // Resolved names
  assigned_cp_name: string | null;
  assigned_rvp_name: string | null;
  assigned_agent_name: string | null;
  default_assignee_name: string | null;
  territory_name: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class IntakeConfigService {
  private basePath = 'intake-config';

  constructor(private http: HttpClient) {}

  list(): Observable<IntakeConfig[]> {
    return this.http.get<IntakeConfig[]>(this.basePath);
  }

  get(id: string): Observable<IntakeConfig> {
    return this.http.get<IntakeConfig>(`${this.basePath}/${id}`);
  }

  create(data: Partial<IntakeConfig>): Observable<IntakeConfig> {
    return this.http.post<IntakeConfig>(this.basePath, data);
  }

  update(id: string, data: Partial<IntakeConfig>): Observable<IntakeConfig> {
    return this.http.patch<IntakeConfig>(`${this.basePath}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.basePath}/${id}`);
  }
}
