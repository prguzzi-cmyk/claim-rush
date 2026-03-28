export class Announcement {
  id?: string;
  title?: string
  content?: string;
  announcement_date?: string;
  expiration_date?: string;
  can_be_removed?: boolean = true;
  created_at?: Date;
  updated_at?: Date;
  announcement_activities?: [{
    user_id?: string;
    timestamp? : string;
    activity_type? : string;
    details?: string;
    id?: string;

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

  }];
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
