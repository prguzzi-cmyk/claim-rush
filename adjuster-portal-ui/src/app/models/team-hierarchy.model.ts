export class TeamHierarchy {
  id: bigint;
  node_uid: string;
  recruiter_uid: string;
  first_name: string;
  last_name: string;
  is_active?: boolean;
  is_removed?: boolean;
  can_be_removed?: boolean = true;
  created_at?: Date;
  updated_at?: Date;
  created_by?: {
    first_name: string;
    last_name: string;
  };
  updated_by?: {
    first_name: string;
    last_name: string;
  };
}
