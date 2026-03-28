export class User {
  id: string;
  first_name: string;
  last_name: string;
  password?: string;
  email: string;
  role_id: string;
  manager_id: string;
  manager?: {
    email: string;
    first_name: string;
    last_name: string;
  };
  role?: {
    name: string;
    display_name: string;
    can_be_removed: true;
    id: string;
  };
  permissions?: [
    {
      id: string;
      module: string;
      name: string;
      operation: string;
    }
  ];
  is_active?: boolean;
  operating_mode?: 'neutral' | 'aci' | 'upa';
  is_removed?: boolean;
  can_be_removed?: boolean = true;
  parent_id?: string;
  created_at?: Date;
  updated_at?: Date;
  user_meta?: {
    avatar?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    phone_number?: string;
    phone_number_extension?: string;
  };
  created_by?: {
    first_name: string;
    last_name: string;
  };
  updated_by?: {
    first_name: string;
    last_name: string;
  };
}
