export class ClaimCommunication {
  id?: string;
  claim_id?: string;
  sender_id?: string;
  message_type: string; // "carrier", "client", "internal"
  subject?: string;
  body: string;
  recipient_email?: string;
  recipient_name?: string;
  direction: string; // "inbound", "outbound"
  channel: string; // "email", "portal", "note", "system"
  thread_id?: string;
  is_system_generated?: boolean;
  attachments_json?: string;
  can_be_removed?: boolean;
  is_removed?: boolean;

  sender?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };

  created_at: Date;
  updated_at: Date;
  created_by?: {
    id?: string;
    first_name?: string;
    last_name?: string;
  };
}

export const MESSAGE_TYPE_LABELS: Record<string, string> = {
  carrier: 'Carrier Message',
  client: 'Client Message',
  internal: 'Internal Note',
};

export const MESSAGE_TYPE_COLORS: Record<string, string> = {
  carrier: '#1565C0',
  client: '#2E7D32',
  internal: '#E65100',
};

export const MESSAGE_TYPE_ICONS: Record<string, string> = {
  carrier: 'business',
  client: 'person',
  internal: 'lock',
};
