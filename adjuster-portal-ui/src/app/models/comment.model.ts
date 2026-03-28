export class Comment {
  id: string;
  lead_id?: string;
  client_id?: string;
  title: string;
  description?: string;
  can_be_removed?: boolean = true;
  is_removed?: boolean = true;
  created_at?: Date;
  updated_at?: Date;
}
