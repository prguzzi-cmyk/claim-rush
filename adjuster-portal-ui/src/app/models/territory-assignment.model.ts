export type TerritoryType = 'state' | 'county' | 'zip' | 'custom';

export interface TerritoryAssignment {
  id: string;
  user_id: string;
  territory_id: string;
  territory_type: TerritoryType;
  territory_name: string;
  state: string | null;
  county: string | null;
  zip_code: string | null;
  priority: number;
  is_active: boolean;
  user_email: string | null;
  user_role: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TerritoryAssignmentCreate {
  user_id: string;
  territory_type: TerritoryType;
  state: string | null;
  county: string | null;
  zip_code: string | null;
  name: string | null;
  priority: number;
  is_active: boolean;
}

export interface TerritoryAssignmentUpdate {
  priority?: number;
  is_active?: boolean;
}

export const TERRITORY_TYPES: TerritoryType[] = ['state', 'county', 'zip', 'custom'];

// Command center supporting types -------------------------------------------

export interface AssignableUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string | null;
  display_name: string;
}

export interface TerritoryKpi {
  cp_territory_count: number;
  rvp_territory_count: number;
  agent_territory_count: number;
  unassigned_territory_count: number;
  leads_routed_today: number;
  fallback_leads_today: number;
}

export interface CoverageGaps {
  states_without_cp: string[];
  counties_without_owner: { state: string | null; county: string | null }[];
  zips_without_owner: string[];
  fallback_count_today: number;
}

export interface HierarchyOwner {
  user_id: string;
  display_name: string;
  role: string | null;
  priority: number;
}

export interface HierarchyZip {
  territory_id: string;
  zip_code: string;
  owners: HierarchyOwner[];
}

export interface HierarchyCounty {
  territory_id: string | null;
  county: string;
  owners: HierarchyOwner[];
  zips: HierarchyZip[];
}

export interface HierarchyState {
  territory_id: string | null;
  state: string;
  owners: HierarchyOwner[];
  counties: HierarchyCounty[];
}

export interface TestRoutingRequest {
  lead_source: string;
  state: string | null;
  county: string | null;
  zip_code: string | null;
}

export interface TestRoutingResponse {
  routing_mode: string;
  matched_level: string | null;
  matched_value: string | null;
  fallback_used: boolean;
  territory_id: string | null;
  territory_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  assigned_user_role: string | null;
  fallback_owner_id: string | null;
  fallback_owner_name: string | null;
  notes: string;
}

// USPS state codes for the dropdown — covers 50 states + DC.
export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

export const ASSIGNABLE_ROLES = ['cp', 'rvp', 'agent'] as const;
export type AssignableRole = typeof ASSIGNABLE_ROLES[number];
