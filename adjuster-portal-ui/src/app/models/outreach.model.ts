export class OutreachTemplate {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
  is_active: boolean;
  created_by_id?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class OutreachCampaign {
  id: string;
  name: string;
  lead_source?: string;
  territory_state?: string;
  contact_method: string;
  template_id: string;
  template?: OutreachTemplate;
  delay_minutes: number;
  max_attempts: number;
  trigger_on: string;
  is_active: boolean;
  created_by_id?: string;
  created_at?: Date;
  updated_at?: Date;
  // Campaign Manager fields
  description?: string;
  campaign_type?: string;
  status?: string;
  incident_type?: string;
  target_zip_code?: string;
  target_radius_miles?: number;
  total_targeted?: number;
  total_sent?: number;
  total_delivered?: number;
  total_responded?: number;
  launched_at?: Date;
  completed_at?: Date;
  steps?: CampaignStep[];
}

export class CampaignStep {
  id?: string;
  campaign_id?: string;
  step_number: number;
  channel: string;
  template_id: string;
  template?: OutreachTemplate;
  delay_minutes: number;
  subject?: string;
}

export class OutreachAttempt {
  id: string;
  campaign_id: string;
  lead_id: string;
  template_id?: string;
  channel: string;
  status: string;
  attempt_number: number;
  recipient_phone?: string;
  recipient_email?: string;
  message_body?: string;
  response_text?: string;
  agent_id?: string;
  communication_log_id?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class OutreachMetrics {
  total_attempts: number;
  sent: number;
  delivered: number;
  failed: number;
  responded: number;
  appointments: number;
  response_rate: number;
  appointment_rate: number;
}

export class ConversationMessage {
  id: string;
  lead_id: string;
  direction: string;
  channel: string;
  sender_type: string;
  sender_id?: string;
  content: string;
  metadata_json?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class TemplatePreviewRequest {
  body: string;
  channel: string;
}

export class OutreachTriggerRequest {
  campaign_id: string;
  lead_id: string;
}

export interface CampaignPreviewResponse {
  total_leads: number;
  sample_leads: any[];
}

export interface CampaignDashboardMetrics {
  active_campaigns: number;
  total_leads_targeted: number;
  total_contact_attempts: number;
  overall_contact_rate: number;
  overall_response_rate: number;
  by_channel: Record<string, { sent: number; delivered: number; responded: number }>;
  by_campaign: Array<{
    name: string;
    type: string;
    targeted: number;
    sent: number;
    delivered: number;
    responded: number;
  }>;
}

export const CAMPAIGN_TYPE_OPTIONS = [
  { value: 'ai_voice', label: 'AI Voice', icon: 'record_voice_over', description: 'Automated AI voice calls' },
  { value: 'sms', label: 'SMS', icon: 'sms', description: 'Text message outreach' },
  { value: 'email', label: 'Email', icon: 'email', description: 'Email campaigns' },
  { value: 'multi_step', label: 'Multi-Step', icon: 'linear_scale', description: 'Multi-channel sequence' },
];

export const CAMPAIGN_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: '#9e9e9e' },
  { value: 'active', label: 'Active', color: '#4caf50' },
  { value: 'paused', label: 'Paused', color: '#ff9800' },
  { value: 'completed', label: 'Completed', color: '#2196f3' },
  { value: 'archived', label: 'Archived', color: '#f44336' },
];

export const INCIDENT_TYPE_OPTIONS = [
  { value: '', label: 'All Incidents' },
  { value: 'fire', label: 'Fire' },
  { value: 'storm', label: 'Storm' },
  { value: 'hail', label: 'Hail' },
  { value: 'wind', label: 'Wind' },
];

export const TRIGGER_OPTIONS = ['new_lead', 'skip_trace_complete', 'agent_assigned', 'manual'];
