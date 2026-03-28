export interface CrimeIncident {
  id: string;
  data_source: string;
  external_id: string;
  incident_type: string;
  raw_incident_type: string;
  occurred_at: string;
  reported_at: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  county: string;
  latitude: number;
  longitude: number;
  severity: string;
  claim_relevance_score: number;
  estimated_loss: number;
  property_type: string;
  description: string;
  source_freshness: string;
  is_mock: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrimeIncidentListResponse {
  items: CrimeIncident[];
  total: number;
}

export interface CrimeIncidentStats {
  total: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  by_source: Record<string, number>;
}

export interface CrimeDataSourceStatus {
  id: string;
  name: string;
  source_type: string;
  connection_status: string;
  freshness_label: string;
  last_polled_at: string;
  last_record_count: number;
  poll_interval_seconds: number;
  enabled: boolean;
}
