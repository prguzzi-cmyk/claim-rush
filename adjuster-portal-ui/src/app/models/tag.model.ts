export class Tag {
  id?: string;
  name: string;
  description: string;
  slug?: string;
  can_be_removed?: boolean = true;
  is_removed?: boolean;
  created_by?: {
    first_name: string;
    last_name: string;
  };
  updated_by?: {
    first_name: string;
    last_name: string;
  };
  created_at?: string;
  updated_at?: string;
}
