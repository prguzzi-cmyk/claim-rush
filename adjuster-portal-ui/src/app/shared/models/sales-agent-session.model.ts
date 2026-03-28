/**
 * AI Sales / Intake Agent Session Models
 *
 * Structured intake and conversion assistant for live and scheduled
 * claim consultations. Operates as a guided 6-step flow.
 */

// ── Session Steps ────────────────────────────────────────────────

export type SessionStep =
  | 'introduction'
  | 'situation'
  | 'education'
  | 'qualification'
  | 'recommendation'
  | 'action';

export const SESSION_STEPS: { key: SessionStep; label: string; icon: string }[] = [
  { key: 'introduction', label: 'Introduction', icon: 'waving_hand' },
  { key: 'situation', label: 'Your Situation', icon: 'home' },
  { key: 'education', label: 'How Claims Work', icon: 'school' },
  { key: 'qualification', label: 'Qualification', icon: 'verified' },
  { key: 'recommendation', label: 'Recommendation', icon: 'lightbulb' },
  { key: 'action', label: 'Next Steps', icon: 'rocket_launch' },
];

// ── Session Status ───────────────────────────────────────────────

export type SessionStatus =
  | 'active'
  | 'completed'
  | 'dropped'
  | 'scheduled_followup';

export type SessionOutcome =
  | 'inspection_scheduled'
  | 'continued_online'
  | 'spoke_with_team'
  | 'not_interested'
  | 'not_qualified'
  | 'dropped_off'
  | null;

// ── Session Exchange ─────────────────────────────────────────────

export interface SessionExchange {
  id: string;
  step: SessionStep;
  role: 'agent' | 'client';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// ── Lead Data (input to session) ─────────────────────────────────

export interface SessionLeadData {
  leadId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  incidentType: string;
  photoCount: number;
  estimatedSeverity: string | null;
  qualificationStatus: string | null;
  claimNumber: string | null;
}

// ── Session State ────────────────────────────────────────────────

export interface SalesAgentSession {
  id: string;
  leadId: string;
  leadData: SessionLeadData;
  currentStep: SessionStep;
  status: SessionStatus;
  outcome: SessionOutcome;
  exchanges: SessionExchange[];
  qualificationResult: {
    qualified: boolean;
    severity: string | null;
    message: string;
  } | null;
  startedAt: string;
  completedAt: string | null;
  dropOffStep: SessionStep | null;
}

// ── Script Templates ─────────────────────────────────────────────

export interface StepScript {
  step: SessionStep;
  agentMessages: string[];
  promptQuestions: string[];
  responseOptions?: string[];
}

export const SESSION_SCRIPTS: StepScript[] = [
  {
    step: 'introduction',
    agentMessages: [
      "Hi, thanks for taking a few minutes to go through this.",
      "I'm here to help walk through your situation and explain how the claim process works so you can make an informed decision.",
    ],
    promptQuestions: [
      "Before we start — can you tell me a little about what happened to your property?",
    ],
  },
  {
    step: 'situation',
    agentMessages: [
      "Thank you for sharing that. I want to make sure I understand the full picture.",
    ],
    promptQuestions: [
      "When did the damage occur?",
      "Have you filed an insurance claim yet?",
      "Has anyone inspected the property so far?",
    ],
    responseOptions: [
      "Yes, I've filed a claim",
      "No, I haven't filed yet",
      "I'm not sure where to start",
    ],
  },
  {
    step: 'education',
    agentMessages: [
      "Here's something important to understand about the claims process.",
      "Insurance companies use their own estimating methods, which may not always capture the full scope of damage.",
      "Many claims are initially underpaid — not because of bad intent, but because the initial review may not account for everything.",
      "As a policyholder, you have the right to have your claim independently reviewed and to have representation throughout the process.",
    ],
    promptQuestions: [
      "Does that make sense? Do you have any questions about how the process works?",
    ],
  },
  {
    step: 'qualification',
    agentMessages: [
      "Based on what you've shared, let me take a quick look to see if your situation is a good fit for our review process.",
    ],
    promptQuestions: [],
  },
  {
    step: 'recommendation',
    agentMessages: [],
    promptQuestions: [],
  },
  {
    step: 'action',
    agentMessages: [
      "Here's what I'd suggest as a next step.",
    ],
    promptQuestions: [
      "Which option works best for you?",
    ],
    responseOptions: [
      "Schedule an inspection",
      "Continue online",
      "Speak with the team",
    ],
  },
];

// ── Meeting Configuration (future Zoom/Teams) ────────────────────

export type MeetingPlatform = 'zoom' | 'teams' | 'phone' | 'in_person';

export interface MeetingConfig {
  platform: MeetingPlatform;
  meetingUrl: string | null;
  meetingId: string | null;
  scheduledAt: string | null;
  duration: number; // minutes
}
