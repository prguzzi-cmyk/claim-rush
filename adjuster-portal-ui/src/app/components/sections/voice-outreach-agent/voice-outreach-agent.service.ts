import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { AiSalesAgentService, AiConversation, ConversationMessage, ClaimType } from '../ai-sales-agent/ai-sales-agent.service';

// ── Types ────────────────────────────────────────────────────────────
export type CallOutcome = 'no_answer' | 'left_voicemail' | 'not_interested' | 'call_back_later' | 'possible_claim' | 'qualified_lead';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
export type CallStatus = 'queued' | 'ringing' | 'connected' | 'completed' | 'failed';
export type LeadSource = 'storm_intelligence' | 'fire_incident' | 'rotation_engine' | 'manual' | 'community_advocate';

export interface VoiceAgentCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  leadSource: LeadSource;
  scriptId: string;
  scriptName: string;
  callingHoursStart: string;
  callingHoursEnd: string;
  timezone: string;
  maxCallsPerDay: number;
  maxRetries: number;
  retryDelayMinutes: number;
  throttleCallsPerMinute: number;
  totalLeads: number;
  callsPlaced: number;
  callsConnected: number;
  leadsGenerated: number;
  appointmentsBooked: number;
  createdAt: string;
  launchedAt: string | null;
}

export interface VoiceCall {
  id: string;
  campaignId: string;
  campaignName: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  propertyAddress: string;
  city: string;
  state: string;
  claimType: ClaimType;
  status: CallStatus;
  outcome: CallOutcome | null;
  duration: number;
  retryCount: number;
  aiQualificationScore: number | null;
  intentDetected: string | null;
  transcript: TranscriptEntry[];
  aiDecisionMarkers: AiDecisionMarker[];
  routedToSalesAgent: boolean;
  salesAgentConversationId: string | null;
  calledAt: string;
  completedAt: string | null;
}

export interface TranscriptEntry {
  speaker: 'ai' | 'homeowner';
  text: string;
  timestamp: string;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
}

export interface AiDecisionMarker {
  timestamp: string;
  type: 'intent_detected' | 'qualification_trigger' | 'objection_handled' | 'escalation_point' | 'scoring_update';
  label: string;
  detail: string;
  score: number | null;
}

export interface VoiceScript {
  id: string;
  name: string;
  claimType: ClaimType;
  greeting: string;
  stages: VoiceScriptStage[];
}

export interface VoiceScriptStage {
  label: string;
  prompt: string;
  intentKeywords: string[];
  fallbackResponse: string;
}

export interface VoiceDashboardKpis {
  callsPlaced: number;
  connectionRate: number;
  leadsGenerated: number;
  appointmentsBooked: number;
  avgCallDuration: string;
  qualifiedLeadRate: number;
  noAnswerRate: number;
  callBackRate: number;
}

export interface DailyCallMetric {
  date: string;
  placed: number;
  connected: number;
  qualified: number;
}

// ── Service ──────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class VoiceOutreachAgentService {

  // Empty initial state — no campaigns or calls until a backend endpoint
  // is wired and real outreach has happened. Was previously seeded with
  // 5 fake campaigns + 8 fake call transcripts (Robert Williams, Jennifer
  // Martinez, etc.) that implied live call activity that never occurred.
  // Scripts are kept as default templates; they are content, not activity.
  // TODO: scripts hold hardcoded UPA-branded greeting copy and should be
  // moved to a config/i18n source per the build-to-sell rule before the
  // wider Chapter launch.
  private campaigns$ = new BehaviorSubject<VoiceAgentCampaign[]>([]);
  private calls$ = new BehaviorSubject<VoiceCall[]>([]);
  private scripts$ = new BehaviorSubject<VoiceScript[]>(this.mockScripts());

  constructor(private salesAgentService: AiSalesAgentService) {}

  getCampaigns(): Observable<VoiceAgentCampaign[]> { return this.campaigns$.asObservable(); }
  getCalls(): Observable<VoiceCall[]> { return this.calls$.asObservable(); }
  getScripts(): Observable<VoiceScript[]> { return this.scripts$.asObservable(); }

  getCampaignById(id: string): VoiceAgentCampaign | undefined {
    return this.campaigns$.value.find(c => c.id === id);
  }

  getCallById(id: string): VoiceCall | undefined {
    return this.calls$.value.find(c => c.id === id);
  }

  getCallsByCampaign(campaignId: string): VoiceCall[] {
    return this.calls$.value.filter(c => c.campaignId === campaignId);
  }

  getKpis(): Observable<VoiceDashboardKpis> {
    const calls = this.calls$.value;
    const placed = calls.length;
    const connected = calls.filter(c => c.status === 'completed' && c.outcome !== 'no_answer').length;
    const qualified = calls.filter(c => c.outcome === 'qualified_lead' || c.outcome === 'possible_claim').length;
    const appts = calls.filter(c => c.routedToSalesAgent).length;
    const durations = calls.filter(c => c.duration > 0).map(c => c.duration);
    const avgDur = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const noAnswer = calls.filter(c => c.outcome === 'no_answer').length;
    const callBack = calls.filter(c => c.outcome === 'call_back_later').length;
    return of({
      callsPlaced: placed,
      connectionRate: placed ? Math.round((connected / placed) * 100) : 0,
      leadsGenerated: qualified,
      appointmentsBooked: appts,
      avgCallDuration: `${Math.floor(avgDur / 60)}:${String(avgDur % 60).padStart(2, '0')}`,
      qualifiedLeadRate: placed ? Math.round((qualified / placed) * 100) : 0,
      noAnswerRate: placed ? Math.round((noAnswer / placed) * 100) : 0,
      callBackRate: placed ? Math.round((callBack / placed) * 100) : 0,
    });
  }

  getDailyMetrics(): Observable<DailyCallMetric[]> {
    // Empty until a backend endpoint reports real daily call rollups.
    // Was previously hardcoded with 7 days of fabricated call counts
    // (Mar 10 → Mar 16) that implied a live outreach operation.
    return of([]);
  }

  createCampaign(campaign: VoiceAgentCampaign): void {
    this.campaigns$.next([campaign, ...this.campaigns$.value]);
  }

  updateCampaignStatus(id: string, status: CampaignStatus): void {
    const list = this.campaigns$.value.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, status };
      if (status === 'active' && !c.launchedAt) updated.launchedAt = new Date().toISOString();
      return updated;
    });
    this.campaigns$.next(list);
  }

  classifyCallOutcome(callId: string, outcome: CallOutcome): void {
    const list = this.calls$.value.map(c => c.id === callId ? { ...c, outcome } : c);
    this.calls$.next(list);
  }

  /** Route qualified calls to the AI Sales Agent pipeline */
  routeToSalesAgent(call: VoiceCall): string | null {
    if (call.outcome !== 'possible_claim' && call.outcome !== 'qualified_lead') return null;

    const convoId = 'SAC-VOA-' + Date.now().toString(36);
    const messages: ConversationMessage[] = call.transcript.map((t, i) => ({
      id: `vm-${i}`,
      sender: t.speaker === 'ai' ? 'ai' as const : 'homeowner' as const,
      content: t.text,
      timestamp: t.timestamp,
    }));
    // Add routing message
    messages.push({
      id: 'vm-route',
      sender: 'ai',
      content: `[Auto-routed from Voice Outreach] Call ID: ${call.id}, Campaign: ${call.campaignName}. AI Qualification Score: ${call.aiQualificationScore ?? 'N/A'}. Outcome: ${call.outcome}. This lead has been automatically transferred to the sales pipeline.`,
      timestamp: new Date().toISOString(),
    });

    // Update call record
    const updatedCalls = this.calls$.value.map(c =>
      c.id === call.id ? { ...c, routedToSalesAgent: true, salesAgentConversationId: convoId } : c
    );
    this.calls$.next(updatedCalls);

    return convoId;
  }

  // ── Default Scripts ──────────────────────────────────────────────
  // mockCampaigns() and mockCalls() were stripped 2026-05-15 — they
  // injected 5 fake campaigns + 8 fake call transcripts that implied
  // a live outreach operation. The dashboard now shows empty state
  // until real backend data lands. Only the default scripts remain
  // below, as templates a future operator can clone when wiring real
  // outreach.


  private mockScripts(): VoiceScript[] {
    return [
      {
        id: 'VS-001', name: 'Fire Damage Outreach', claimType: 'fire',
        greeting: 'Hello, this is the UPA property assistance line. Am I speaking with {name}?',
        stages: [
          { label: 'Damage Check', prompt: 'We detected a fire incident near your property at {address}. Has your property sustained any damage?', intentKeywords: ['damage', 'fire', 'smoke', 'burned', 'kitchen'], fallbackResponse: 'I understand. Fire incidents can be stressful. If you notice any damage later, please don\'t hesitate to call us.' },
          { label: 'Insurance Verification', prompt: 'Do you currently have an active homeowner\'s insurance policy?', intentKeywords: ['insurance', 'policy', 'state farm', 'allstate', 'covered'], fallbackResponse: 'If you\'re unsure about your coverage, our team can help review your policy.' },
          { label: 'Schedule Consultation', prompt: 'I\'d love to connect you with one of our certified adjusters for a free property assessment. Would you be available this week?', intentKeywords: ['yes', 'available', 'schedule', 'thursday', 'friday', 'this week'], fallbackResponse: 'No problem. If you change your mind, you can reach us anytime.' },
        ],
      },
      {
        id: 'VS-002', name: 'Storm Damage Script', claimType: 'storm',
        greeting: 'Hello, this is the UPA property assistance line. May I speak with {name}?',
        stages: [
          { label: 'Weather Impact', prompt: 'We noticed severe weather was recently reported in your area. Has your property at {address} sustained any damage?', intentKeywords: ['roof', 'hail', 'wind', 'shingles', 'siding', 'damage'], fallbackResponse: 'Glad to hear your property is fine. If you notice anything later, we\'re here to help.' },
          { label: 'Damage Assessment', prompt: 'Can you describe the damage you\'ve noticed? For example — missing shingles, cracked siding, or dents on metal surfaces?', intentKeywords: ['dents', 'cracks', 'missing', 'broken', 'leaking'], fallbackResponse: 'Sometimes storm damage isn\'t immediately visible. We offer free inspections if you\'d like peace of mind.' },
          { label: 'Offer Inspection', prompt: 'We provide free property inspections by certified adjusters. This can help you understand the full extent of damage and your insurance options. Would you be interested?', intentKeywords: ['yes', 'interested', 'inspection', 'come look', 'schedule'], fallbackResponse: 'Understood. You can always reach us later if you change your mind.' },
        ],
      },
      {
        id: 'VS-003', name: 'Vandalism Response Script', claimType: 'vandalism',
        greeting: 'Hello, this is the UPA property assistance line calling for {name}.',
        stages: [
          { label: 'Incident Check', prompt: 'We received reports of vandalism incidents in your neighborhood. Has your property been affected?', intentKeywords: ['vandalism', 'broken', 'graffiti', 'damaged', 'stolen'], fallbackResponse: 'Glad your property is safe. Stay vigilant and call us if anything changes.' },
          { label: 'Police Report', prompt: 'Have you filed a police report? This is important documentation for your insurance claim.', intentKeywords: ['police', 'report', 'filed', 'officer'], fallbackResponse: 'We recommend filing a police report as soon as possible. It strengthens your claim significantly.' },
          { label: 'Offer Help', prompt: 'We can help you navigate the insurance claim process to get your property restored. Would you like to schedule a free consultation?', intentKeywords: ['yes', 'help', 'consultation', 'schedule'], fallbackResponse: 'No problem. We\'re here whenever you need us.' },
        ],
      },
      {
        id: 'VS-004', name: 'Water Damage Response', claimType: 'water',
        greeting: 'Hello, this is the UPA property assistance line. Is this {name}?',
        stages: [
          { label: 'Situation Check', prompt: 'We understand you may be dealing with water damage. Can you tell me what happened?', intentKeywords: ['pipe', 'burst', 'flood', 'leak', 'water', 'ceiling'], fallbackResponse: 'If you experience any water issues in the future, quick action is key. Feel free to call us.' },
          { label: 'Severity Assessment', prompt: 'How much of your home is affected? Water damage can cause hidden problems like mold and structural issues.', intentKeywords: ['rooms', 'floor', 'ceiling', 'mold', 'entire'], fallbackResponse: 'Even minor water damage can worsen over time. We recommend getting it assessed.' },
          { label: 'Urgent Inspection', prompt: 'We should get someone out quickly to assess the damage before it worsens. Can I schedule a free emergency inspection?', intentKeywords: ['yes', 'schedule', 'urgent', 'asap', 'come'], fallbackResponse: 'Understood. Don\'t hesitate to reach out if the situation changes.' },
        ],
      },
    ];
  }
}
