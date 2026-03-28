export type ActivityEventType =
  | 'fire_incident' | 'storm_alert' | 'hail_alert' | 'wind_alert'
  | 'lightning_alert' | 'hurricane_alert' | 'lead_assigned' | 'lead_escalated'
  | 'agent_accepted' | 'client_signed' | 'notification_sent' | 'system_alert'
  | 'lead_created' | 'skip_trace_completed' | 'voice_call' | 'claim_opened';

export interface LiveActivityItem {
  id: string;
  eventType: ActivityEventType;
  icon: string;
  label: string;
  sublabel?: string;
  timestamp: Date;
  route?: string;
  entityId?: string;
  entityType?: string;
  latitude?: number;
  longitude?: number;
  state?: string;
  county?: string;
  zip_code?: string;
}
