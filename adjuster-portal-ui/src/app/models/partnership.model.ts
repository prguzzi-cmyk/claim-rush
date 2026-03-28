export class Partnership {
  id?: string;
  title: string;
  target: string;
  mission: string;
  key_elements: string;
  search_term: string;
  is_active?: boolean;
  can_be_removed?: boolean;
  is_removed?: boolean;
  created_by?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  updated_by?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  created_at?: Date;
  updated_at?: Date;
}
