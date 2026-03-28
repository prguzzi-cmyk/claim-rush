export class ClaimTask {
  id?: string;
  claim_id?: string;
  title?: string;
  description?: string;
  priority?: string;
  task_type?: string;
  status?: string;
  related_claim_phase?: string;
  due_date?: string;
  start_date?: Date;
  completion_date?: Date;
  assignee_id?: string;
  can_be_removed?: boolean = true;
  is_active?: boolean = true;
  is_removed?: boolean = true;
  created_at?: Date;
  updated_at?: Date;
  created_by?: {
    id?: string;
    first_name?: string;
    last_name?: string;
  };
  updated_by?: {
    id?: string;
    first_name?: string;
    last_name?: string;
  };
}
