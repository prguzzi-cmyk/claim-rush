export type EstimateMode = 'residential' | 'commercial' | 'restoration' | 'contents' | 'supplement';

export interface EstimateModeConfig {
  label: string;
  description: string;
  icon: string;
  room_types: string[];
  line_item_categories: string[];
  unit_options: string[];
  default_view?: string;
}

export interface LinkedFireClaim {
  id: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  status?: string;
  insured_name?: string;
  claim_number?: string;
  carrier_name?: string;
  policy_number?: string;
  carrier_adjuster_email?: string;
}

export interface EstimateProject {
  id?: string;
  name: string;
  status: string;
  estimate_mode?: EstimateMode;
  total_cost?: number;
  notes?: string;
  claim_id?: string;
  pricing_version_id?: string;
  pricing_region?: string;
  rooms?: EstimateRoom[];
  photos?: EstimatePhoto[];
  fire_claim?: LinkedFireClaim;
  created_at?: string;
  updated_at?: string;
}

export interface EstimateRoom {
  id?: string;
  name: string;
  room_type?: string;
  floor_level?: string;
  notes?: string;
  project_id?: string;
  line_items?: EstimateLineItem[];
  measurements?: EstimateMeasurement[];
  photos?: EstimatePhoto[];
}

export interface EstimateLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_cost?: number;
  material_cost?: number;
  labor_cost?: number;
  total_cost?: number;
  notes?: string;
  room_id?: string;
  pricing_item_id?: string;
  pricing_code?: string;
  pricing_version_id?: string;
  status?: string;    // 'approved' | 'suggested'
  source?: string;    // 'user' | 'ai'
  confidence?: number; // 0.0 - 1.0
  category?: string;
}

export interface PricingVersion {
  id?: string;
  source: string;
  version_label: string;
  effective_date: string;
  region: string;
  status: string;
  item_count: number;
  notes?: string;
  imported_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EstimateMeasurement {
  id?: string;
  length?: number;
  width?: number;
  height?: number;
  square_feet?: number;
  notes?: string;
  room_id?: string;
}

export interface EstimatePhoto {
  id?: string;
  image_url?: string;
  caption?: string;
  ai_tags?: string;
  photo_type?: string;
  project_id?: string;
  room_id?: string;
  created_at?: string;
}
