import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { Claim } from 'src/app/models/claim.model';
import { ClaimService } from 'src/app/services/claim.service';
import { ClaimStatusEngineService } from './claim-status-engine.service';
import {
  ClaimEngagementSnapshot,
  EngagementStatus,
  FollowUpSequence,
  FollowUpStep,
  ScheduledEngagementAction,
  EscalationRule,
  DEFAULT_ESCALATION_RULE,
  StatusUpdateEvent,
  STATUS_UPDATE_LABELS,
  ClientPortalNudge,
  NudgeType,
  MessageTone,
  MESSAGE_TONE_INSTRUCTIONS,
} from '../models/claim-engagement.model';
import {
  ENGAGEMENT_SEQUENCES,
  ESCALATION_RULES,
  ENGAGEMENT_TEMPLATES,
  getEngagementTemplate,
  getSequenceById,
  EngagementMessageTemplate,
} from 'src/app/constants/engagement-sequence.config';

/**
 * ClaimEngagementEngine
 *
 * Central service for anti-ghosting automation and claim engagement tracking.
 * Computes engagement state from claim data, determines follow-up actions,
 * resolves message templates, and manages escalation rules.
 *
 * Integrates with:
 * - ClaimStatusEngine (claim phase / next step inference)
 * - ClaimService (timeline, tasks, communications data)
 * - Communications Hub (message delivery via existing channels)
 * - Task Engine (escalation task creation via existing ClaimTask model)
 * - Client Portal (nudge generation)
 *
 * Does NOT duplicate:
 * - Financial calculations (use ClaimFinancialEngine)
 * - Phase normalization (delegates to ClaimStatusEngine)
 * - Message sending (produces payloads for existing communication services)
 */
@Injectable({ providedIn: 'root' })
export class ClaimEngagementEngineService {

  constructor(
    private claimService: ClaimService,
    private statusEngine: ClaimStatusEngineService,
  ) {}

  // ── Engagement Snapshot ──────────────────────────────────────

  /**
   * Compute the full engagement snapshot for a claim.
   * Analyzes timeline events and communications to determine
   * how engaged the client is and what follow-up is needed.
   */
  getEngagementSnapshot(claim: Claim): Observable<ClaimEngagementSnapshot> {
    const timeline$ = this.claimService
      .getClaimTimeline(claim.id)
      .pipe(catchError(() => of([] as any[])));

    const comms$ = this.claimService
      .getClaimCommunications(claim.id, 'client')
      .pipe(catchError(() => of([] as any[])));

    const tasks$ = this.claimService
      .getClaimTasks(claim.id, 1, 50)
      .pipe(
        map((res: any) => res?.items || res || []),
        catchError(() => of([] as any[])),
      );

    return forkJoin([timeline$, comms$, tasks$]).pipe(
      map(([timeline, comms, tasks]) => {
        return this.computeSnapshot(claim, timeline || [], comms || [], tasks || []);
      })
    );
  }

  private computeSnapshot(
    claim: Claim,
    timeline: any[],
    communications: any[],
    tasks: any[],
  ): ClaimEngagementSnapshot {
    const now = new Date();

    // Find last client action from timeline
    const clientActionTypes = new Set([
      'document-uploaded', 'comment-added',
    ]);
    const lastClientEvent = timeline.find(e => clientActionTypes.has(e.activity_type));
    const lastClientActionDate = lastClientEvent?.timestamp || null;
    const daysSinceLastClientAction = lastClientActionDate
      ? this.daysBetween(new Date(lastClientActionDate), now)
      : null;

    // Find last outreach from communications
    const outboundComms = communications.filter((c: any) => c.direction === 'outbound');
    const lastOutreach = outboundComms.length > 0 ? outboundComms[0] : null;
    const lastOutreachDate = lastOutreach?.created_at || null;
    const daysSinceLastOutreach = lastOutreachDate
      ? this.daysBetween(new Date(lastOutreachDate), now)
      : null;

    // Count system-generated reminders
    const remindersSent = communications.filter(
      (c: any) => c.is_system_generated && c.direction === 'outbound'
    ).length;

    // Determine waiting-on-client tasks
    const waitingTasks = tasks.filter(
      (t: any) => t.status === 'waiting-on-client'
    );

    // Compute engagement status
    const status = this.inferEngagementStatus(
      daysSinceLastClientAction,
      daysSinceLastOutreach,
      remindersSent,
      waitingTasks.length,
    );

    // Determine best sequence
    const sequenceId = this.selectSequence(waitingTasks, daysSinceLastClientAction);
    const sequence = sequenceId ? getSequenceById(sequenceId) : null;

    // Compute current step and next action
    const currentStep = Math.min(remindersSent + 1, sequence?.steps.length || 1);
    const nextAction = this.computeNextAction(
      sequence, currentStep, remindersSent, lastOutreachDate
    );

    // Stalled reason
    const stalledReason = status === 'stalled'
      ? this.inferStalledReason(daysSinceLastClientAction, waitingTasks)
      : null;

    return {
      claimId: claim.id,
      status,
      daysSinceLastClientAction,
      daysSinceLastOutreach,
      remindersSent,
      currentSequenceStep: currentStep,
      sequenceId: sequenceId,
      lastClientActionDate,
      lastOutreachDate,
      nextScheduledAction: nextAction,
      stalledReason,
    };
  }

  // ── Status Inference ─────────────────────────────────────────

  private inferEngagementStatus(
    daysSinceClient: number | null,
    daysSinceOutreach: number | null,
    remindersSent: number,
    waitingTaskCount: number,
  ): EngagementStatus {
    // Recent client activity = responsive/active
    if (daysSinceClient !== null && daysSinceClient <= 3) {
      return 'responsive';
    }
    if (daysSinceClient !== null && daysSinceClient <= 7 && waitingTaskCount === 0) {
      return 'active';
    }

    // No client activity but reminders sent
    if (remindersSent >= DEFAULT_ESCALATION_RULE.maxAutomatedAttempts) {
      return daysSinceClient !== null && daysSinceClient > 21
        ? 'stalled'
        : 'escalation_pending';
    }

    if (remindersSent > 0) {
      return 'reminder_sent';
    }

    // Waiting on client with no reminders yet
    if (waitingTaskCount > 0 || (daysSinceClient !== null && daysSinceClient > 7)) {
      return 'waiting_on_client';
    }

    return 'active';
  }

  // ── Sequence Selection ───────────────────────────────────────

  private selectSequence(
    waitingTasks: any[],
    daysSinceClient: number | null,
  ): string | null {
    // Match based on waiting task types
    for (const task of waitingTasks) {
      const type = (task.task_type || '').toLowerCase();
      const title = (task.title || '').toLowerCase();

      if (type.includes('document') || title.includes('document') || title.includes('upload')) {
        return 'missing_documents';
      }
      if (type.includes('sign') || title.includes('sign') || title.includes('signature')) {
        return 'unsigned_forms';
      }
      if (type.includes('approv') || title.includes('approv')) {
        return 'pending_approval';
      }
      if (type.includes('question') || title.includes('question') || title.includes('answer')) {
        return 'unanswered_questions';
      }
      if (type.includes('intake') || title.includes('intake')) {
        return 'stalled_intake';
      }
    }

    // Fallback: general re-engagement if inactive
    if (daysSinceClient !== null && daysSinceClient > 7) {
      return 'general_reengagement';
    }

    return null;
  }

  // ── Next Action Computation ──────────────────────────────────

  private computeNextAction(
    sequence: FollowUpSequence | undefined | null,
    currentStep: number,
    remindersSent: number,
    lastOutreachDate: string | null,
  ): ScheduledEngagementAction | null {
    if (!sequence) return null;

    const stepIndex = currentStep - 1;
    if (stepIndex >= sequence.steps.length) return null;

    const step = sequence.steps[stepIndex];
    const baseDate = lastOutreachDate ? new Date(lastOutreachDate) : new Date();
    const scheduledDate = new Date(baseDate);
    scheduledDate.setDate(scheduledDate.getDate() + step.delayDays);

    return {
      actionType: step.escalateOnNoResponse ? 'escalation' : 'reminder',
      channel: step.channel,
      scheduledDate: scheduledDate.toISOString(),
      templateKey: step.templateKey,
      stepNumber: step.stepNumber,
      sequenceId: sequence.id,
    };
  }

  // ── Template Resolution ──────────────────────────────────────

  /**
   * Resolve a template by key and fill in placeholders with claim context.
   * Returns the resolved template ready for display or sending.
   */
  resolveTemplate(
    templateKey: string,
    context: Record<string, string>,
  ): EngagementMessageTemplate | null {
    const template = getEngagementTemplate(templateKey);
    if (!template) return null;

    const resolved = { ...template };
    resolved.body = this.fillPlaceholders(template.body, context);
    if (resolved.subject) {
      resolved.subject = this.fillPlaceholders(resolved.subject, context);
    }
    return resolved;
  }

  private fillPlaceholders(text: string, context: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
  }

  /**
   * Build the standard context object from a claim for template resolution.
   */
  buildTemplateContext(claim: Claim, adjusterName?: string): Record<string, string> {
    const clientName = claim.client?.full_name || 'there';
    const claimNumber = claim.claim_number || claim.ref_string || '';
    const adjuster = adjusterName
      || (claim.assigned_user
        ? `${claim.assigned_user.first_name || ''} ${claim.assigned_user.last_name || ''}`.trim()
        : 'Your Adjuster');

    return {
      client_name: clientName,
      claim_number: claimNumber,
      adjuster_name: adjuster,
    };
  }

  // ── Portal Nudge Generation ──────────────────────────────────

  /**
   * Generate client portal nudges based on the engagement snapshot.
   */
  generateNudges(
    snapshot: ClaimEngagementSnapshot,
    waitingTasks: any[],
  ): ClientPortalNudge[] {
    const nudges: ClientPortalNudge[] = [];
    const now = new Date().toISOString();

    // Document-required nudge
    for (const task of waitingTasks) {
      const title = (task.title || '').toLowerCase();
      if (title.includes('document') || title.includes('upload')) {
        nudges.push({
          id: `nudge-doc-${task.id}`,
          claimId: snapshot.claimId,
          nudgeType: 'document_required',
          title: 'Document Required',
          message: task.title || 'Please upload the required document to proceed.',
          actionUrl: null,
          priority: snapshot.daysSinceLastClientAction && snapshot.daysSinceLastClientAction > 7 ? 'high' : 'medium',
          isDismissed: false,
          seenAt: null,
          createdAt: now,
        });
      }
      if (title.includes('sign') || title.includes('signature')) {
        nudges.push({
          id: `nudge-sign-${task.id}`,
          claimId: snapshot.claimId,
          nudgeType: 'signature_required',
          title: 'Signature Required',
          message: task.title || 'Please sign the required documents.',
          actionUrl: null,
          priority: 'high',
          isDismissed: false,
          seenAt: null,
          createdAt: now,
        });
      }
    }

    // General action-needed nudge for stalled/escalation states
    if (snapshot.status === 'stalled' || snapshot.status === 'escalation_pending') {
      nudges.push({
        id: `nudge-action-${snapshot.claimId}`,
        claimId: snapshot.claimId,
        nudgeType: 'action_needed',
        title: 'Your Claim Needs Attention',
        message: snapshot.stalledReason || 'Please log in to review and continue your claim.',
        actionUrl: null,
        priority: 'high',
        isDismissed: false,
        seenAt: null,
        createdAt: now,
      });
    }

    return nudges;
  }

  // ── Escalation Check ─────────────────────────────────────────

  /**
   * Check if a snapshot has reached the escalation threshold.
   */
  shouldEscalate(
    snapshot: ClaimEngagementSnapshot,
    rule: EscalationRule = DEFAULT_ESCALATION_RULE,
  ): boolean {
    return snapshot.remindersSent >= rule.maxAutomatedAttempts;
  }

  /**
   * Get the escalation rule for a given urgency level.
   */
  getEscalationRule(level: 'default' | 'urgent' | 'relaxed' = 'default'): EscalationRule {
    return ESCALATION_RULES[level] || DEFAULT_ESCALATION_RULE;
  }

  // ── Proactive Status Updates ─────────────────────────────────

  /**
   * Get the human-readable label for a status update event.
   */
  getStatusUpdateMessage(event: StatusUpdateEvent): string {
    return STATUS_UPDATE_LABELS[event] || 'Your claim has an update.';
  }

  /**
   * Map a claim phase change to the appropriate status update event.
   */
  phaseToStatusEvent(phase: string): StatusUpdateEvent | null {
    const normalized = (phase || '').toLowerCase().replace(/[\s_-]+/g, '_');
    const mapping: Record<string, StatusUpdateEvent> = {
      'intake': 'claim_received',
      'claim_reported': 'claim_received',
      'signed': 'claim_received',
      'inspection': 'inspection_scheduled',
      'scope': 'inspection_scheduled',
      'estimate': 'estimate_in_progress',
      'estimate_complete': 'estimate_submitted',
      'carrier_review': 'estimate_submitted',
      'supplement': 'supplement_under_review',
      'negotiation': 'supplement_under_review',
      'payment': 'payment_received',
    };
    return mapping[normalized] || null;
  }

  // ── Claude-Ready Tone Instructions ───────────────────────────

  /**
   * Get the Claude system instruction for a given message tone.
   * Used when AI-refining a claudeRefinable template.
   */
  getToneInstruction(tone: MessageTone): string {
    return MESSAGE_TONE_INSTRUCTIONS[tone] || MESSAGE_TONE_INSTRUCTIONS.professional_reminder;
  }

  // ── Available Sequences ──────────────────────────────────────

  /** Get all available follow-up sequences. */
  getAvailableSequences(): FollowUpSequence[] {
    return ENGAGEMENT_SEQUENCES;
  }

  /** Get all available message templates. */
  getAvailableTemplates(): EngagementMessageTemplate[] {
    return ENGAGEMENT_TEMPLATES;
  }

  // ── Utility ──────────────────────────────────────────────────

  private daysBetween(a: Date, b: Date): number {
    const diffMs = Math.abs(b.getTime() - a.getTime());
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  private inferStalledReason(
    daysSinceClient: number | null,
    waitingTasks: any[],
  ): string {
    if (waitingTasks.length > 0) {
      const taskTitles = waitingTasks.slice(0, 3).map((t: any) => t.title).join(', ');
      return `Waiting on client for: ${taskTitles}. No response for ${daysSinceClient || '?'} days.`;
    }
    return `No client activity for ${daysSinceClient || '?'} days.`;
  }
}
