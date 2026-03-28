export class Role {
  name: string
  display_name: string;
  can_be_removed?: boolean = true;
  id: string;
  is_removed?: boolean = true;
  created_at?: Date;
  updated_at?: Date;
}
