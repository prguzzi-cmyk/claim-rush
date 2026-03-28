import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, of, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { RotationLead } from 'src/app/models/rotation-lead.model';
import {
  OutreachCampaign,
  OutreachCampaignStep,
  ConversationOutcome,
  AgentNotificationType,
} from '../models/outreach-campaign.model';
import {
  OutreachExecutionJob,
  ExecutionJobStatus,
  ExecutionAttempt,
  AttemptResult,
  StopReason,
  ExecutionQueueStats,
  ExecuteStepRequest,
  ExecuteStepResponse,
  AUTO_STOP_OUTCOMES,
  NOTIFY_AGENT_OUTCOMES,
  STOP_REASON_LABELS,
} from '../models/outreach-execution.model';
import { OutreachCampaignEngineService } from './outreach-campaign-engine.service';

/**
 * OutreachExecutionEngine
 *
 * Processes outreach campaign jobs: schedules steps, executes via backend,
 * tracks attempts, evaluates stop conditions, and triggers agent notifications.
 *
 * Architecture:
 * - Frontend manages job state and scheduling decisions
 * - Backend executes actual message delivery (voice/SMS/email)
 * - Polling-based execution loop checks for ready jobs on interval
 *
 * Integrates with (does NOT duplicate):
 * - OutreachCampaignEngine (campaign definition, template resolution, metrics)
 * - VoiceOutreachEngine (voice call execution — delegated for voice steps)
 * - CommunicationLog (delivery tracking — backend handles)
 */
@Injectable({ providedIn: 'root' })
export class OutreachExecutionEngineService implements OnDestroy {

  private basePath = 'outreach-execution';
  private pollSub: Subscription | null = null;

  /** Observable queue stats for dashboard display. */
  private statsSubject = new BehaviorSubject<ExecutionQueueStats>(this.emptyStats());
  stats$ = this.statsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private campaignEngine: OutreachCampaignEngineService,
  ) {}

  ngOnDestroy(): void {
    this.stopPolling();
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. Job Management
  // ═══════════════════════════════════════════════════════════════

  /** Create an execution job for a lead in a campaign. */
  createJob(
    campaign: OutreachCampaign,
    lead: RotationLead,
    agentId?: string,
  ): Observable<OutreachExecutionJob> {
    const job: Partial<OutreachExecutionJob> = {
      campaignId: campaign.id,
      leadId: lead.id,
      leadName: lead.owner_name || 'Unknown',
      leadPhone: lead.phone || null,
      leadEmail: lead.email || null,
      assignedAgentId: agentId || lead.assigned_agent_id || null,
      status: 'queued',
      currentStepNumber: 1,
      totalSteps: campaign.steps.length,
      attempts: [],
      stopReason: null,
      nextExecutionAt: this.computeNextExecutionTime(campaign.steps[0], null),
    };

    return this.http.post<OutreachExecutionJob>(
      `${this.basePath}/jobs`, job
    ).pipe(
      catchError(() => of(this.buildLocalJob(job)))
    );
  }

  /** Get all jobs for a campaign. */
  getJobsByCampaign(campaignId: string): Observable<OutreachExecutionJob[]> {
    return this.http.get<OutreachExecutionJob[]>(
      `${this.basePath}/jobs`, { params: { campaign_id: campaignId } }
    ).pipe(catchError(() => of([])));
  }

  /** Get all jobs for a lead. */
  getJobsByLead(leadId: string): Observable<OutreachExecutionJob[]> {
    return this.http.get<OutreachExecutionJob[]>(
      `${this.basePath}/jobs`, { params: { lead_id: leadId } }
    ).pipe(catchError(() => of([])));
  }

  /** Get jobs ready for execution. */
  getReadyJobs(): Observable<OutreachExecutionJob[]> {
    return this.http.get<OutreachExecutionJob[]>(
      `${this.basePath}/jobs/ready`
    ).pipe(catchError(() => of([])));
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Step Execution
  // ═══════════════════════════════════════════════════════════════

  /**
   * Execute the current step of a job.
   * Sends the execution request to the backend which handles
   * actual message delivery via the configured provider.
   */
  executeStep(
    job: OutreachExecutionJob,
    step: OutreachCampaignStep,
    resolvedContent: { subject: string | null; body: string; callScript: string | null },
  ): Observable<ExecuteStepResponse> {
    const request: ExecuteStepRequest = {
      jobId: job.id,
      campaignId: job.campaignId,
      leadId: job.leadId,
      stepNumber: step.stepNumber,
      channel: step.channel,
      templateId: step.templateId,
      resolvedSubject: resolvedContent.subject,
      resolvedBody: resolvedContent.body,
      resolvedCallScript: resolvedContent.callScript,
      recipientPhone: job.leadPhone,
      recipientEmail: job.leadEmail,
    };

    return this.http.post<ExecuteStepResponse>(
      `${this.basePath}/execute`, request
    ).pipe(
      catchError(err => of({
        success: false,
        attemptResult: 'failed' as AttemptResult,
        providerMessageId: null,
        error: err?.error?.detail || 'Execution failed',
      }))
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Attempt Tracking
  // ═══════════════════════════════════════════════════════════════

  /**
   * Record an attempt result and advance the job state.
   * Returns the updated job and whether a stop condition was triggered.
   */
  recordAttempt(
    job: OutreachExecutionJob,
    step: OutreachCampaignStep,
    result: AttemptResult,
    outcome: ConversationOutcome | null,
    providerMessageId: string | null,
    error: string | null,
  ): { updatedJob: OutreachExecutionJob; stopped: boolean; stopReason: StopReason | null; notifyAgent: boolean } {
    const attempt: ExecutionAttempt = {
      attemptNumber: job.attempts.length + 1,
      stepNumber: step.stepNumber,
      channel: step.channel,
      templateId: step.templateId,
      result,
      outcome,
      executedAt: new Date().toISOString(),
      providerMessageId,
      errorMessage: error,
    };

    const updatedJob = { ...job };
    updatedJob.attempts = [...job.attempts, attempt];
    updatedJob.updatedAt = new Date().toISOString();

    // Check stop conditions
    const stopCheck = this.evaluateStopConditions(updatedJob, outcome);
    if (stopCheck.stopped) {
      updatedJob.status = 'stopped';
      updatedJob.stopReason = stopCheck.reason;
      updatedJob.nextExecutionAt = null;
    } else if (result === 'failed') {
      // Failed but not stopped — retry same step or move on
      updatedJob.status = 'failed';
      updatedJob.nextExecutionAt = null;
    } else {
      // Advance to next step
      const nextStepNum = step.stepNumber + 1;
      if (nextStepNum > updatedJob.totalSteps) {
        updatedJob.status = 'completed';
        updatedJob.nextExecutionAt = null;
      } else {
        updatedJob.currentStepNumber = nextStepNum;
        updatedJob.status = 'waiting_delay';
        // Find the next step to compute delay
        updatedJob.nextExecutionAt = this.computeNextExecutionTime(
          { ...step, stepNumber: nextStepNum, delayMinutes: this.getStepDelay(nextStepNum, updatedJob.totalSteps) },
          attempt.executedAt,
        );
      }
    }

    // Check if agent should be notified
    const notifyAgent = outcome !== null && NOTIFY_AGENT_OUTCOMES.has(outcome);

    return { updatedJob, stopped: stopCheck.stopped, stopReason: stopCheck.reason, notifyAgent };
  }

  /** Save job state to backend. */
  saveJob(job: OutreachExecutionJob): Observable<OutreachExecutionJob> {
    return this.http.put<OutreachExecutionJob>(
      `${this.basePath}/jobs/${job.id}`, job
    ).pipe(catchError(() => of(job)));
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Stop Condition Evaluation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Evaluate whether a job should be stopped.
   */
  evaluateStopConditions(
    job: OutreachExecutionJob,
    latestOutcome: ConversationOutcome | null,
  ): { stopped: boolean; reason: StopReason | null } {
    // Auto-stop on response outcomes
    if (latestOutcome && AUTO_STOP_OUTCOMES.has(latestOutcome)) {
      if (latestOutcome === 'appointment_booked') {
        return { stopped: true, reason: 'appointment_booked' };
      }
      if (latestOutcome === 'not_interested' || latestOutcome === 'do_not_contact') {
        return { stopped: true, reason: latestOutcome === 'do_not_contact' ? 'do_not_contact' : 'lead_closed' };
      }
      return { stopped: true, reason: 'homeowner_responded' };
    }

    // Max attempts (default 10)
    if (job.attempts.length >= 10) {
      return { stopped: true, reason: 'max_attempts_reached' };
    }

    return { stopped: false, reason: null };
  }

  /** Manually stop a job. */
  stopJob(job: OutreachExecutionJob, reason: StopReason = 'manual_stop'): OutreachExecutionJob {
    return {
      ...job,
      status: 'stopped',
      stopReason: reason,
      nextExecutionAt: null,
      updatedAt: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Scheduling & Readiness
  // ═══════════════════════════════════════════════════════════════

  /** Check if a job is ready to execute its next step. */
  isJobReady(job: OutreachExecutionJob): boolean {
    if (job.status === 'stopped' || job.status === 'completed' || job.status === 'failed') {
      return false;
    }
    if (!job.nextExecutionAt) return job.status === 'queued';
    return new Date(job.nextExecutionAt).getTime() <= Date.now();
  }

  /** Compute when the next step should execute. */
  computeNextExecutionTime(
    step: OutreachCampaignStep | null,
    lastAttemptAt: string | null,
  ): string {
    if (!step) return new Date().toISOString();
    const base = lastAttemptAt ? new Date(lastAttemptAt) : new Date();
    const next = new Date(base.getTime() + (step.delayMinutes || 0) * 60 * 1000);
    return next.toISOString();
  }

  private getStepDelay(stepNumber: number, totalSteps: number): number {
    // Default delays: step 1 = 0, step 2 = 120min, step 3 = 1440min, step 4 = 2880min
    const defaults = [0, 120, 1440, 2880, 4320];
    return defaults[stepNumber - 1] || 1440;
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Polling Execution Loop
  // ═══════════════════════════════════════════════════════════════

  /**
   * Start polling for ready jobs on an interval.
   * This is the main execution loop — checks for ready jobs
   * and calls the backend to process them.
   */
  startPolling(intervalMs: number = 30000): void {
    this.stopPolling();
    this.pollSub = timer(0, intervalMs).pipe(
      switchMap(() => this.processReadyJobs())
    ).subscribe();
  }

  stopPolling(): void {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = null;
    }
  }

  /** Process all jobs that are ready for execution. */
  private processReadyJobs(): Observable<void> {
    return this.http.post<void>(
      `${this.basePath}/process-ready`, {}
    ).pipe(
      catchError(() => of(undefined)),
      switchMap(() => this.refreshStats()),
    );
  }

  /** Refresh queue stats from backend. */
  refreshStats(): Observable<void> {
    return this.http.get<ExecutionQueueStats>(
      `${this.basePath}/stats`
    ).pipe(
      catchError(() => of(this.emptyStats()))
    ).pipe(
      switchMap(stats => {
        this.statsSubject.next(stats);
        return of(undefined);
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. Conversation Log
  // ═══════════════════════════════════════════════════════════════

  /** Get the full conversation history for a lead across all campaigns. */
  getConversationLog(leadId: string): Observable<ExecutionAttempt[]> {
    return this.http.get<ExecutionAttempt[]>(
      `${this.basePath}/conversations/${leadId}`
    ).pipe(catchError(() => of([])));
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. Agent Notification Helpers
  // ═══════════════════════════════════════════════════════════════

  /**
   * Determine the notification type from a conversation outcome.
   */
  getNotificationType(outcome: ConversationOutcome): AgentNotificationType | null {
    const map: Partial<Record<ConversationOutcome, AgentNotificationType>> = {
      sms_replied: 'sms_reply_received',
      email_replied: 'email_reply_received',
      call_connected: 'call_connected',
      appointment_booked: 'appointment_requested',
    };
    return map[outcome] || (NOTIFY_AGENT_OUTCOMES.has(outcome) ? 'homeowner_responded' : null);
  }

  /**
   * Send agent notification for an outcome.
   * Delegates to the backend notification system.
   */
  notifyAgent(
    agentId: string,
    leadId: string,
    campaignId: string,
    notificationType: AgentNotificationType,
    leadName: string,
  ): Observable<any> {
    const payload = this.campaignEngine.buildAgentNotification(
      notificationType, agentId, leadId, campaignId, leadName
    );
    return this.http.post(`${this.basePath}/notify-agent`, payload).pipe(
      catchError(() => of(null))
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════

  private emptyStats(): ExecutionQueueStats {
    return {
      totalJobs: 0, queued: 0, waitingDelay: 0, ready: 0,
      executing: 0, completed: 0, stopped: 0, failed: 0,
    };
  }

  private buildLocalJob(partial: Partial<OutreachExecutionJob>): OutreachExecutionJob {
    const now = new Date().toISOString();
    return {
      id: `local-${Date.now()}`,
      campaignId: partial.campaignId || '',
      leadId: partial.leadId || '',
      leadName: partial.leadName || '',
      leadPhone: partial.leadPhone || null,
      leadEmail: partial.leadEmail || null,
      assignedAgentId: partial.assignedAgentId || null,
      status: 'queued',
      currentStepNumber: 1,
      totalSteps: partial.totalSteps || 0,
      attempts: [],
      stopReason: null,
      createdAt: now,
      updatedAt: now,
      nextExecutionAt: partial.nextExecutionAt || now,
    };
  }
}
