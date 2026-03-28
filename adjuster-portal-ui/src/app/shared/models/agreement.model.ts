/**
 * E-Sign Agreement Engine Models
 *
 * Digital signing with PDF upload, flexible signature methods,
 * audit trail capture, and Certified Electronic Signature readiness.
 */

export type AgreementSource = 'system' | 'uploaded';
export type SigningMode = 'standard' | 'certified';
export type SignatureMethod = 'draw' | 'type' | 'font' | 'i_agree';
export type AgreementStatus = 'draft' | 'sent' | 'viewed' | 'started' | 'signed' | 'expired' | 'cancelled';

export interface SigningField {
  id: string;
  type: 'signature' | 'initials' | 'date' | 'checkbox' | 'text';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  label?: string;
  value?: string;
  completed?: boolean;
}

export interface Agreement {
  id: string;
  lead_id: string | null;
  agent_id: string | null;
  signer_name: string;
  signer_email: string | null;
  signer_phone: string | null;
  title: string;
  source: AgreementSource;
  original_pdf_url: string | null;
  signed_pdf_url: string | null;
  version: string;
  signing_mode: SigningMode;
  signature_method: SignatureMethod | null;
  status: AgreementStatus;
  sent_at: string | null;
  viewed_at: string | null;
  started_at: string | null;
  signed_at: string | null;
  expires_at: string | null;
  insured_copy_sent: boolean;
  agent_copy_sent: boolean;
  reminder_count: number;
  field_config: SigningField[] | null;
  created_at: string;
  updated_at: string | null;
}

export interface AuditEntry {
  id: string;
  agreement_id: string;
  action: string;
  details: string | null;
  ip_address: string | null;
  device_type: string | null;
  browser: string | null;
  platform: string | null;
  field_id: string | null;
  field_type: string | null;
  signature_method: string | null;
  created_at: string;
}

export interface SignRequest {
  signature_method: SignatureMethod;
  signature_data: string | null;
  font_name: string | null;
  ip_address: string | null;
  device_type: string | null;
  browser: string | null;
  platform: string | null;
  completed_fields: { field_id: string; field_type: string; value: string }[];
}

export interface AgreementMetrics {
  agreements_sent: number;
  agreements_viewed: number;
  agreements_signed: number;
  conversion_rate: number;
  certified_usage: number;
  pending_signatures: number;
  avg_time_to_sign_hours: number | null;
}

export const SIGNATURE_FONTS = [
  { name: 'Dancing Script', label: 'Elegant', cssClass: 'font-dancing' },
  { name: 'Great Vibes', label: 'Classic', cssClass: 'font-vibes' },
  { name: 'Pacifico', label: 'Casual', cssClass: 'font-pacifico' },
  { name: 'Caveat', label: 'Handwritten', cssClass: 'font-caveat' },
];
