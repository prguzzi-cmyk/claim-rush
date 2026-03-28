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

  private campaigns$ = new BehaviorSubject<VoiceAgentCampaign[]>(this.mockCampaigns());
  private calls$ = new BehaviorSubject<VoiceCall[]>(this.mockCalls());
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
    return of([
      { date: 'Mar 10', placed: 45, connected: 22, qualified: 4 },
      { date: 'Mar 11', placed: 62, connected: 31, qualified: 7 },
      { date: 'Mar 12', placed: 58, connected: 28, qualified: 5 },
      { date: 'Mar 13', placed: 71, connected: 38, qualified: 9 },
      { date: 'Mar 14', placed: 66, connected: 35, qualified: 8 },
      { date: 'Mar 15', placed: 53, connected: 26, qualified: 6 },
      { date: 'Mar 16', placed: 34, connected: 18, qualified: 3 },
    ]);
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

  // ── Mock Data ────────────────────────────────────────────────────
  private mockCampaigns(): VoiceAgentCampaign[] {
    return [
      {
        id: 'VOC-001', name: 'Dallas Fire Response', status: 'active', leadSource: 'fire_incident',
        scriptId: 'VS-001', scriptName: 'Fire Damage Outreach', callingHoursStart: '09:00', callingHoursEnd: '18:00',
        timezone: 'CST', maxCallsPerDay: 100, maxRetries: 3, retryDelayMinutes: 60, throttleCallsPerMinute: 5,
        totalLeads: 85, callsPlaced: 62, callsConnected: 31, leadsGenerated: 8, appointmentsBooked: 3,
        createdAt: '2026-03-14T10:00:00Z', launchedAt: '2026-03-14T14:00:00Z',
      },
      {
        id: 'VOC-002', name: 'Oklahoma Hail Storm', status: 'active', leadSource: 'storm_intelligence',
        scriptId: 'VS-002', scriptName: 'Storm Damage Script', callingHoursStart: '08:00', callingHoursEnd: '19:00',
        timezone: 'CST', maxCallsPerDay: 150, maxRetries: 2, retryDelayMinutes: 45, throttleCallsPerMinute: 8,
        totalLeads: 120, callsPlaced: 98, callsConnected: 52, leadsGenerated: 14, appointmentsBooked: 5,
        createdAt: '2026-03-13T08:00:00Z', launchedAt: '2026-03-13T09:00:00Z',
      },
      {
        id: 'VOC-003', name: 'Houston Wind Damage', status: 'paused', leadSource: 'storm_intelligence',
        scriptId: 'VS-002', scriptName: 'Storm Damage Script', callingHoursStart: '09:00', callingHoursEnd: '17:00',
        timezone: 'CST', maxCallsPerDay: 80, maxRetries: 3, retryDelayMinutes: 90, throttleCallsPerMinute: 4,
        totalLeads: 65, callsPlaced: 41, callsConnected: 18, leadsGenerated: 4, appointmentsBooked: 1,
        createdAt: '2026-03-12T12:00:00Z', launchedAt: '2026-03-12T14:00:00Z',
      },
      {
        id: 'VOC-004', name: 'Denver Hail Follow-up', status: 'completed', leadSource: 'rotation_engine',
        scriptId: 'VS-002', scriptName: 'Storm Damage Script', callingHoursStart: '10:00', callingHoursEnd: '18:00',
        timezone: 'MST', maxCallsPerDay: 60, maxRetries: 2, retryDelayMinutes: 30, throttleCallsPerMinute: 3,
        totalLeads: 45, callsPlaced: 45, callsConnected: 24, leadsGenerated: 6, appointmentsBooked: 2,
        createdAt: '2026-03-10T09:00:00Z', launchedAt: '2026-03-10T10:00:00Z',
      },
      {
        id: 'VOC-005', name: 'Fort Worth Vandalism', status: 'draft', leadSource: 'manual',
        scriptId: 'VS-003', scriptName: 'Vandalism Response Script', callingHoursStart: '09:00', callingHoursEnd: '17:00',
        timezone: 'CST', maxCallsPerDay: 40, maxRetries: 2, retryDelayMinutes: 60, throttleCallsPerMinute: 2,
        totalLeads: 22, callsPlaced: 0, callsConnected: 0, leadsGenerated: 0, appointmentsBooked: 0,
        createdAt: '2026-03-16T08:00:00Z', launchedAt: null,
      },
    ];
  }

  private mockCalls(): VoiceCall[] {
    return [
      {
        id: 'VC-001', campaignId: 'VOC-001', campaignName: 'Dallas Fire Response',
        leadName: 'Robert Williams', leadPhone: '(214) 555-0142', leadEmail: 'rwilliams@email.com',
        propertyAddress: '1420 Elm St', city: 'Dallas', state: 'TX', claimType: 'fire',
        status: 'completed', outcome: 'qualified_lead', duration: 245, retryCount: 0,
        aiQualificationScore: 88, intentDetected: 'Strong interest — insurance claim filing',
        routedToSalesAgent: true, salesAgentConversationId: 'SAC-001',
        calledAt: '2026-03-16T09:15:00Z', completedAt: '2026-03-16T09:19:05Z',
        transcript: [
          { speaker: 'ai', text: 'Hello, this is the UPA property assistance line. Am I speaking with Robert Williams?', timestamp: '2026-03-16T09:15:00Z', sentiment: null },
          { speaker: 'homeowner', text: 'Yes, this is Robert.', timestamp: '2026-03-16T09:15:08Z', sentiment: 'neutral' },
          { speaker: 'ai', text: 'Robert, I\'m calling because we detected a fire incident reported near your property at 1420 Elm St in Dallas. I wanted to check — has your property sustained any damage?', timestamp: '2026-03-16T09:15:12Z', sentiment: null },
          { speaker: 'homeowner', text: 'Yeah, actually we had a lot of smoke damage. The kitchen got hit pretty hard. We\'re staying with family right now.', timestamp: '2026-03-16T09:15:30Z', sentiment: 'negative' },
          { speaker: 'ai', text: 'I\'m very sorry to hear that, Robert. Smoke damage can be extensive and is typically well-covered by homeowner\'s insurance. Do you currently have an active insurance policy?', timestamp: '2026-03-16T09:15:45Z', sentiment: null },
          { speaker: 'homeowner', text: 'Yes, we have State Farm. We haven\'t filed anything yet though. We\'re still trying to figure out what to do.', timestamp: '2026-03-16T09:16:02Z', sentiment: 'negative' },
          { speaker: 'ai', text: 'That\'s completely understandable. At UPA, we specialize in helping homeowners navigate the insurance claim process. We have certified public adjusters who can assess your damage and help you get the maximum settlement you\'re entitled to — all at no upfront cost to you.', timestamp: '2026-03-16T09:16:18Z', sentiment: null },
          { speaker: 'homeowner', text: 'That sounds helpful. What would we need to do?', timestamp: '2026-03-16T09:16:40Z', sentiment: 'positive' },
          { speaker: 'ai', text: 'I\'d love to connect you with Sarah Mitchell, one of our top adjusters in the Dallas area. She can schedule a free property inspection and walk you through the entire process. Would you be available for a consultation this week?', timestamp: '2026-03-16T09:16:55Z', sentiment: null },
          { speaker: 'homeowner', text: 'Yes, that would be great. Maybe Thursday afternoon?', timestamp: '2026-03-16T09:17:10Z', sentiment: 'positive' },
          { speaker: 'ai', text: 'Perfect. I\'ll have Sarah reach out to confirm Thursday afternoon. She\'ll come prepared with everything needed to start your claim. Is this the best number to reach you?', timestamp: '2026-03-16T09:17:25Z', sentiment: null },
          { speaker: 'homeowner', text: 'Yes, this is my cell. Thank you so much for calling.', timestamp: '2026-03-16T09:17:40Z', sentiment: 'positive' },
        ],
        aiDecisionMarkers: [
          { timestamp: '2026-03-16T09:15:30Z', type: 'intent_detected', label: 'Damage Confirmed', detail: 'Homeowner confirmed smoke and kitchen damage, currently displaced', score: null },
          { timestamp: '2026-03-16T09:16:02Z', type: 'qualification_trigger', label: 'Insurance Active', detail: 'State Farm policy confirmed, no claim filed yet — high opportunity', score: 75 },
          { timestamp: '2026-03-16T09:16:40Z', type: 'intent_detected', label: 'Interest Signal', detail: 'Homeowner asking about next steps — strong buying signal', score: null },
          { timestamp: '2026-03-16T09:17:10Z', type: 'scoring_update', label: 'Qualified Lead', detail: 'Appointment interest confirmed, score upgraded', score: 88 },
          { timestamp: '2026-03-16T09:17:40Z', type: 'escalation_point', label: 'Route to Sales Agent', detail: 'Lead qualified — routing to AI Sales Agent pipeline for Sarah Mitchell', score: 88 },
        ],
      },
      {
        id: 'VC-002', campaignId: 'VOC-002', campaignName: 'Oklahoma Hail Storm',
        leadName: 'Jennifer Martinez', leadPhone: '(405) 555-0198', leadEmail: 'jmartinez@email.com',
        propertyAddress: '892 Oak Ave', city: 'Oklahoma City', state: 'OK', claimType: 'storm',
        status: 'completed', outcome: 'possible_claim', duration: 180, retryCount: 0,
        aiQualificationScore: 82, intentDetected: 'Interested but needs more information',
        routedToSalesAgent: true, salesAgentConversationId: 'SAC-002',
        calledAt: '2026-03-15T10:30:00Z', completedAt: '2026-03-15T10:33:00Z',
        transcript: [
          { speaker: 'ai', text: 'Hello, this is the UPA property assistance line. May I speak with Jennifer Martinez?', timestamp: '2026-03-15T10:30:00Z', sentiment: null },
          { speaker: 'homeowner', text: 'Speaking.', timestamp: '2026-03-15T10:30:06Z', sentiment: 'neutral' },
          { speaker: 'ai', text: 'Jennifer, we detected severe hail in your area recently. Have you noticed any damage to your property at 892 Oak Ave?', timestamp: '2026-03-15T10:30:10Z', sentiment: null },
          { speaker: 'homeowner', text: 'Actually yes. I noticed dents on the roof and the siding is cracked on the north side. I wasn\'t sure if it was worth filing a claim though.', timestamp: '2026-03-15T10:30:25Z', sentiment: 'neutral' },
          { speaker: 'ai', text: 'What you\'re describing sounds like significant hail damage. In most cases, insurance covers roof and siding repairs fully. Our adjusters typically help homeowners recover 40-60% more than filing on their own.', timestamp: '2026-03-15T10:30:45Z', sentiment: null },
          { speaker: 'homeowner', text: 'I\'d like to know more. Can someone come look at it?', timestamp: '2026-03-15T10:31:05Z', sentiment: 'positive' },
        ],
        aiDecisionMarkers: [
          { timestamp: '2026-03-15T10:30:25Z', type: 'intent_detected', label: 'Damage Confirmed', detail: 'Roof dents and siding cracks reported', score: null },
          { timestamp: '2026-03-15T10:31:05Z', type: 'qualification_trigger', label: 'Inspection Requested', detail: 'Homeowner requesting on-site assessment', score: 82 },
        ],
      },
      {
        id: 'VC-003', campaignId: 'VOC-001', campaignName: 'Dallas Fire Response',
        leadName: 'Mark Johnson', leadPhone: '(972) 555-0311', leadEmail: 'mjohnson@email.com',
        propertyAddress: '555 Pecan St', city: 'Dallas', state: 'TX', claimType: 'fire',
        status: 'completed', outcome: 'no_answer', duration: 0, retryCount: 2,
        aiQualificationScore: null, intentDetected: null,
        routedToSalesAgent: false, salesAgentConversationId: null,
        calledAt: '2026-03-16T09:45:00Z', completedAt: '2026-03-16T09:45:30Z',
        transcript: [],
        aiDecisionMarkers: [],
      },
      {
        id: 'VC-004', campaignId: 'VOC-002', campaignName: 'Oklahoma Hail Storm',
        leadName: 'Sarah Kim', leadPhone: '(405) 555-0277', leadEmail: 'skim@email.com',
        propertyAddress: '1200 Magnolia Dr', city: 'Norman', state: 'OK', claimType: 'storm',
        status: 'completed', outcome: 'not_interested', duration: 45, retryCount: 0,
        aiQualificationScore: 22, intentDetected: 'Not interested — no visible damage',
        routedToSalesAgent: false, salesAgentConversationId: null,
        calledAt: '2026-03-15T11:00:00Z', completedAt: '2026-03-15T11:00:45Z',
        transcript: [
          { speaker: 'ai', text: 'Hello, am I speaking with Sarah Kim?', timestamp: '2026-03-15T11:00:00Z', sentiment: null },
          { speaker: 'homeowner', text: 'Yes.', timestamp: '2026-03-15T11:00:05Z', sentiment: 'neutral' },
          { speaker: 'ai', text: 'We detected hail in your area. Has your property at 1200 Magnolia Dr sustained any damage?', timestamp: '2026-03-15T11:00:10Z', sentiment: null },
          { speaker: 'homeowner', text: 'No, everything looks fine. We didn\'t have any issues. Thanks anyway.', timestamp: '2026-03-15T11:00:22Z', sentiment: 'neutral' },
        ],
        aiDecisionMarkers: [
          { timestamp: '2026-03-15T11:00:22Z', type: 'intent_detected', label: 'No Damage', detail: 'Homeowner reports no damage, closing call', score: 22 },
        ],
      },
      {
        id: 'VC-005', campaignId: 'VOC-001', campaignName: 'Dallas Fire Response',
        leadName: 'Angela Davis', leadPhone: '(817) 555-0188', leadEmail: 'adavis@email.com',
        propertyAddress: '2200 Cedar Ct', city: 'Fort Worth', state: 'TX', claimType: 'fire',
        status: 'completed', outcome: 'left_voicemail', duration: 32, retryCount: 1,
        aiQualificationScore: null, intentDetected: null,
        routedToSalesAgent: false, salesAgentConversationId: null,
        calledAt: '2026-03-16T10:00:00Z', completedAt: '2026-03-16T10:00:32Z',
        transcript: [
          { speaker: 'ai', text: 'Hello, this is the UPA property assistance line calling for Angela Davis. We\'re reaching out about a fire incident reported near your property. If you\'ve experienced any damage, we offer free property inspections and can help with your insurance claim. Please call us back at your convenience. Thank you.', timestamp: '2026-03-16T10:00:00Z', sentiment: null },
        ],
        aiDecisionMarkers: [],
      },
      {
        id: 'VC-006', campaignId: 'VOC-002', campaignName: 'Oklahoma Hail Storm',
        leadName: 'David Chen', leadPhone: '(972) 555-0290', leadEmail: 'dchen@email.com',
        propertyAddress: '450 Willow Way', city: 'Plano', state: 'TX', claimType: 'storm',
        status: 'completed', outcome: 'call_back_later', duration: 60, retryCount: 0,
        aiQualificationScore: 55, intentDetected: 'Busy — requested callback',
        routedToSalesAgent: false, salesAgentConversationId: null,
        calledAt: '2026-03-15T14:30:00Z', completedAt: '2026-03-15T14:31:00Z',
        transcript: [
          { speaker: 'ai', text: 'Hello, may I speak with David Chen?', timestamp: '2026-03-15T14:30:00Z', sentiment: null },
          { speaker: 'homeowner', text: 'Yes but I\'m at work right now. Can you call me back later this evening?', timestamp: '2026-03-15T14:30:10Z', sentiment: 'neutral' },
          { speaker: 'ai', text: 'Of course, David. We\'ll call you back this evening. Have a great day.', timestamp: '2026-03-15T14:30:20Z', sentiment: null },
        ],
        aiDecisionMarkers: [
          { timestamp: '2026-03-15T14:30:10Z', type: 'intent_detected', label: 'Callback Requested', detail: 'Homeowner busy, requested evening callback', score: 55 },
        ],
      },
      {
        id: 'VC-007', campaignId: 'VOC-003', campaignName: 'Houston Wind Damage',
        leadName: 'Michael Thompson', leadPhone: '(713) 555-0267', leadEmail: 'mthompson@email.com',
        propertyAddress: '3300 Pine Rd', city: 'Houston', state: 'TX', claimType: 'storm',
        status: 'completed', outcome: 'qualified_lead', duration: 210, retryCount: 0,
        aiQualificationScore: 91, intentDetected: 'Strong interest — fence and roof damage confirmed',
        routedToSalesAgent: true, salesAgentConversationId: 'SAC-003',
        calledAt: '2026-03-14T15:00:00Z', completedAt: '2026-03-14T15:03:30Z',
        transcript: [
          { speaker: 'ai', text: 'Hello, is this Michael Thompson?', timestamp: '2026-03-14T15:00:00Z', sentiment: null },
          { speaker: 'homeowner', text: 'Yes it is.', timestamp: '2026-03-14T15:00:05Z', sentiment: 'neutral' },
          { speaker: 'ai', text: 'Michael, we noticed high winds were reported in your area. Has your property at 3300 Pine Rd sustained any damage?', timestamp: '2026-03-14T15:00:10Z', sentiment: null },
          { speaker: 'homeowner', text: 'Absolutely. My fence is completely down and the garage roof has missing shingles. It\'s a mess.', timestamp: '2026-03-14T15:00:25Z', sentiment: 'negative' },
          { speaker: 'ai', text: 'That sounds like significant wind damage. This type of damage is typically covered under standard homeowner insurance policies. Would you be interested in a free property inspection from one of our certified adjusters?', timestamp: '2026-03-14T15:00:40Z', sentiment: null },
          { speaker: 'homeowner', text: 'Yes, definitely. When can someone come out?', timestamp: '2026-03-14T15:00:55Z', sentiment: 'positive' },
        ],
        aiDecisionMarkers: [
          { timestamp: '2026-03-14T15:00:25Z', type: 'intent_detected', label: 'Severe Damage', detail: 'Fence down, garage roof missing shingles', score: null },
          { timestamp: '2026-03-14T15:00:55Z', type: 'qualification_trigger', label: 'Inspection Accepted', detail: 'Homeowner eager for free inspection', score: 91 },
          { timestamp: '2026-03-14T15:00:55Z', type: 'escalation_point', label: 'Route to Sales', detail: 'Qualified lead — routing to AI Sales Agent', score: 91 },
        ],
      },
      {
        id: 'VC-008', campaignId: 'VOC-004', campaignName: 'Denver Hail Follow-up',
        leadName: 'Thomas Garcia', leadPhone: '(303) 555-0412', leadEmail: 'tgarcia@email.com',
        propertyAddress: '1100 Birch Ln', city: 'Denver', state: 'CO', claimType: 'storm',
        status: 'completed', outcome: 'qualified_lead', duration: 195, retryCount: 0,
        aiQualificationScore: 94, intentDetected: 'Urgent need — full roof replacement',
        routedToSalesAgent: true, salesAgentConversationId: 'SAC-005',
        calledAt: '2026-03-13T11:15:00Z', completedAt: '2026-03-13T11:18:15Z',
        transcript: [
          { speaker: 'ai', text: 'Hello, may I speak with Thomas Garcia?', timestamp: '2026-03-13T11:15:00Z', sentiment: null },
          { speaker: 'homeowner', text: 'That\'s me.', timestamp: '2026-03-13T11:15:05Z', sentiment: 'neutral' },
          { speaker: 'ai', text: 'Thomas, we\'re following up on the recent hailstorm in your area. Has your property at 1100 Birch Ln been affected?', timestamp: '2026-03-13T11:15:10Z', sentiment: null },
          { speaker: 'homeowner', text: 'The roof is badly damaged. Multiple shingles are torn off and I can see dents on the metal vents. I need help.', timestamp: '2026-03-13T11:15:28Z', sentiment: 'negative' },
          { speaker: 'ai', text: 'I understand, Thomas. Hail damage like that typically requires a full roof replacement, which is covered by most homeowner policies. We can have one of our top adjusters, Emily Parker, assess the damage and handle your entire claim process at no upfront cost.', timestamp: '2026-03-13T11:15:45Z', sentiment: null },
          { speaker: 'homeowner', text: 'That would be amazing. How soon can she come?', timestamp: '2026-03-13T11:16:00Z', sentiment: 'positive' },
        ],
        aiDecisionMarkers: [
          { timestamp: '2026-03-13T11:15:28Z', type: 'intent_detected', label: 'Urgent Damage', detail: 'Full roof replacement needed, homeowner requests help', score: null },
          { timestamp: '2026-03-13T11:16:00Z', type: 'qualification_trigger', label: 'High Priority Lead', detail: 'Urgent need, requesting immediate appointment', score: 94 },
          { timestamp: '2026-03-13T11:16:00Z', type: 'escalation_point', label: 'Route to Sales', detail: 'Priority qualified lead — routing to Emily Parker via AI Sales Agent', score: 94 },
        ],
      },
    ];
  }

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
