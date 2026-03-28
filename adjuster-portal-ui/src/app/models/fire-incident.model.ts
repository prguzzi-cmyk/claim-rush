export interface FireFilterState {
  agencyId: string;
  callType: string;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface FireAgency {
  id: string;
  agency_id: string;
  name: string;
  state: string;
  is_active: boolean;
  last_polled_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DispatchStatus = 'active' | 'cleared' | 'archived';

export interface FireIncident {
  id: string;
  call_type: string;
  call_type_description: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  received_at: string | null;
  units: string | null;
  dispatch_status: DispatchStatus;
  is_active: boolean;
  cleared_at: string | null;
  agency_id: string | null;
  lead_id?: string | null;
  agency?: FireAgency;
  source_display?: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyIntelligence {
  id: string;
  incident_id: string;
  address: string;
  owner_name: string | null;
  phone: string | null;
  phone_type: string | null;
  email: string | null;
  property_value_estimate: string | null;
  mortgage_lender: string | null;
  insurance_probability_score: string | null;
  status: string;
  raw_residents: string | null;
  created_at: string;
  updated_at: string;
}

export interface FireIncidentConvertToLead {
  full_name: string;
  phone_number: string;
  email?: string;
  peril?: string;
  loss_date?: string;
  insurance_company?: string;
  instructions_or_notes?: string;
  assigned_to?: string;
}

export interface SkipTraceResident {
  full_name: string;
  phone_numbers: string[];
  emails: string[];
  age?: string;
}

export interface SkipTraceResponse {
  residents: SkipTraceResident[];
  source: string;
  address_queried: string;
}

export interface FireDataSourceConfig {
  id: string;
  source_type: string;
  name: string;
  endpoint_url: string;
  api_key?: string | null;
  dataset_id?: string | null;
  is_active: boolean;
  poll_interval_seconds: number;
  last_polled_at: string | null;
  extra_config?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FireDataSourceConfigCreate {
  source_type: string;
  name: string;
  endpoint_url: string;
  api_key?: string;
  dataset_id?: string;
  is_active?: boolean;
  poll_interval_seconds?: number;
  extra_config?: string;
}

export interface FireDataSourceConfigUpdate {
  name?: string;
  endpoint_url?: string;
  api_key?: string;
  dataset_id?: string;
  is_active?: boolean;
  poll_interval_seconds?: number;
  extra_config?: string;
}

export interface FireAgencyCreate {
  agency_id: string;
  name: string;
  state?: string;
  is_active?: boolean;
}

export interface FireAgencyUpdate {
  name?: string;
  state?: string;
  is_active?: boolean;
}
