import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  OutreachCampaign,
  OutreachTemplate,
  OutreachAttempt,
  OutreachMetrics,
  ConversationMessage,
  TemplatePreviewRequest,
  CampaignPreviewResponse,
  CampaignDashboardMetrics,
  CampaignStep,
} from '../models/outreach.model';

@Injectable({
  providedIn: 'root',
})
export class OutreachService {
  private base = 'outreach';

  constructor(private http: HttpClient) {}

  // ── Campaigns ──

  getCampaigns() {
    return this.http.get<OutreachCampaign[]>(`${this.base}/campaigns`).pipe(
      map((response) => response)
    );
  }

  createCampaign(campaign: Partial<OutreachCampaign>) {
    return this.http.post<OutreachCampaign>(`${this.base}/campaigns`, campaign).pipe(
      map((response) => response)
    );
  }

  createCampaignWithSteps(campaign: any): Observable<OutreachCampaign> {
    return this.http.post<OutreachCampaign>(`${this.base}/campaigns/with-steps`, campaign).pipe(
      map((response) => response)
    );
  }

  updateCampaign(id: string, campaign: Partial<OutreachCampaign>) {
    return this.http.put<OutreachCampaign>(`${this.base}/campaigns/${id}`, campaign).pipe(
      map((response) => response)
    );
  }

  deleteCampaign(id: string) {
    return this.http.delete<any>(`${this.base}/campaigns/${id}`).pipe(
      map((response) => response)
    );
  }

  toggleCampaign(id: string) {
    return this.http.post<OutreachCampaign>(`${this.base}/campaigns/${id}/toggle`, {}).pipe(
      map((response) => response)
    );
  }

  launchCampaign(campaignId: string): Observable<OutreachCampaign> {
    return this.http.post<OutreachCampaign>(`${this.base}/campaigns/${campaignId}/launch`, {}).pipe(
      map((response) => response)
    );
  }

  pauseCampaign(campaignId: string): Observable<OutreachCampaign> {
    return this.http.post<OutreachCampaign>(`${this.base}/campaigns/${campaignId}/pause`, {}).pipe(
      map((response) => response)
    );
  }

  previewLeads(targeting: {
    incident_type?: string;
    target_zip_code?: string;
    target_radius_miles?: number;
    lead_source?: string;
    territory_state?: string;
  }): Observable<CampaignPreviewResponse> {
    return this.http.post<CampaignPreviewResponse>(`${this.base}/campaigns/preview-leads`, targeting).pipe(
      map((response) => response)
    );
  }

  getDashboardMetrics(): Observable<CampaignDashboardMetrics> {
    return this.http.get<CampaignDashboardMetrics>(`${this.base}/dashboard-metrics`).pipe(
      map((response) => response)
    );
  }

  // ── Campaign Steps ──

  getCampaignSteps(campaignId: string): Observable<CampaignStep[]> {
    return this.http.get<CampaignStep[]>(`${this.base}/campaigns/${campaignId}/steps`).pipe(
      map((response) => response)
    );
  }

  addCampaignStep(campaignId: string, step: Partial<CampaignStep>): Observable<CampaignStep> {
    return this.http.post<CampaignStep>(`${this.base}/campaigns/${campaignId}/steps`, step).pipe(
      map((response) => response)
    );
  }

  deleteCampaignStep(campaignId: string, stepId: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/campaigns/${campaignId}/steps/${stepId}`).pipe(
      map((response) => response)
    );
  }

  // ── Templates ──

  getTemplates(channel?: string) {
    let params: any = {};
    if (channel) {
      params.channel = channel;
    }
    return this.http.get<OutreachTemplate[]>(`${this.base}/templates`, { params }).pipe(
      map((response) => response)
    );
  }

  createTemplate(template: Partial<OutreachTemplate>) {
    return this.http.post<OutreachTemplate>(`${this.base}/templates`, template).pipe(
      map((response) => response)
    );
  }

  updateTemplate(id: string, template: Partial<OutreachTemplate>) {
    return this.http.put<OutreachTemplate>(`${this.base}/templates/${id}`, template).pipe(
      map((response) => response)
    );
  }

  deleteTemplate(id: string) {
    return this.http.delete<any>(`${this.base}/templates/${id}`).pipe(
      map((response) => response)
    );
  }

  previewTemplate(request: TemplatePreviewRequest) {
    return this.http.post<{ rendered: string }>(`${this.base}/templates/preview`, request).pipe(
      map((response) => response)
    );
  }

  // ── Attempts ──

  getAttempts(params?: { campaign_id?: string; lead_id?: string; status?: string }) {
    return this.http.get<OutreachAttempt[]>(`${this.base}/attempts`, { params: params as any }).pipe(
      map((response) => response)
    );
  }

  getMetrics(campaignId?: string) {
    let params: any = {};
    if (campaignId) {
      params.campaign_id = campaignId;
    }
    return this.http.get<OutreachMetrics>(`${this.base}/attempts/metrics`, { params }).pipe(
      map((response) => response)
    );
  }

  // ── Conversations ──

  getConversation(leadId: string) {
    return this.http.get<ConversationMessage[]>(`${this.base}/conversations/${leadId}`).pipe(
      map((response) => response)
    );
  }

  addMessage(leadId: string, message: Partial<ConversationMessage>) {
    return this.http.post<ConversationMessage>(`${this.base}/conversations/${leadId}`, message).pipe(
      map((response) => response)
    );
  }

  // ── Trigger ──

  triggerOutreach(campaignId: string, leadId: string) {
    return this.http.post<any>(`${this.base}/trigger`, null, {
      params: { campaign_id: campaignId, lead_id: leadId },
    }).pipe(
      map((response) => response)
    );
  }
}
