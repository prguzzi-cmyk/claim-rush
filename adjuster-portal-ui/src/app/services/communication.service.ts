import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import {
  CommunicationLog,
  CommunicationMetrics,
  MessageTemplate,
  VoiceScript,
  DashboardMetrics,
  SendRequest,
  VoiceCallRequest,
} from '../models/communication-log.model';

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {

  constructor(private http: HttpClient) { }

  // ── Dashboard ──

  getDashboardMetrics() {
    return this.http.get<DashboardMetrics>('communications-hub/dashboard');
  }

  // ── Communication Logs ──

  getLeadCommunications(leadId: string, channel?: string) {
    let url = `leads/${leadId}/communications`;
    if (channel) {
      url += `?channel=${channel}`;
    }
    return this.http.get<CommunicationLog[]>(url);
  }

  getCommunications(params: any = {}) {
    return this.http.get<any>('communications-hub/communications', { params });
  }

  getConversationThread(leadId: string) {
    return this.http.get<CommunicationLog[]>(`communications-hub/communications/${leadId}/thread`);
  }

  resendCommunication(leadId: string) {
    return this.http.post<CommunicationLog>(`leads/${leadId}/communications/resend`, {});
  }

  // ── Send Actions ──

  sendSms(request: SendRequest) {
    return this.http.post<any>('communications-hub/send/sms', request);
  }

  sendEmail(request: SendRequest) {
    return this.http.post<any>('communications-hub/send/email', request);
  }

  sendVoiceCall(request: VoiceCallRequest) {
    return this.http.post<any>('communications-hub/send/voice', request);
  }

  triggerSkipTrace(leadIds: string[]) {
    return this.http.post<any>('communications-hub/skip-trace', { lead_ids: leadIds });
  }

  sendTestEmail(to: string) {
    return this.http.post<any>('communications/test-email', { to });
  }

  // ── Message Templates ──

  getTemplates(category?: string) {
    const params: any = {};
    if (category) params.category = category;
    return this.http.get<MessageTemplate[]>('communications-hub/templates', { params });
  }

  createTemplate(template: Partial<MessageTemplate>) {
    return this.http.post<MessageTemplate>('communications-hub/templates', template);
  }

  updateTemplate(id: string, template: Partial<MessageTemplate>) {
    return this.http.put<MessageTemplate>(`communications-hub/templates/${id}`, template);
  }

  deleteTemplate(id: string) {
    return this.http.delete(`communications-hub/templates/${id}`);
  }

  // ── Voice Scripts ──

  getVoiceScripts(category?: string) {
    const params: any = {};
    if (category) params.category = category;
    return this.http.get<VoiceScript[]>('communications-hub/voice-scripts', { params });
  }

  createVoiceScript(script: Partial<VoiceScript>) {
    return this.http.post<VoiceScript>('communications-hub/voice-scripts', script);
  }

  updateVoiceScript(id: string, script: Partial<VoiceScript>) {
    return this.http.put<VoiceScript>(`communications-hub/voice-scripts/${id}`, script);
  }

  deleteVoiceScript(id: string) {
    return this.http.delete(`communications-hub/voice-scripts/${id}`);
  }
}
