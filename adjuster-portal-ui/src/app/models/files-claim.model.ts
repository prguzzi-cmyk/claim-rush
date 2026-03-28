export class ClaimFile {
  id?: string;
  claim_id?: string;
  name: string;
  description?: string;
  type?: string;
  size?: number;
  path?: string;
  visibility?: string;
  can_be_removed?: boolean = true;

  created_by: {
    first_name: string;
    last_name: string;
  }
  updated_by: {
    first_name: string;
    last_name: string;
  }
  created_at: Date;
  updated_at: Date;

}
