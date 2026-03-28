export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  role?: {
    name: string;
    display_name: string;
  };
}
