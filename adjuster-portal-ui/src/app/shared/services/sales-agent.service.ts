import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, catchError } from 'rxjs';
import {
  SalesAgentSession,
  SessionStep,
  SessionExchange,
  SessionLeadData,
  SessionStatus,
  SessionOutcome,
  SESSION_SCRIPTS,
  StepScript,
} from '../models/sales-agent-session.model';

/**
 * AI Sales / Intake Agent Service
 *
 * Manages structured 6-step intake and conversion sessions.
 * Educates, qualifies, and guides the user toward taking action
 * without making improper claims or guarantees.
 *
 * Future: connect to Zoom/Teams API, voice-enabled sessions,
 * screen sharing, document review.
 */
@Injectable({ providedIn: 'root' })
export class SalesAgentService {

  private session$ = new BehaviorSubject<SalesAgentSession | null>(null);

  constructor(private http: HttpClient) {}

  getSession(): Observable<SalesAgentSession | null> {
    return this.session$.asObservable();
  }

  get currentSession(): SalesAgentSession | null {
    return this.session$.value;
  }

  // ══════════════════════════════════════════════════════════════
  // 1. Start Session
  // ══════════════════════════════════════════════════════════════

  startSession(leadData: SessionLeadData): SalesAgentSession {
    const session: SalesAgentSession = {
      id: 'sess-' + Date.now(),
      leadId: leadData.leadId,
      leadData,
      currentStep: 'introduction',
      status: 'active',
      outcome: null,
      exchanges: [],
      qualificationResult: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      dropOffStep: null,
    };

    // Deliver opening script
    const introScript = this.getScriptForStep('introduction');
    for (const msg of introScript.agentMessages) {
      session.exchanges.push(this.createExchange('introduction', 'agent', msg));
    }
    for (const q of introScript.promptQuestions) {
      session.exchanges.push(this.createExchange('introduction', 'agent', q));
    }

    this.session$.next(session);
    this.persistSession(session);
    return session;
  }

  // ══════════════════════════════════════════════════════════════
  // 2. Generate Script
  // ══════════════════════════════════════════════════════════════

  generateScript(leadData: SessionLeadData): StepScript[] {
    return SESSION_SCRIPTS.map(script => {
      // Personalize scripts with lead data
      const personalized = { ...script };
      personalized.agentMessages = script.agentMessages.map(msg =>
        msg.replace(/{name}/g, leadData.name.split(' ')[0])
           .replace(/{address}/g, leadData.address)
           .replace(/{incident}/g, leadData.incidentType)
      );
      return personalized;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // 3. Handle Response
  // ══════════════════════════════════════════════════════════════

  handleResponse(input: string): SessionExchange[] {
    const session = this.session$.value;
    if (!session || session.status !== 'active') return [];

    // Record client response
    const clientExchange = this.createExchange(session.currentStep, 'client', input);
    session.exchanges.push(clientExchange);

    // Generate agent response based on current step
    const agentResponses = this.generateAgentResponse(session, input);
    for (const resp of agentResponses) {
      session.exchanges.push(resp);
    }

    this.session$.next({ ...session });
    this.persistSession(session);
    return agentResponses;
  }

  // ══════════════════════════════════════════════════════════════
  // 4. Advance Step
  // ══════════════════════════════════════════════════════════════

  advanceStep(): SessionExchange[] {
    const session = this.session$.value;
    if (!session || session.status !== 'active') return [];

    const steps: SessionStep[] = ['introduction', 'situation', 'education', 'qualification', 'recommendation', 'action'];
    const currentIdx = steps.indexOf(session.currentStep);
    if (currentIdx >= steps.length - 1) return [];

    const nextStep = steps[currentIdx + 1];
    session.currentStep = nextStep;

    // Deliver script for next step
    const newExchanges: SessionExchange[] = [];

    if (nextStep === 'qualification') {
      // Run qualification
      const qualResult = this.runQualification(session);
      session.qualificationResult = qualResult;

      const qualScript = this.getScriptForStep('qualification');
      for (const msg of qualScript.agentMessages) {
        const ex = this.createExchange('qualification', 'agent', msg);
        session.exchanges.push(ex);
        newExchanges.push(ex);
      }

      // Qualification result message
      const resultMsg = this.createExchange('qualification', 'agent', qualResult.message);
      session.exchanges.push(resultMsg);
      newExchanges.push(resultMsg);

    } else if (nextStep === 'recommendation') {
      // Generate recommendation based on qualification
      const recMessages = this.generateRecommendation(session);
      for (const msg of recMessages) {
        const ex = this.createExchange('recommendation', 'agent', msg);
        session.exchanges.push(ex);
        newExchanges.push(ex);
      }

    } else {
      // Standard step script
      const script = this.getScriptForStep(nextStep);
      for (const msg of script.agentMessages) {
        const ex = this.createExchange(nextStep, 'agent', msg);
        session.exchanges.push(ex);
        newExchanges.push(ex);
      }
      for (const q of script.promptQuestions) {
        const ex = this.createExchange(nextStep, 'agent', q);
        session.exchanges.push(ex);
        newExchanges.push(ex);
      }
    }

    this.session$.next({ ...session });
    this.persistSession(session);
    return newExchanges;
  }

  // ══════════════════════════════════════════════════════════════
  // 5. Complete / Drop Session
  // ══════════════════════════════════════════════════════════════

  completeSession(outcome: SessionOutcome): void {
    const session = this.session$.value;
    if (!session) return;

    session.status = 'completed';
    session.outcome = outcome;
    session.completedAt = new Date().toISOString();
    this.session$.next({ ...session });
    this.persistSession(session);
  }

  dropSession(): void {
    const session = this.session$.value;
    if (!session) return;

    session.status = 'dropped';
    session.outcome = 'dropped_off';
    session.dropOffStep = session.currentStep;
    session.completedAt = new Date().toISOString();
    this.session$.next({ ...session });
    this.persistSession(session);
  }

  // ══════════════════════════════════════════════════════════════
  // Internal: Script & Response Generation
  // ══════════════════════════════════════════════════════════════

  private getScriptForStep(step: SessionStep): StepScript {
    return SESSION_SCRIPTS.find(s => s.step === step) || {
      step,
      agentMessages: [],
      promptQuestions: [],
    };
  }

  private generateAgentResponse(session: SalesAgentSession, input: string): SessionExchange[] {
    const responses: SessionExchange[] = [];
    const step = session.currentStep;

    // Acknowledgment
    const acks = [
      "Thank you for sharing that.",
      "I appreciate you explaining that.",
      "That's helpful context.",
      "Understood — thank you.",
    ];
    const ack = acks[Math.floor(Math.random() * acks.length)];
    responses.push(this.createExchange(step, 'agent', ack));

    // Step-specific follow-ups
    if (step === 'situation') {
      const lowerInput = input.toLowerCase();
      if (lowerInput.includes('filed') || lowerInput.includes('yes')) {
        responses.push(this.createExchange(step, 'agent',
          "Good — having an existing claim gives us a baseline to work from."));
      } else if (lowerInput.includes('no') || lowerInput.includes("haven't") || lowerInput.includes('not sure')) {
        responses.push(this.createExchange(step, 'agent',
          "That's completely fine. We can help guide you through that process."));
      }
    }

    return responses;
  }

  private runQualification(session: SalesAgentSession): {
    qualified: boolean;
    severity: string | null;
    message: string;
  } {
    const lead = session.leadData;
    const hasPhotos = lead.photoCount > 0;
    const severityOk = lead.estimatedSeverity !== 'low';
    const qualified = hasPhotos && severityOk;

    if (qualified) {
      return {
        qualified: true,
        severity: lead.estimatedSeverity,
        message: "Based on what you've shared, your situation appears to meet the criteria for a more detailed review.",
      };
    }

    return {
      qualified: false,
      severity: lead.estimatedSeverity,
      message: "At this time, your situation may not require our services, but we're happy to provide general guidance on the claims process.",
    };
  }

  private generateRecommendation(session: SalesAgentSession): string[] {
    if (session.qualificationResult?.qualified) {
      return [
        "Based on what you've told me, I would recommend moving forward with a full claim review so everything is properly evaluated.",
        "This gives us the opportunity to make sure nothing is missed and that your claim reflects the full scope of the damage.",
      ];
    }

    return [
      "Based on what we've discussed, your situation may not need a full review at this time.",
      "However, I'd recommend keeping your documentation organized. If anything changes or new damage appears, don't hesitate to reach out.",
    ];
  }

  private createExchange(step: SessionStep, role: 'agent' | 'client', content: string): SessionExchange {
    return {
      id: 'ex-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      step,
      role,
      content,
      timestamp: new Date().toISOString(),
    };
  }

  // ══════════════════════════════════════════════════════════════
  // Persistence (backend integration)
  // ══════════════════════════════════════════════════════════════

  private persistSession(session: SalesAgentSession): void {
    // POST to backend for CRM tracking
    this.http.post('client-portal/sales-sessions', session).pipe(
      catchError(() => of(null)),
    ).subscribe();
  }

  /**
   * Load a previous session (for reconnection or review).
   */
  loadSession(sessionId: string): Observable<SalesAgentSession | null> {
    return this.http.get<SalesAgentSession>(`client-portal/sales-sessions/${sessionId}`).pipe(
      catchError(() => of(null)),
    );
  }
}
