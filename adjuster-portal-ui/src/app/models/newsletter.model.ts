export class Newsletter {
  id?: string;
  title?: string
  content?: string;
  publication_date?: string;
  is_featured?: boolean = false;
  can_be_removed?: boolean = true;
  is_removed?: boolean = true;
  created_at?: Date;
  updated_at?: Date;
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
}
