import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  IntakeSession,
  IntakeSessionStatus,
  IntakeData,
  IntakeEntryPath,
  IntakeStepKey,
  INTAKE_STEPS,
  createEmptyIntakeData,
  intakeToLeadPayload,
  intakeToClaimPayload,
  intakeToTaskPayload,
  intakeToCommunicationEntry,
  intakeToPortalNudge,
  ENTRY_PATH_LABELS,
} from '../models/intake-session.model';
// Claude-ready tone instructions are available from claim-engagement.model
// when AI summary refinement is wired to the backend.

/**
 * ClaimIntakeBot
 *
 * Central service for AI-assisted claim intake workflow.
 * Manages intake sessions, tracks progress, computes completion,
 * generates summaries, and produces payloads for existing services.
 *
 * Integrates with (does NOT duplicate):
 * - ClaimService (claim creation via addClaim, file upload, communications)
 * - LeadService (lead enrichment via updateLead)
 * - ClientService (client lookup/creation)
 * - TasksService (task creation for review/documents/photos/followup)
 * - VoiceOutreachEngine (voice session → intake conversion)
 * - ClaimEngagementEngine (anti-ghosting for abandoned intakes)
 * - CommunicationHubService (timeline entries)
 *
 * All HTTP calls use a backend intake-sessions endpoint.
 * Task/claim/lead creation is done by the caller using the payloads
 * this service produces — no side effects here.
 */
@Injectable({ providedIn: 'root' })
export class ClaimIntakeBotService {

  private basePath = 'intake-sessions';

  constructor(private http: HttpClient) {}

  // ═══════════════════════════════════════════════════════════════
  // 1. Session CRUD
  // ═══════════════════════════════════════════════════════════════

  /** Create a new intake session. */
  createSession(entryPath: IntakeEntryPath, linkedIds?: {
    leadId?: string; claimId?: string; clientId?: string; voiceCallId?: string;
  }): Observable<IntakeSession> {
    return this.http.post<IntakeSession>(this.basePath, {
      entry_path: entryPath,
      lead_id: linkedIds?.leadId || null,
      claim_id: linkedIds?.claimId || null,
      client_id: linkedIds?.clientId || null,
      voice_call_id: linkedIds?.voiceCallId || null,
    }).pipe(
      catchError(() => of(this.buildLocalSession(entryPath, linkedIds)))
    );
  }

  /** Get an existing session by ID. */
  getSession(sessionId: string): Observable<IntakeSession | null> {
    return this.http.get<IntakeSession>(`${this.basePath}/${sessionId}`).pipe(
      catchError(() => of(null))
    );
  }

  /** Get session by linked lead ID. */
  getSessionByLead(leadId: string): Observable<IntakeSession | null> {
    return this.http.get<IntakeSession>(`${this.basePath}/by-lead/${leadId}`).pipe(
      catchError(() => of(null))
    );
  }

  /** Save/update intake data for a session. */
  saveIntakeData(sessionId: string, data: IntakeData): Observable<IntakeSession> {
    return this.http.put<IntakeSession>(
      `${this.basePath}/${sessionId}/data`, { intake_data: data }
    );
  }

  /** Update session status. */
  updateStatus(sessionId: string, status: IntakeSessionStatus): Observable<IntakeSession> {
    return this.http.patch<IntakeSession>(
      `${this.basePath}/${sessionId}/status`, { status }
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Progress Tracking (pure computation)
  // ═══════════════════════════════════════════════════════════════

  /** Compute which intake steps are complete based on the data. */
  computeCompletedSteps(data: IntakeData): string[] {
    const completed: string[] = [];
    for (const step of INTAKE_STEPS) {
      if (step.requiredFields.length === 0) continue;
      const allFilled = step.requiredFields.every(f => {
        const val = data[f];
        return val !== null && val !== undefined && val !== '';
      });
      if (allFilled) completed.push(step.key);
    }
    return completed;
  }

  /** Compute overall completion percentage. */
  computeCompletionPercent(data: IntakeData): number {
    const stepsWithFields = INTAKE_STEPS.filter(s => s.requiredFields.length > 0);
    if (stepsWithFields.length === 0) return 0;
    const completed = this.computeCompletedSteps(data);
    return Math.round((completed.length / stepsWithFields.length) * 100);
  }

  /** Determine the current step (first incomplete step). */
  computeCurrentStep(data: IntakeData): IntakeStepKey | null {
    const completed = new Set(this.computeCompletedSteps(data));
    for (const step of INTAKE_STEPS) {
      if (step.requiredFields.length > 0 && !completed.has(step.key)) {
        return step.key;
      }
    }
    return 'review_summary';
  }

  /** List missing items for adjuster review. */
  computeMissingItems(data: IntakeData, session: IntakeSession): string[] {
    const missing: string[] = [];
    if (!data.claimantName) missing.push('Claimant name');
    if (!data.bestCallbackNumber) missing.push('Callback number');
    if (!data.propertyAddress) missing.push('Property address');
    if (!data.damageType && !data.eventType) missing.push('Damage/event type');
    if (!data.insuranceCarrier) missing.push('Insurance carrier');
    if (!session.hasPolicy) missing.push('Policy document');
    if (!session.hasPhotos) missing.push('Damage photos');
    return missing;
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Status Transitions
  // ═══════════════════════════════════════════════════════════════

  /** Determine the appropriate session status based on data completeness. */
  inferStatus(data: IntakeData, session: IntakeSession): IntakeSessionStatus {
    const pct = this.computeCompletionPercent(data);

    if (pct === 0) return 'started';
    if (pct < 100) return 'in_progress';

    // Data is complete — check document readiness
    if (!session.hasPolicy && !session.hasSupportingDocs) return 'awaiting_documents';
    if (!session.hasPhotos) return 'awaiting_photos';

    return 'ready_for_review';
  }

  /** Check if a session is ready for conversion to a claim. */
  isReadyForConversion(session: IntakeSession): boolean {
    return session.status === 'ready_for_review'
      && session.completionPercent >= 80
      && !!session.intakeData.claimantName
      && !!session.intakeData.propertyAddress;
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Lead / Claim Conversion Payloads
  // ═══════════════════════════════════════════════════════════════

  /** Produce a Lead-update payload from intake data (for enriching existing leads). */
  buildLeadEnrichmentPayload(data: IntakeData): Record<string, any> {
    return intakeToLeadPayload(data);
  }

  /** Produce a Claim-creation payload from intake data. */
  buildClaimCreationPayload(data: IntakeData, clientId?: string): Record<string, any> {
    return intakeToClaimPayload(data, clientId);
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Task Payloads
  // ═══════════════════════════════════════════════════════════════

  /** Produce a review task payload when intake is ready. */
  buildReviewTaskPayload(session: IntakeSession): Record<string, any> {
    return intakeToTaskPayload(session, 'review');
  }

  /** Produce a document-request task payload. */
  buildDocumentTaskPayload(session: IntakeSession): Record<string, any> {
    return intakeToTaskPayload(session, 'documents');
  }

  /** Produce a photo-request task payload. */
  buildPhotoTaskPayload(session: IntakeSession): Record<string, any> {
    return intakeToTaskPayload(session, 'photos');
  }

  /** Produce a follow-up task for abandoned/incomplete intakes. */
  buildFollowUpTaskPayload(session: IntakeSession): Record<string, any> {
    return intakeToTaskPayload(session, 'followup');
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Communication Timeline Entries
  // ═══════════════════════════════════════════════════════════════

  /** Produce a communication entry for an intake event. */
  buildCommunicationEntry(
    session: IntakeSession,
    event: 'started' | 'resumed' | 'completed' | 'summary_generated' | 'converted',
  ): Record<string, any> {
    return intakeToCommunicationEntry(session, event);
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. Portal Nudge
  // ═══════════════════════════════════════════════════════════════

  /** Produce a client portal nudge based on session state. */
  buildPortalNudge(session: IntakeSession) {
    return intakeToPortalNudge(session);
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. AI Summary Generation
  // ═══════════════════════════════════════════════════════════════

  /** Request AI summary generation for the intake session.
   *  The backend uses Claude to produce a structured summary. */
  generateSummary(sessionId: string): Observable<{ summary: string }> {
    return this.http.post<{ summary: string }>(
      `${this.basePath}/${sessionId}/generate-summary`, {}
    ).pipe(
      catchError(() => of({ summary: this.buildLocalSummary(sessionId) }))
    );
  }

  /** Build a local summary from intake data (fallback if AI unavailable). */
  buildSummaryFromData(data: IntakeData, session: IntakeSession): string {
    const lines: string[] = [];

    lines.push('CLAIM INTAKE SUMMARY');
    lines.push('═'.repeat(40));

    if (data.claimantName) lines.push(`Claimant: ${data.claimantName}`);
    if (data.bestCallbackNumber) lines.push(`Phone: ${data.bestCallbackNumber}`);
    if (data.email) lines.push(`Email: ${data.email}`);

    lines.push('');
    if (data.propertyAddress) {
      lines.push(`Property: ${data.propertyAddress}`);
      const cityStateZip = [data.propertyCity, data.propertyState, data.propertyZip].filter(Boolean).join(', ');
      if (cityStateZip) lines.push(`          ${cityStateZip}`);
    }

    lines.push('');
    if (data.damageType) lines.push(`Damage Type: ${data.damageType}`);
    if (data.eventType) lines.push(`Event Type: ${data.eventType}`);
    if (data.lossDate) lines.push(`Loss Date: ${data.lossDate}${data.lossDateApproximate ? ' (approximate)' : ''}`);
    if (data.occupancyStatus) lines.push(`Occupancy: ${data.occupancyStatus}`);
    if (data.isHabitable !== null) lines.push(`Habitable: ${data.isHabitable ? 'Yes' : 'No'}`);

    lines.push('');
    if (data.insuranceCarrier) lines.push(`Carrier: ${data.insuranceCarrier}`);
    if (data.policyNumber) lines.push(`Policy #: ${data.policyNumber}`);
    if (data.claimNumber) lines.push(`Claim #: ${data.claimNumber}`);
    if (data.hasReportedClaim !== null) lines.push(`Claim Reported: ${data.hasReportedClaim ? 'Yes' : 'No'}`);

    if (data.damageDescription) {
      lines.push('');
      lines.push(`Damage Description: ${data.damageDescription}`);
    }

    if (data.inspectionRequested !== null) {
      lines.push('');
      lines.push(`Inspection Requested: ${data.inspectionRequested ? 'Yes' : 'No'}`);
    }

    const missing = this.computeMissingItems(data, session);
    if (missing.length > 0) {
      lines.push('');
      lines.push('MISSING ITEMS:');
      missing.forEach(m => lines.push(`  - ${m}`));
    }

    lines.push('');
    lines.push(`Completion: ${session.completionPercent}%`);
    lines.push(`Status: ${session.status}`);
    lines.push(`Entry Path: ${ENTRY_PATH_LABELS[session.entryPath] || session.entryPath}`);

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. Claude-Ready Prompt Structure
  // ═══════════════════════════════════════════════════════════════

  /** Get the Claude system instruction for summary generation tone. */
  getSummaryToneInstruction(): string {
    return (
      'You are reviewing a structured claim intake form completed by a homeowner or prospect. ' +
      'Produce a clean, professional intake summary suitable for adjuster review. ' +
      'Include: claimant information, property details, loss/event details, insurance information, ' +
      'damage description, and document readiness. ' +
      'Flag any missing or inconsistent information. ' +
      'Recommend the next action (schedule inspection, request documents, convert to claim, etc.). ' +
      'Use plain text, no markdown. Be concise and factual.'
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 10. Voice → Intake Conversion
  // ═══════════════════════════════════════════════════════════════

  /** Populate intake data from voice qualification data.
   *  Maps VoiceOutreach QualificationData fields into IntakeData. */
  populateFromVoiceQualification(
    intakeData: IntakeData,
    voiceData: Record<string, any>,
  ): IntakeData {
    return {
      ...intakeData,
      damageType: voiceData.damage_type || voiceData.damageType || intakeData.damageType,
      eventType: voiceData.event_type || voiceData.eventType || intakeData.eventType,
      lossDate: voiceData.loss_date || voiceData.lossDate || intakeData.lossDate,
      propertyAddress: voiceData.property_address || voiceData.propertyAddress || intakeData.propertyAddress,
      hasReportedClaim: voiceData.has_insurance_claim ?? voiceData.hasInsuranceClaim ?? intakeData.hasReportedClaim,
      inspectionRequested: voiceData.wants_inspection ?? voiceData.wantsInspection ?? intakeData.inspectionRequested,
      bestCallbackNumber: voiceData.callback_number || voiceData.callbackNumber || intakeData.bestCallbackNumber,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════

  /** Build a local session object (fallback when backend is unavailable). */
  private buildLocalSession(
    entryPath: IntakeEntryPath,
    linkedIds?: { leadId?: string; claimId?: string; clientId?: string; voiceCallId?: string },
  ): IntakeSession {
    const now = new Date().toISOString();
    return {
      id: `local-${Date.now()}`,
      status: 'started',
      entryPath,
      intakeData: createEmptyIntakeData(),
      leadId: linkedIds?.leadId || null,
      claimId: linkedIds?.claimId || null,
      clientId: linkedIds?.clientId || null,
      voiceCallId: linkedIds?.voiceCallId || null,
      completedSteps: [],
      currentStep: 'contact_info',
      completionPercent: 0,
      aiSummary: null,
      aiSummaryGeneratedAt: null,
      hasPolicy: false,
      hasPhotos: false,
      hasSupportingDocs: false,
      missingItems: [],
      createdAt: now,
      updatedAt: now,
      createdBy: null,
      convertedAt: null,
    };
  }

  private buildLocalSummary(sessionId: string): string {
    return `Intake summary generation unavailable. Session: ${sessionId}`;
  }
}
