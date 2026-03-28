export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link: string | null;
  notification_type: string;
  is_read: boolean;
  read_at: string | null;
  lead_id: string | null;
  created_at: string;
}

export interface UnreadCountResponse {
  unread_count: number;
}
