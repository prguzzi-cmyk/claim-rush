import { Hyperlink } from "xlsx";

export class Network {
  id?: string;
  title: string;
  environment: string;
  summary: string;
  key_elements: string;
  exploration_type: Hyperlink;
  exploration_term: string;
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
