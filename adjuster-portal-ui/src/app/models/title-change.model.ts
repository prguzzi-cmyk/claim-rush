export class TitleChangeTicket {
  id: string;
  type: number;
  status: number;
  owner_id: string;
  current_title_id: number;
  current_title_name: string;
  next_title_id: number;
  next_title_name: string;
  created_at?: string;
  effected_at?: string;
}
