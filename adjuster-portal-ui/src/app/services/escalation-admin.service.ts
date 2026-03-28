import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LeadContactTracker {
  id: string;
  lead_id: string;
  territory_id: string | null;
  lead_type: string;
  ai_call_status: string;
  ai_call_sid: string | null;
  ai_call_started_at: string | null;
  ai_call_ended_at: string | null;
  ai_call_result: string | null;
  current_escalation_level: number;
  current_agent_id: string | null;
  escalation_started_at: string | null;
  contact_status: string;
  is_resolved: boolean;
  resolved_at: string | null;
  resolution_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscalationAttempt {
  id: string;
  tracker_id: string;
  lead_id: string;
  agent_id: string;
  escalation_level: number;
  escalation_label: string;
  transfer_status: string;
  transfer_call_sid: string | null;
  transfer_attempted_at: string | null;
  transfer_answered_at: string | null;
  transfer_ended_at: string | null;
  sms_sent: boolean;
  email_sent: boolean;
  in_app_sent: boolean;
  timeout_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscalationStatusResponse {
  tracker: LeadContactTracker;
  attempts: EscalationAttempt[];
  current_agent_name: string | null;
}

export interface ActiveEscalationSummary {
  id: string;
  lead_id: string;
  lead_type: string;
  contact_status: string;
  current_escalation_level: number;
  current_agent_name: string | null;
  escalation_started_at: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class EscalationAdminService {
  private basePath = 'escalation-admin';

  constructor(private http: HttpClient) {}

  listActive(limit = 50, offset = 0): Observable<ActiveEscalationSummary[]> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());
    return this.http.get<ActiveEscalationSummary[]>(`${this.basePath}/active`, { params });
  }

  getStatus(leadId: string): Observable<EscalationStatusResponse> {
    return this.http.get<EscalationStatusResponse>(`${this.basePath}/${leadId}/status`);
  }

  resolve(trackerId: string, resolutionType = 'manual_close'): Observable<LeadContactTracker> {
    const params = new HttpParams().set('resolution_type', resolutionType);
    return this.http.post<LeadContactTracker>(`${this.basePath}/${trackerId}/resolve`, null, { params });
  }
}
