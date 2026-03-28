export class Followup {
  id: string
  type?: string;
  dated?: string;
  note?: string;
  next_date?: string;
  can_be_removed: boolean;
  is_removed: boolean;

  created_by: {
    first_name: string;
    last_name: string
  };
  updated_by: {
    first_name: string;
    last_name: string
  }
  created_at: Date;
  updated_at: Date;
}
