import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LeadRescueLog {
  id: string;
  lead_id: string;
  tracker_id: string | null;
  original_agent_id: string | null;
  new_assigned_agent_id: string | null;
  rescue_reason: string;
  score_tier: string | null;
  rescue_level: string | null;
  escalation_level_at_rescue: number | null;
  notes: string | null;
  is_converted: boolean;
  rvp_rescue: boolean;
  cp_rescue: boolean;
  original_agent_name: string | null;
  new_agent_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface RescueStatusResponse {
  lead_id: string;
  is_rescued: boolean;
  score_tier: string | null;
  rescue_count: number;
  latest_rescue: LeadRescueLog | null;
}

export interface RescueScanResponse {
  scanned: number;
  rescued: number;
  rescue_ids: string[];
}

@Injectable({ providedIn: 'root' })
export class LeadRescueService {
  private basePath = 'lead-rescue';

  constructor(private http: HttpClient) {}

  triggerRescue(leadId: string, scoreTier?: string): Observable<LeadRescueLog> {
    return this.http.post<LeadRescueLog>(`${this.basePath}/trigger`, {
      lead_id: leadId,
      score_tier: scoreTier || null,
    });
  }

  scanInactive(): Observable<RescueScanResponse> {
    return this.http.post<RescueScanResponse>(`${this.basePath}/scan-inactive`, {});
  }

  markConverted(leadId: string): Observable<LeadRescueLog> {
    return this.http.post<LeadRescueLog>(`${this.basePath}/mark-converted`, {
      lead_id: leadId,
    });
  }

  getStatus(leadId: string): Observable<RescueStatusResponse> {
    return this.http.get<RescueStatusResponse>(`${this.basePath}/${leadId}/status`);
  }

  getLogs(leadId?: string, limit = 50, offset = 0): Observable<LeadRescueLog[]> {
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());
    if (leadId) {
      params = params.set('lead_id', leadId);
    }
    return this.http.get<LeadRescueLog[]>(`${this.basePath}/logs`, { params });
  }

  getHistory(leadId: string): Observable<LeadRescueLog[]> {
    return this.http.get<LeadRescueLog[]>(`${this.basePath}/${leadId}/history`);
  }

  getRescueLevelLabel(level: string | null): string {
    switch (level) {
      case 'rvp': return 'RVP';
      case 'cp': return 'Chapter President';
      default: return 'System';
    }
  }

  getRescueReasonLabel(reason: string): string {
    switch (reason) {
      case 'escalation_cp': return 'CP Escalation';
      case 'escalation_rvp': return 'RVP Escalation';
      case 'inactivity_timeout': return '60min Inactivity';
      default: return reason;
    }
  }

  getScoreTierColor(tier: string | null): string {
    switch (tier) {
      case 'high': return '#dc2626';
      case 'strong': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#6b7280';
      default: return '#94a3b8';
    }
  }
}
