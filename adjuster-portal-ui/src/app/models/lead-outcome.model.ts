export interface LeadOutcome {
  id: string;
  outcome_status: string;
  category: string;
  notes: string | null;
  lead_id: string;
  recorded_by_id: string;
  automation_triggered: string | null;
  created_at: string;
  updated_at: string | null;
  created_by: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  updated_by: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export interface LeadOutcomeCreate {
  outcome_status: string;
  notes?: string;
  appointment_date?: string;
  callback_date?: string;
}

export interface AgentPerformanceMetrics {
  agent_id: string;
  agent_name: string;
  total_leads_received: number;
  contact_attempts: number;
  appointments_scheduled: number;
  signed_clients: number;
  closing_rate: number;
  no_answer: number;
  left_message: number;
  callbacks_pending: number;
  wants_info: number;
}

export interface OutcomeBreakdown {
  outcome_status: string;
  category: string;
  count: number;
}

export interface OutcomePercentageItem {
  outcome_status: string;
  count: number;
  percentage: number;
}

export interface AgentOutcomeBreakdown {
  agent_id: string;
  agent_name: string;
  total_outcomes: number;
  breakdown: OutcomePercentageItem[];
}

export interface OutcomeOption {
  value: string;
  label: string;
  description: string;
  automationHint: string;
}

export const OUTCOME_CATEGORIES: Record<string, OutcomeOption[]> = {
  'Contact Attempts': [
    {
      value: 'no-answer-left-message',
      label: 'No Answer \u2013 Left Message',
      description: 'Customer did not answer. Voicemail left.',
      automationHint: '',
    },
    {
      value: 'no-answer-no-message',
      label: 'No Answer \u2013 No Message',
      description: 'Customer did not answer. No voicemail left.',
      automationHint: '',
    },
    {
      value: 'call-back-later-today',
      label: 'Call Back Later Today',
      description: 'Customer asked for a call later today.',
      automationHint: 'A high-priority callback task will automatically be created for today.',
    },
    {
      value: 'call-back-tomorrow',
      label: 'Call Back Tomorrow',
      description: 'Customer asked for follow-up tomorrow.',
      automationHint: 'A callback task will automatically be created for tomorrow.',
    },
    {
      value: 'wrong-number',
      label: 'Wrong Number',
      description: 'Phone number is incorrect or no longer in service.',
      automationHint: 'The phone number will be marked invalid. Future automated calls and texts will be blocked.',
    },
  ],
  'Lead Quality': [
    {
      value: 'no-fire-incorrect-incident',
      label: 'No Fire / Incorrect Incident',
      description: 'Incident was not a fire or was incorrectly reported.',
      automationHint: '',
    },
    {
      value: 'not-interested',
      label: 'Not Interested',
      description: 'Customer declined services.',
      automationHint: '',
    },
    {
      value: 'already-handled',
      label: 'Already Handled',
      description: 'Customer already has a public adjuster or has resolved the claim.',
      automationHint: '',
    },
  ],
  'Engagement': [
    {
      value: 'wants-more-information',
      label: 'Wants More Information',
      description: 'Customer wants more details about services.',
      automationHint: 'A brochure will be sent via email and SMS automatically.',
    },
    {
      value: 'appointment-scheduled',
      label: 'Appointment Scheduled',
      description: 'An in-person inspection appointment has been set.',
      automationHint: 'Select the appointment date below.',
    },
    {
      value: 'inspection-completed',
      label: 'Inspection Completed',
      description: 'The property inspection has been completed.',
      automationHint: '',
    },
  ],
  'Conversions': [
    {
      value: 'signed-client',
      label: 'Signed Client',
      description: 'Customer signed the agreement.',
      automationHint: 'The lead will be converted to a claim.',
    },
    {
      value: 'claim-filed',
      label: 'Claim Filed',
      description: 'An insurance claim has been filed for this lead.',
      automationHint: '',
    },
    {
      value: 'lost-lead',
      label: 'Lost Lead',
      description: 'Lead was lost and will not convert.',
      automationHint: '',
    },
  ],
};
