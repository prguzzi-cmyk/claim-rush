export class LeadComment {
  id?: string;
  lead_id?: string;
  text: string;
  is_removed?: boolean = true;
  can_be_removed?: boolean = true;

  created_by: {
    id?: string;
    first_name?: string;
    last_name?: string;
  }
  updated_by: {
    id?: string;
    first_name: string;
    last_name: string;
  }
  created_at: Date;
  updated_at: Date;

}
