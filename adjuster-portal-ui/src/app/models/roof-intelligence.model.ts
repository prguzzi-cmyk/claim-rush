export interface RoofAnalysisRecord {
  id: string;
  property_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  county: string | null;
  latitude: number;
  longitude: number;
  roof_type: string | null;
  roof_age_years: number | null;
  roof_size_sqft: number | null;
  storm_event_id: string | null;
  storm_type: string | null;
  hail_size_inches: number | null;
  wind_speed_mph: number | null;
  damage_score: number;
  damage_label: string;
  confidence: string;
  summary: string | null;
  indicators: string | null;
  analysis_mode: string;
  image_source: string | null;
  image_path: string | null;
  scan_timestamp: string | null;
  claim_range_low: number | null;
  claim_range_high: number | null;
  estimated_claim_value: number | null;
  status: string;
  recommended_action: string | null;
  error_message: string | null;
  owner_name: string | null;
  skip_trace_status: string;
  outreach_status: string;
  adjuster_notes: string | null;
  territory_id: string | null;
  territory_name: string | null;
  batch_id: string | null;
  is_demo: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface RoofAnalysisListResponse {
  items: RoofAnalysisRecord[];
  total: number;
}

export interface RoofAnalysisBatchProperty {
  property_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  roof_type?: string;
  roof_age_years?: number;
  roof_size_sqft?: number;
  county?: string;
  storm_type?: string;
  hail_size_inches?: number;
  wind_speed_mph?: number;
}

export interface RoofAnalysisBatchRequest {
  properties: RoofAnalysisBatchProperty[];
  storm_event_id?: string;
  analysis_mode: string;
}

export interface RoofAnalysisBatchResponse {
  batch_id: string;
  queued: number;
  message: string;
}

export interface RoofAnalysisBatchStatusResponse {
  batch_id: string;
  total: number;
  completed: number;
  in_progress: number;
  queued: number;
  errored: number;
}

export interface RoofAnalysisStats {
  total: number;
  by_status: { [key: string]: number };
  by_damage_label: { [key: string]: number };
  by_analysis_mode: { [key: string]: number };
}

export interface RoofAnalysisUpdateRequest {
  adjuster_notes?: string;
  outreach_status?: string;
  skip_trace_status?: string;
  owner_name?: string;
  recommended_action?: string;
}

// ── Zone Scan / Property Ingestion ──────────────────────────────

export interface ZoneScanRequest {
  zone_id: string;
  center: number[];
  radius_meters: number;
  storm_event_id?: string;
  max_properties?: number;
}

export interface ZoneScanResponse {
  zone_id: string;
  properties_found: number;
  queued_for_scan: number;
  message: string;
}

export interface ScanQueueStats {
  total: number;
  pending: number;
  queued: number;
  scanning: number;
  completed: number;
  errored: number;
}

export interface ScanQueueItem {
  id: string;
  property_id: string;
  address: string | null;
  latitude: number;
  longitude: number;
  zone_id: string;
  scan_status: string;
  source: string;
  roof_analysis_id: string | null;
  building_type: string | null;
  building_area_sqft: number | null;
  created_at: string;
}
