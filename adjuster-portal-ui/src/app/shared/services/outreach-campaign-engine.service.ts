import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { RotationLead } from 'src/app/models/rotation-lead.model';
import {
  OutreachCampaign,
  OutreachCampaignType,
  OutreachCampaignStep,
  OutreachCampaignMetrics,
  OutreachMessageTemplate,
  ConversationRecord,
  ConversationOutcome,
  AutomationTrigger,
  AutomationTriggerEvent,
  AgentNotificationPayload,
  AgentNotificationType,
  AGENT_NOTIFICATION_META,
  CampaignDashboardMetrics,
  CampaignStatus,
  createEmptyCampaignMetrics,
} from '../models/outreach-campaign.model';
import {
  OUTREACH_TEMPLATES,
  getOutreachTemplatesByChannel,
  getOutreachTemplateById,
  interpolateTemplate,
} from 'src/app/constants/outreach-template.config';

/**
 * OutreachCampaignEngine
 *
 * Manages automated outreach campaigns for property damage leads.
 * Orchestrates AI voice, SMS, and email across multi-step sequences.
 *
 * Integrates with (does NOT duplicate):
 * - VoiceOutreachEngine (AI voice calls — delegates voice steps to it)
 * - LeadRotationEngine (qualified lead routing)
 * - CommunicationHubService (timeline visibility)
 * - EngagementSequences (claim follow-ups — separate from lead outreach)
 * - CommunityAdvocateService (community campaigns — separate audience)
 *
 * HTTP calls go to a backend outreach-campaigns endpoint.
 * Template interpolation and automation logic are pure computation.
 */
@Injectable({ providedIn: 'root' })
export class OutreachCampaignEngineService {

  private basePath = 'outreach-campaigns';

  constructor(private http: HttpClient) {}

  // ═══════════════════════════════════════════════════════════════
  // 1. Campaign CRUD
  // ═══════════════════════════════════════════════════════════════

  getCampaigns(status?: CampaignStatus): Observable<OutreachCampaign[]> {
    const params: any = {};
    if (status) params.status = status;
    return this.http.get<OutreachCampaign[]>(this.basePath, { params }).pipe(
      catchError(() => of([]))
    );
  }

  getCampaign(id: string): Observable<OutreachCampaign | null> {
    return this.http.get<OutreachCampaign>(`${this.basePath}/${id}`).pipe(
      catchError(() => of(null))
    );
  }

  createCampaign(campaign: Partial<OutreachCampaign>): Observable<OutreachCampaign> {
    return this.http.post<OutreachCampaign>(this.basePath, campaign);
  }

  updateCampaign(id: string, updates: Partial<OutreachCampaign>): Observable<OutreachCampaign> {
    return this.http.patch<OutreachCampaign>(`${this.basePath}/${id}`, updates);
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Template Resolution
  // ═══════════════════════════════════════════════════════════════

  /** Get all available templates for a channel. */
  getTemplatesForChannel(channel: string): OutreachMessageTemplate[] {
    return getOutreachTemplatesByChannel(channel);
  }

  /** Get all available templates. */
  getAllTemplates(): OutreachMessageTemplate[] {
    return OUTREACH_TEMPLATES;
  }

  /** Resolve a template with lead context. */
  resolveTemplate(
    templateId: string,
    lead: RotationLead,
    adjusterName?: string,
    companyName?: string,
  ): { subject: string | null; body: string; callScript: string | null } | null {
    const template = getOutreachTemplateById(templateId);
    if (!template) return null;

    const context: Record<string, string> = {
      owner_name: lead.owner_name || 'Homeowner',
      property_address: `${lead.property_address}, ${lead.property_city}, ${lead.property_state} ${lead.property_zip}`,
      incident_type: lead.incident_type || 'storm',
      adjuster_name: adjusterName || 'Your Adjuster',
      company_name: companyName || 'ACI Adjuster Intelligence',
      callback_number: lead.phone || '',
      storm_type: lead.incident_type || '',
    };

    return {
      subject: template.subject ? interpolateTemplate(template.subject, context) : null,
      body: interpolateTemplate(template.body, context),
      callScript: template.callScript ? interpolateTemplate(template.callScript, context) : null,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Automation Trigger Evaluation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Find campaigns that should trigger for a given event.
   */
  findTriggeredCampaigns(
    campaigns: OutreachCampaign[],
    event: AutomationTriggerEvent,
    context?: Record<string, string>,
  ): OutreachCampaign[] {
    return campaigns.filter(c => {
      if (c.status !== 'active') return false;
      if (!c.automationTrigger) return false;
      if (c.automationTrigger.event !== event) return false;

      // Check conditions
      if (context && c.automationTrigger.conditions) {
        for (const [key, val] of Object.entries(c.automationTrigger.conditions)) {
          if (context[key] && context[key] !== val) return false;
        }
      }

      return true;
    });
  }

  /**
   * Determine the next step to execute for a lead in a campaign.
   */
  getNextStep(
    campaign: OutreachCampaign,
    completedSteps: number,
  ): OutreachCampaignStep | null {
    if (completedSteps >= campaign.steps.length) return null;
    return campaign.steps[completedSteps];
  }

  /**
   * Check if enough time has elapsed to execute the next step.
   */
  isStepReady(step: OutreachCampaignStep, lastAttemptAt: string | null): boolean {
    if (!lastAttemptAt) return true;
    const elapsed = Date.now() - new Date(lastAttemptAt).getTime();
    return elapsed >= step.delayMinutes * 60 * 1000;
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Conversation Tracking
  // ═══════════════════════════════════════════════════════════════

  /** Record a conversation outcome. */
  recordConversation(
    campaignId: string,
    leadId: string,
    stepNumber: number,
    channel: string,
    outcome: ConversationOutcome,
    notes?: string,
  ): Observable<ConversationRecord> {
    return this.http.post<ConversationRecord>(
      `${this.basePath}/${campaignId}/conversations`,
      { lead_id: leadId, step_number: stepNumber, channel, outcome, notes }
    ).pipe(
      catchError(() => of({
        id: `local-${Date.now()}`, campaignId, leadId, stepNumber, channel, outcome,
        sentAt: new Date().toISOString(), deliveredAt: null, respondedAt: null, notes: notes || null,
      } as ConversationRecord))
    );
  }

  /** Get conversation history for a campaign. */
  getConversations(campaignId: string): Observable<ConversationRecord[]> {
    return this.http.get<ConversationRecord[]>(
      `${this.basePath}/${campaignId}/conversations`
    ).pipe(catchError(() => of([])));
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Agent Notifications
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build an agent notification payload for a campaign event.
   */
  buildAgentNotification(
    type: AgentNotificationType,
    agentId: string,
    leadId: string,
    campaignId: string,
    leadName: string,
  ): AgentNotificationPayload {
    const meta = AGENT_NOTIFICATION_META[type];
    const titles: Record<AgentNotificationType, string> = {
      homeowner_responded: `${leadName} responded to outreach`,
      call_connected: `Call connected with ${leadName}`,
      appointment_requested: `${leadName} requested an appointment`,
      sms_reply_received: `SMS reply from ${leadName}`,
      email_reply_received: `Email reply from ${leadName}`,
    };

    return {
      type,
      agentId,
      leadId,
      campaignId,
      title: titles[type],
      message: `${meta.label}: ${leadName} on campaign ${campaignId}`,
      link: `/app/rotation-leads/${leadId}`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Campaign Metrics (pure computation)
  // ═══════════════════════════════════════════════════════════════

  /** Compute metrics from conversation records. */
  computeCampaignMetrics(
    conversations: ConversationRecord[],
    totalTargets: number,
  ): OutreachCampaignMetrics {
    const calls = conversations.filter(c => c.channel === 'voice').length;
    const sms = conversations.filter(c => c.channel === 'sms').length;
    const emails = conversations.filter(c => c.channel === 'email').length;
    const responses = conversations.filter(c =>
      c.outcome === 'sms_replied' || c.outcome === 'email_replied' ||
      c.outcome === 'call_connected' || c.outcome === 'appointment_booked'
    ).length;
    const appointments = conversations.filter(c => c.outcome === 'appointment_booked').length;
    const totalAttempts = conversations.length;

    return {
      totalTargets,
      callAttempts: calls,
      smsSent: sms,
      emailsSent: emails,
      responses,
      appointmentsBooked: appointments,
      contactRate: totalTargets > 0 ? (totalAttempts / totalTargets) * 100 : 0,
      responseRate: totalAttempts > 0 ? (responses / totalAttempts) * 100 : 0,
      conversionRate: totalTargets > 0 ? (appointments / totalTargets) * 100 : 0,
    };
  }

  /** Compute dashboard metrics from all campaigns. */
  computeDashboardMetrics(
    campaigns: OutreachCampaign[],
  ): CampaignDashboardMetrics {
    const active = campaigns.filter(c => c.status === 'active').length;
    let totalTargets = 0;
    let totalAttempts = 0;
    let totalResponses = 0;
    let totalConverted = 0;

    const byChannel: Record<string, { attempts: number; responses: number; rate: number }> = {};
    const byCampaign: { name: string; targets: number; contacted: number; converted: number }[] = [];

    for (const c of campaigns) {
      const m = c.metrics;
      totalTargets += m.totalTargets;
      totalAttempts += m.callAttempts + m.smsSent + m.emailsSent;
      totalResponses += m.responses;
      totalConverted += m.appointmentsBooked;

      for (const ch of ['voice', 'sms', 'email'] as const) {
        if (!byChannel[ch]) byChannel[ch] = { attempts: 0, responses: 0, rate: 0 };
        const attempts = ch === 'voice' ? m.callAttempts : ch === 'sms' ? m.smsSent : m.emailsSent;
        byChannel[ch].attempts += attempts;
      }
      byChannel['voice'].responses += c.metrics.responses; // simplified

      byCampaign.push({
        name: c.name,
        targets: m.totalTargets,
        contacted: m.callAttempts + m.smsSent + m.emailsSent,
        converted: m.appointmentsBooked,
      });
    }

    // Compute rates
    for (const ch of Object.values(byChannel)) {
      ch.rate = ch.attempts > 0 ? (ch.responses / ch.attempts) * 100 : 0;
    }

    return {
      activeCampaigns: active,
      totalLeadsTargeted: totalTargets,
      totalContactAttempts: totalAttempts,
      overallContactRate: totalTargets > 0 ? (totalAttempts / totalTargets) * 100 : 0,
      overallResponseRate: totalAttempts > 0 ? (totalResponses / totalAttempts) * 100 : 0,
      overallConversionRate: totalTargets > 0 ? (totalConverted / totalTargets) * 100 : 0,
      byChannel,
      byCampaign,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. Campaign Builder Helpers
  // ═══════════════════════════════════════════════════════════════

  /** Build a default multi-step campaign structure. */
  buildDefaultMultiStepCampaign(
    name: string,
    leadSource: string,
    targetState?: string,
  ): Partial<OutreachCampaign> {
    return {
      name,
      campaignType: 'multi_step',
      status: 'draft',
      leadSource,
      targetState: targetState || null,
      targetTerritoryId: null,
      steps: [
        { stepNumber: 1, channel: 'voice', templateId: 'voice-storm-intro',  delayMinutes: 0,    subject: null, callScriptKey: 'voice-storm-intro' },
        { stepNumber: 2, channel: 'sms',   templateId: 'sms-storm-intro',    delayMinutes: 120,  subject: null, callScriptKey: null },
        { stepNumber: 3, channel: 'voice', templateId: 'voice-followup',     delayMinutes: 1440, subject: null, callScriptKey: 'voice-followup' },
        { stepNumber: 4, channel: 'email', templateId: 'email-followup',     delayMinutes: 2880, subject: null, callScriptKey: null },
      ],
      automationTrigger: {
        event: 'new_lead_created',
        delayMinutes: 0,
        conditions: { lead_source: leadSource },
      },
      metrics: createEmptyCampaignMetrics(),
    };
  }

  /** Build a single-channel campaign. */
  buildSingleChannelCampaign(
    name: string,
    channel: 'voice' | 'sms' | 'email',
    templateId: string,
    leadSource: string,
  ): Partial<OutreachCampaign> {
    const typeMap: Record<string, OutreachCampaignType> = {
      voice: 'ai_voice', sms: 'sms', email: 'email',
    };
    return {
      name,
      campaignType: typeMap[channel],
      status: 'draft',
      leadSource,
      targetState: null,
      targetTerritoryId: null,
      steps: [
        { stepNumber: 1, channel, templateId, delayMinutes: 0, subject: null, callScriptKey: channel === 'voice' ? templateId : null },
      ],
      automationTrigger: null,
      metrics: createEmptyCampaignMetrics(),
    };
  }
}
