export interface PublicTerritory {
  name: string;
  territory_type: string;
  state: string | null;
  county: string | null;
  zip_code: string | null;
  custom_geometry: string | null;
  status: 'available' | 'cp_assigned' | 'full' | 'locked';
  chapter_president_name: string | null;
  adjuster_count: number;
  max_adjusters: number;
  slots_remaining: number;
}
