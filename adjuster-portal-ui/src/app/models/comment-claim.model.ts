export class ClaimComment {
  id?: string;
  claim_id?: string;
  text: string;
  visibility?: string;
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
