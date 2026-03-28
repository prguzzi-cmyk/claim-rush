import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { RotationLead } from 'src/app/models/rotation-lead.model';
import { LeadRotationEngineService, RotationDecision } from './lead-rotation-engine.service';
import {
  VoiceCallOutcome,
  VoiceCallRecord,
  VoiceOutreachSession,
  QualificationData,
  CallSequence,
  CallSequenceStep,
  DEFAULT_CALL_SEQUENCE,
  VoiceHandoffPayload,
  VoiceCommunicationEntry,
  InitiateCallRequest,
  InitiateCallResponse,
  VoiceProviderCapabilities,
  CALL_OUTCOME_META,
  createEmptyQualificationData,
} from '../models/voice-outreach.model';

/**
 * VoiceOutreachEngine
 *
 * Orchestrates AI voice outreach workflow:
 * - Initiates outbound calls via provider-agnostic backend API
 * - Tracks call outcomes and qualification data
 * - Routes qualified leads into the Lead Rotation Engine
 * - Manages multi-step retry sequences with channel fallback
 * - Produces human handoff payloads for task creation
 * - Generates communications timeline entries
 *
 * Integrates with (does NOT duplicate):
 * - LeadRotationEngine (assignment of qualified leads)
 * - RotationLeadService (lead CRUD, contact recording)
 * - CommunicationHubService (timeline visibility)
 * - Engagement sequences (fallback SMS/email channels)
 * - Task engine (human follow-up task creation)
 *
 * Provider abstraction: all voice calls go through the backend
 * API which delegates to the configured provider (VAPI, Retell, etc.).
 */
@Injectable({ providedIn: 'root' })
export class VoiceOutreachEngineService {

  private basePath = 'voice-outreach';

  constructor(
    private http: HttpClient,
    private rotationEngine: LeadRotationEngineService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // 1. Call Initiation (provider-agnostic)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Initiate an outbound voice call for a lead.
   * The backend selects the configured provider (VAPI, etc.).
   */
  initiateCall(request: InitiateCallRequest): Observable<InitiateCallResponse> {
    return this.http.post<InitiateCallResponse>(
      `${this.basePath}/initiate`, request
    ).pipe(
      catchError(err => of({
        success: false,
        callId: null,
        error: err?.error?.detail || 'Call initiation failed',
      }))
    );
  }

  /**
   * Build the lead context variables for the voice AI assistant.
   * These are passed to the provider as variable overrides.
   */
  buildLeadContext(lead: RotationLead): Record<string, string> {
    return {
      owner_name: lead.owner_name || '',
      property_address: lead.property_address || '',
      property_city: lead.property_city || '',
      property_state: lead.property_state || '',
      property_zip: lead.property_zip || '',
      incident_type: lead.incident_type || '',
      lead_source: lead.lead_source || '',
      phone: lead.phone || '',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Call Status & Outcome Tracking
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get the current call status from the backend.
   */
  getCallStatus(callId: string): Observable<any> {
    return this.http.get<any>(`${this.basePath}/calls/${callId}/status`).pipe(
      catchError(() => of(null))
    );
  }

  /**
   * Record the outcome of a completed call.
   */
  recordCallOutcome(
    callId: string,
    outcome: VoiceCallOutcome,
    qualification: QualificationData | null,
    transcriptSummary: string | null,
  ): Observable<VoiceCallRecord> {
    return this.http.post<VoiceCallRecord>(
      `${this.basePath}/calls/${callId}/outcome`,
      { outcome, qualification_data: qualification, transcript_summary: transcriptSummary }
    );
  }

  /**
   * Get the full outreach session for a lead (all call attempts).
   */
  getSession(leadId: string): Observable<VoiceOutreachSession | null> {
    return this.http.get<VoiceOutreachSession>(
      `${this.basePath}/sessions/${leadId}`
    ).pipe(
      catchError(() => of(null))
    );
  }

  /**
   * Get call history for a lead.
   */
  getCallHistory(leadId: string): Observable<VoiceCallRecord[]> {
    return this.http.get<VoiceCallRecord[]>(
      `${this.basePath}/leads/${leadId}/calls`
    ).pipe(
      catchError(() => of([]))
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Outcome → Lead Rotation Integration
  // ═══════════════════════════════════════════════════════════════

  /**
   * Determine if a call outcome should feed into lead rotation.
   */
  shouldRouteToRotation(outcome: VoiceCallOutcome): boolean {
    return CALL_OUTCOME_META[outcome]?.feedsRotation === true;
  }

  /**
   * Determine the priority for a qualified call.
   */
  getRoutingPriority(outcome: VoiceCallOutcome): 'low' | 'medium' | 'high' {
    if (outcome === 'urgent_followup') return 'high';
    if (outcome === 'qualified_lead') return 'high';
    if (outcome === 'possible_claim') return 'medium';
    return 'low';
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Multi-Step Call Sequence
  // ═══════════════════════════════════════════════════════════════

  /**
   * Determine the next step in a call sequence based on current progress.
   * Returns null if the sequence is exhausted.
   */
  getNextSequenceStep(
    session: VoiceOutreachSession,
    sequence: CallSequence = DEFAULT_CALL_SEQUENCE,
  ): CallSequenceStep | null {
    const completedAttempts = session.totalAttempts;

    // Walk through steps and find the next unexecuted one
    let attemptsSoFar = 0;
    for (const step of sequence.steps) {
      attemptsSoFar += step.maxAttempts;
      if (completedAttempts < attemptsSoFar) {
        return step;
      }
    }
    return null; // Sequence exhausted
  }

  /**
   * Check if the next step should use a fallback channel (SMS/email).
   */
  isChannelFallback(step: CallSequenceStep): boolean {
    return step.channel !== 'voice';
  }

  /**
   * Compute when the next step should execute based on delay.
   */
  computeNextStepTime(
    lastAttemptAt: string | null,
    step: CallSequenceStep,
  ): Date {
    const base = lastAttemptAt ? new Date(lastAttemptAt) : new Date();
    return new Date(base.getTime() + step.delayMinutes * 60 * 1000);
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Human Handoff
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build a human handoff payload from a call record.
   * This produces the data needed to create a ClaimTask for adjuster follow-up.
   */
  buildHandoffPayload(
    lead: RotationLead,
    callRecord: VoiceCallRecord,
  ): VoiceHandoffPayload {
    const outcome = callRecord.outcome || 'possible_claim';
    const priority = this.getRoutingPriority(outcome as VoiceCallOutcome);

    const qualData = callRecord.qualificationData;
    const damageDesc = qualData?.damageType
      ? ` — ${qualData.damageType} damage`
      : '';
    const eventDesc = qualData?.eventType
      ? ` (${qualData.eventType})`
      : '';

    return {
      leadId: lead.id,
      callRecordId: callRecord.id,
      assignedAdjusterId: callRecord.assignedAdjusterId,
      transcriptSummary: callRecord.transcriptSummary,
      qualificationData: callRecord.qualificationData,
      outcome: outcome as VoiceCallOutcome,
      suggestedTaskTitle: `Voice Lead Follow-Up: ${lead.owner_name}${damageDesc}`,
      suggestedTaskDescription:
        `AI voice call with ${lead.owner_name} resulted in "${CALL_OUTCOME_META[outcome as VoiceCallOutcome]?.label || outcome}".` +
        `${eventDesc}\n` +
        `Phone: ${lead.phone}\n` +
        `Address: ${lead.property_address}, ${lead.property_city}, ${lead.property_state} ${lead.property_zip}\n` +
        (qualData?.bestTimeToCall ? `Best time to call: ${qualData.bestTimeToCall}\n` : '') +
        (callRecord.transcriptSummary ? `\nCall Summary: ${callRecord.transcriptSummary}` : ''),
      priority,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Communications Timeline Entry
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build a communications hub entry from a call record.
   * Compatible with existing ClaimCommunication / CommunicationLog patterns.
   */
  buildCommunicationEntry(
    lead: RotationLead,
    callRecord: VoiceCallRecord,
  ): VoiceCommunicationEntry {
    const outcomeMeta = callRecord.outcome
      ? CALL_OUTCOME_META[callRecord.outcome]
      : null;
    const outcomeLabel = outcomeMeta?.label || callRecord.outcome || 'Call attempted';

    return {
      channel: 'voice',
      direction: 'outbound',
      subject: `Voice Call: ${lead.owner_name} — ${outcomeLabel}`,
      body: this.buildCallSummaryBody(lead, callRecord),
      recipientPhone: lead.phone,
      callOutcome: callRecord.outcome,
      callDurationSeconds: callRecord.durationSeconds,
      transcriptSummary: callRecord.transcriptSummary,
      isSystemGenerated: true,
      provider: callRecord.provider,
      callSid: callRecord.callSid,
    };
  }

  private buildCallSummaryBody(lead: RotationLead, record: VoiceCallRecord): string {
    const lines: string[] = [
      `AI voice outreach call to ${lead.owner_name} (${lead.phone})`,
      `Outcome: ${CALL_OUTCOME_META[record.outcome as VoiceCallOutcome]?.label || record.outcome || 'Unknown'}`,
    ];
    if (record.durationSeconds != null) {
      const mins = Math.floor(record.durationSeconds / 60);
      const secs = record.durationSeconds % 60;
      lines.push(`Duration: ${mins}m ${secs}s`);
    }
    if (record.transcriptSummary) {
      lines.push(`\nSummary: ${record.transcriptSummary}`);
    }
    if (record.qualificationData) {
      const q = record.qualificationData;
      if (q.damageType) lines.push(`Damage: ${q.damageType}`);
      if (q.eventType) lines.push(`Event: ${q.eventType}`);
      if (q.lossDate) lines.push(`Loss Date: ${q.lossDate}`);
      if (q.wantsInspection != null) lines.push(`Wants Inspection: ${q.wantsInspection ? 'Yes' : 'No'}`);
    }
    if (record.assignedAdjusterName) {
      lines.push(`\nRouted to: ${record.assignedAdjusterName}`);
    }
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. Provider Capabilities
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get the capabilities of the currently configured voice provider.
   */
  getProviderCapabilities(): Observable<VoiceProviderCapabilities> {
    return this.http.get<VoiceProviderCapabilities>(
      `${this.basePath}/provider/capabilities`
    ).pipe(
      catchError(() => of({
        supportsOutboundCalls: false,
        supportsTransfer: false,
        supportsRecording: false,
        supportsTranscription: false,
        supportsRealTimeAnalysis: false,
        providerName: 'none',
      }))
    );
  }

  /**
   * Check if voice outreach is available (provider configured and enabled).
   */
  isVoiceEnabled(): Observable<boolean> {
    return this.getProviderCapabilities().pipe(
      map(cap => cap.supportsOutboundCalls)
    );
  }
}
