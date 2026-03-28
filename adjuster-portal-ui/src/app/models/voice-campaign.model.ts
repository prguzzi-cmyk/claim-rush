// Voice Campaign Models

export enum VoiceCampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

export type VoiceCallOutcomeType =
  | 'qualified_lead'
  | 'not_interested'
  | 'no_answer'
  | 'left_voicemail'
  | 'appointment_booked'
  | 'wrong_number'
  | 'call_back_later';

export type VoiceCallStatus =
  | 'pending'
  | 'initiated'
  | 'ringing'
  | 'connected'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'voicemail';

export interface VoiceCampaign {
  id: string;
  name: string;
  description?: string;
  status: VoiceCampaignStatus;
  script_template?: string;
  lead_source_filter?: string;
  territory_state_filter?: string;
  incident_type_filter?: string;
  call_window_start: string;
  call_window_end: string;
  call_window_timezone: string;
  max_retries: number;
  retry_delay_minutes: number;
  max_calls_per_day: number;
  total_leads_targeted: number;
  total_calls_placed: number;
  total_calls_answered: number;
  total_appointments_booked: number;
  launched_at?: string;
  completed_at?: string;
  created_by_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VoiceCampaignCreate {
  name: string;
  description?: string;
  script_template?: string;
  lead_source_filter?: string;
  territory_state_filter?: string;
  incident_type_filter?: string;
  call_window_start?: string;
  call_window_end?: string;
  call_window_timezone?: string;
  max_retries?: number;
  retry_delay_minutes?: number;
  max_calls_per_day?: number;
}

export interface VoiceCallLog {
  id: string;
  campaign_id?: string;
  lead_id?: string;
  lead_name?: string;
  phone_number: string;
  call_sid?: string;
  status: VoiceCallStatus;
  outcome?: VoiceCallOutcomeType;
  duration_seconds: number;
  transcript_summary?: string;
  started_at?: string;
  ended_at?: string;
  retry_count: number;
  cost_cents: number;
  agent_id?: string;
  created_at?: string;
}

export interface VoiceCallLogDetail extends VoiceCallLog {
  transcript_text?: string;
  transcript_url?: string;
  recording_url?: string;
  campaign_name?: string;
}

export interface VoiceCampaignAnalytics {
  total_calls: number;
  calls_answered: number;
  conversion_rate: number;
  avg_duration_seconds: number;
  outcome_breakdown: Record<string, number>;
  daily_trend: Array<{ date: string; calls: number; answered: number }>;
}

export interface VoiceUsageSummary {
  minutes_used: number;
  plan_limit_minutes: number;
  percent_used: number;
  call_count: number;
  overage_minutes: number;
}

export interface CampaignLaunchRequest {
  lead_ids: string[];
}

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  active: '#4caf50',
  paused: '#ff9800',
  completed: '#2196f3',
  draft: '#9e9e9e',
};

export const CALL_STATUS_ICONS: Record<string, string> = {
  completed: 'check_circle',
  connected: 'phone_in_talk',
  ringing: 'ring_volume',
  initiated: 'phone_forwarded',
  failed: 'error',
  no_answer: 'phone_missed',
  voicemail: 'voicemail',
  pending: 'schedule',
};

export const CALL_STATUS_COLORS: Record<string, string> = {
  completed: '#4caf50',
  connected: '#2196f3',
  ringing: '#ff9800',
  initiated: '#ff9800',
  failed: '#f44336',
  no_answer: '#9e9e9e',
  voicemail: '#7c4dff',
  pending: '#bdbdbd',
};

export const OUTCOME_LABELS: Record<string, string> = {
  qualified_lead: 'Qualified Lead',
  not_interested: 'Not Interested',
  no_answer: 'No Answer',
  left_voicemail: 'Left Voicemail',
  appointment_booked: 'Appointment Booked',
  wrong_number: 'Wrong Number',
  call_back_later: 'Call Back Later',
};

export const OUTCOME_COLORS: Record<string, string> = {
  qualified_lead: '#4caf50',
  not_interested: '#f44336',
  no_answer: '#9e9e9e',
  left_voicemail: '#ff9800',
  appointment_booked: '#2196f3',
  wrong_number: '#795548',
  call_back_later: '#ffc107',
};
