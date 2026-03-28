export class Client {
  id: string;
  belongs_to?: string;
  ref_string?: string;
  full_name?: string;
  full_name_alt?: string;
  email?: string;
  email_alt?: string;
  phone_number?: string;
  phone_number_alt?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  is_active?: boolean;
  is_removed?: boolean;
  can_be_removed?: boolean = true;
  organization?: string;
  belonged_user?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    };
  created_by?: {
    first_name: string;
    last_name: string;
  };
  updated_by?: {
    first_name: string;
    last_name: string;
  };
  created_at?: Date;
  updated_at?: Date;
}



