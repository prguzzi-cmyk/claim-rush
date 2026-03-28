export class Territory {
  id: string;
  name: string;
  territory_type: string;
  state?: string;
  county?: string;
  zip_code?: string;
  custom_geometry?: string;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
  lead_fire_enabled?: boolean;
  lead_hail_enabled?: boolean;
  lead_storm_enabled?: boolean;
  lead_lightning_enabled?: boolean;
  lead_flood_enabled?: boolean;
  lead_theft_vandalism_enabled?: boolean;
}

export interface TerritoryGroupedByState {
  state: string;
  counties: Territory[];
}

export interface UserTerritoryInfo {
  national_access: boolean;
  territories: Territory[];
}

export interface UserBrief {
  user_id: string;
  first_name: string;
  last_name: string;
}

export interface TerritoryWithAssignments extends Territory {
  assigned_users?: UserBrief[];
  chapter_president?: UserBrief | null;
  adjusters?: UserBrief[];
  adjuster_count?: number;
  max_adjusters?: number;
  territory_status?: 'Available' | 'CP Assigned' | 'Full' | 'Locked';
}
