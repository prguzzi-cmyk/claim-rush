export class Permission {
  module: string
  operation: string;
  name: string;
  effect: string;
  can_be_removed?: boolean = true;
  id: string;
  is_removed?: boolean = true;
  created_by?: {
    first_name: string;
    last_name: string
  }
  updated_by?: {
    first_name: string;
    last_name: string;
  }
  created_at?: Date;
  updated_at?: Date;
}
