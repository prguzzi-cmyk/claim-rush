export interface IntakeChatMessage {
  session_id: string | null;
  message: string;
}

export interface IntakeChatResponse {
  success: boolean;
  session_id: string | null;
  ai_message: string;
  current_step: string;
  is_complete: boolean;
  is_qualified: boolean | null;
  collected_data: Record<string, string | null>;
  lead_id: string | null;
  fallback: boolean;
}

export interface IntakeSession {
  id: string;
  homeowner_name: string | null;
  property_address: string | null;
  phone: string | null;
  email: string | null;
  incident_type: string | null;
  date_of_loss: string | null;
  insurance_company: string | null;
  policy_number: string | null;
  status: string;
  current_step: string;
  is_qualified: boolean | null;
  qualification_reason: string | null;
  qualification_score: number | null;
  lead_id: string | null;
  conversation_log: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface IntakeAppointment {
  id: string;
  appointment_type: string;
  scheduled_at: string | null;
  homeowner_name: string | null;
  homeowner_email: string | null;
  homeowner_phone: string | null;
  property_address: string | null;
  notes: string | null;
  status: string;
  session_id: string | null;
  assigned_to: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface IntakeDashboardMetrics {
  conversations_started: number;
  completed_intakes: number;
  appointments_booked: number;
  clients_signed: number;
  qualification_rate: number;
  avg_qualification_score: number;
}
