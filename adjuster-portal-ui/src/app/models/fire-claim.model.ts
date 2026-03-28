export class FireClaim {
  id?: string;
  claim_number?: string;
  loss_date?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  insured_name?: string;
  insured_phone?: string;
  insured_email?: string;
  carrier_name?: string;
  policy_number?: string;
  carrier_adjuster_email?: string;
  origin_area?: string;
  origin_area_other?: string;
  rooms_affected?: string;
  smoke_level?: string;
  water_from_suppression?: boolean;
  roof_opened_by_firefighters?: boolean;
  power_shut_off?: boolean;
  notes?: string;
  status?: string;
  ai_analysis?: string;
  ai_analysis_at?: string;
  carrier_report?: string;
  carrier_report_at?: string;
  estimate_project_id?: string;
  media?: FireClaimMedia[];
  created_by_id?: string;
  updated_by_id?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class FireClaimMedia {
  id?: string;
  fire_claim_id?: string;
  media_type?: string;
  storage_key?: string;
  file_url?: string;
  caption?: string;
  created_at?: Date;
  updated_at?: Date;
}

export const CLAIM_INTELLIGENCE_NAME = 'Claim Intelligence Engine\u2122';

export const ORIGIN_AREAS = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'living_room', label: 'Living Room' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'garage', label: 'Garage' },
  { value: 'attic', label: 'Attic' },
  { value: 'basement', label: 'Basement' },
  { value: 'exterior', label: 'Exterior' },
  { value: 'other', label: 'Other' },
];

export const SMOKE_LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'severe', label: 'Severe' },
];
