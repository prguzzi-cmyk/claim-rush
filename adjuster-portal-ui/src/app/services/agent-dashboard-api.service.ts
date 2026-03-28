import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AgentDashboardLead,
  AcceptDeclineResponse,
  AgentDashboardConfig,
} from '../models/agent-dashboard.model';

@Injectable({
  providedIn: 'root',
})
export class AgentDashboardApiService {
  constructor(private http: HttpClient) {}

  getMyLeads(): Observable<AgentDashboardLead[]> {
    return this.http.get<AgentDashboardLead[]>('agent-dashboard/my-leads');
  }

  acceptLead(leadId: string): Observable<AcceptDeclineResponse> {
    return this.http.post<AcceptDeclineResponse>(
      `agent-dashboard/leads/${leadId}/accept`,
      {}
    );
  }

  declineLead(leadId: string): Observable<AcceptDeclineResponse> {
    return this.http.post<AcceptDeclineResponse>(
      `agent-dashboard/leads/${leadId}/decline`,
      {}
    );
  }

  getConfig(): Observable<AgentDashboardConfig> {
    return this.http.get<AgentDashboardConfig>('agent-dashboard/config');
  }

  getAvailability(): Observable<AgentAvailabilityResponse> {
    return this.http.get<AgentAvailabilityResponse>('agent-dashboard/availability');
  }

  updateAvailability(payload: AgentAvailabilityUpdate): Observable<AgentAvailabilityResponse> {
    return this.http.patch<AgentAvailabilityResponse>('agent-dashboard/availability', payload);
  }
}

export interface AgentAvailabilityUpdate {
  is_accepting_leads?: boolean;
  daily_lead_limit?: number | null;
}

export interface AgentAvailabilityResponse {
  is_accepting_leads: boolean;
  daily_lead_limit: number | null;
  leads_assigned_today: number;
  message: string;
}
