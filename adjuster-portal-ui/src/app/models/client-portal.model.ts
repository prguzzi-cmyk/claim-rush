export type ClaimStage =
  | 'claim_reported'
  | 'inspection_scheduled'
  | 'estimate_submitted'
  | 'carrier_review'
  | 'negotiation'
  | 'payment_issued'
  | 'claim_closed';

export interface ClaimTimelineEvent {
  date: string;
  label: string;
  description: string;
  icon: string;
  completed: boolean;
}

export interface ClientClaim {
  id: string;
  claimNumber: string;
  status: string;
  type: string;
  dateOfLoss: string;
  dateOpened: string;
  adjusterName: string;
  adjusterPhone: string;
  adjusterEmail: string;
  description: string;
  propertyAddress: string;
  city: string;
  state: string;
  zip: string;
  estimatedValue: number;
  currentPhase: string;
  currentStage: ClaimStage;
  timeline: ClaimTimelineEvent[];
}

export interface ClaimDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  size: string;
  url: string;
  category: 'policy' | 'estimate' | 'photo' | 'correspondence' | 'report' | 'supplement';
  uploadedBy: 'client' | 'adjuster' | 'system';
}

export interface ClaimPayment {
  id: string;
  date: string;
  amount: number;
  description: string;
  status: 'pending' | 'processed' | 'denied';
  method: string;
  referenceNumber: string;
  payerName: string;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: 'client' | 'adjuster' | 'system';
  body: string;
  timestamp: string;
}

export interface MessageThread {
  id: string;
  subject: string;
  lastMessageAt: string;
  unread: boolean;
  messages: ChatMessage[];
}

export interface ClaimReport {
  id: string;
  name: string;
  type: 'claim_report' | 'supplement_report' | 'inspection_report' | 'estimate_report';
  generatedAt: string;
  size: string;
  url: string;
}

export interface ClaimNotification {
  id: string;
  title: string;
  message: string;
  type: 'status_change' | 'payment' | 'document' | 'message' | 'appointment';
  timestamp: string;
  read: boolean;
  icon: string;
  relatedStage: ClaimStage | null;
}

export const CLAIM_STAGES: { key: ClaimStage; label: string; icon: string }[] = [
  { key: 'claim_reported',      label: 'Claim Reported',      icon: 'flag' },
  { key: 'inspection_scheduled', label: 'Inspection Scheduled', icon: 'event_available' },
  { key: 'estimate_submitted',  label: 'Estimate Submitted',  icon: 'calculate' },
  { key: 'carrier_review',      label: 'Carrier Review',      icon: 'rate_review' },
  { key: 'negotiation',         label: 'Negotiation',         icon: 'handshake' },
  { key: 'payment_issued',      label: 'Payment Issued',      icon: 'payments' },
  { key: 'claim_closed',        label: 'Claim Closed',        icon: 'check_circle' },
];
