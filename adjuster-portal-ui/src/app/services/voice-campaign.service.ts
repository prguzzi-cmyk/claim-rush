import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  VoiceCampaign,
  VoiceCampaignCreate,
  VoiceCallLog,
  VoiceCallLogDetail,
  VoiceCampaignAnalytics,
  VoiceUsageSummary,
  CampaignLaunchRequest,
} from '../models/voice-campaign.model';

@Injectable({ providedIn: 'root' })
export class VoiceCampaignService {
  private basePath = 'voice-campaigns';

  constructor(private http: HttpClient) {}

  // ── Campaign CRUD ──

  create(data: VoiceCampaignCreate): Observable<VoiceCampaign> {
    return this.http.post<VoiceCampaign>(`${this.basePath}/`, data);
  }

  list(status?: string): Observable<VoiceCampaign[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<VoiceCampaign[]>(`${this.basePath}/`, { params }).pipe(
      catchError(() => of([]))
    );
  }

  getById(id: string): Observable<VoiceCampaign> {
    return this.http.get<VoiceCampaign>(`${this.basePath}/${id}`);
  }

  update(id: string, data: Partial<VoiceCampaignCreate>): Observable<VoiceCampaign> {
    return this.http.patch<VoiceCampaign>(`${this.basePath}/${id}`, data);
  }

  launch(id: string, request: CampaignLaunchRequest): Observable<VoiceCampaign> {
    return this.http.post<VoiceCampaign>(`${this.basePath}/${id}/launch`, request);
  }

  pause(id: string): Observable<VoiceCampaign> {
    return this.http.post<VoiceCampaign>(`${this.basePath}/${id}/pause`, {});
  }

  resume(id: string): Observable<VoiceCampaign> {
    return this.http.post<VoiceCampaign>(`${this.basePath}/${id}/resume`, {});
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.basePath}/${id}`);
  }

  // ── Call Logs ──

  getCallLogs(filters?: { campaign_id?: string; outcome?: string }): Observable<VoiceCallLog[]> {
    let params = new HttpParams();
    if (filters?.campaign_id) params = params.set('campaign_id', filters.campaign_id);
    if (filters?.outcome) params = params.set('outcome', filters.outcome);
    return this.http.get<VoiceCallLog[]>(`${this.basePath}/call-logs`, { params }).pipe(
      catchError(() => of([]))
    );
  }

  getCallLogDetail(id: string): Observable<VoiceCallLogDetail> {
    return this.http.get<VoiceCallLogDetail>(`${this.basePath}/call-logs/${id}`);
  }

  getTranscript(callId: string): Observable<VoiceCallLogDetail> {
    return this.http.get<VoiceCallLogDetail>(`${this.basePath}/transcripts/${callId}`);
  }

  // ── Analytics ──

  getAnalytics(campaignId?: string): Observable<VoiceCampaignAnalytics> {
    const url = campaignId
      ? `${this.basePath}/analytics/${campaignId}`
      : `${this.basePath}/analytics`;
    return this.http.get<VoiceCampaignAnalytics>(url).pipe(
      catchError(() => of({
        total_calls: 0,
        calls_answered: 0,
        conversion_rate: 0,
        avg_duration_seconds: 0,
        outcome_breakdown: {},
        daily_trend: [],
      }))
    );
  }

  // ── Usage ──

  getUsage(): Observable<VoiceUsageSummary> {
    return this.http.get<VoiceUsageSummary>(`${this.basePath}/usage`).pipe(
      catchError(() => of({
        minutes_used: 0,
        plan_limit_minutes: 500,
        percent_used: 0,
        call_count: 0,
        overage_minutes: 0,
      }))
    );
  }
}
