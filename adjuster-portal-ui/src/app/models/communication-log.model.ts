export interface CommunicationLog {
  id: string;
  lead_id: string | null;
  agent_id: string | null;
  channel: string;
  purpose: string;
  direction: string;
  template_type: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  provider_message_id: string | null;
  subject: string | null;
  body_preview: string | null;
  send_status: string;
  failure_reason: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  unsubscribed_at: string | null;
  is_queued_for_quiet_hours: boolean;
  scheduled_send_at: string | null;
  is_manual_override: boolean;
  created_at: string;
  updated_at: string | null;
  lead?: {
    id: string;
    ref_string?: string;
    contact?: {
      full_name?: string;
      phone_number?: string;
      email?: string;
    };
  };
  agent?: {
    first_name: string;
    last_name: string;
  };
}

export interface CommunicationMetrics {
  total_attempted: number;
  total_sent: number;
  total_delivered: number;
  total_bounced: number;
  total_opened: number;
  total_clicked: number;
  total_failed: number;
  open_rate: number;
  click_rate: number;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  channel: string;
  subject: string | null;
  body: string;
  is_active: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface VoiceScript {
  id: string;
  name: string;
  description: string | null;
  category: string;
  script_text: string;
  greeting: string;
  closing: string;
  objection_handling: string | null;
  is_active: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface DashboardMetrics {
  messages_sent_today: number;
  calls_placed_today: number;
  response_rate: number;
  appointments_created: number;
}

export interface SendRequest {
  lead_ids: string[];
  template_id?: string;
  message?: string;
  subject?: string;
}

export interface VoiceCallRequest {
  lead_ids: string[];
  script_id?: string;
  notes?: string;
}
