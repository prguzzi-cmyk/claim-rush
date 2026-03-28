export interface AdjusterCase {
  id: string;
  case_number: string;
  status: string;
  current_step: number;
  fire_claim_id?: string;
  estimate_project_id?: string;
  created_by_id: string;
  assigned_pa_id?: string;
  intake_notes?: string;
  intake_loss_date?: string;
  intake_loss_type?: string;
  intake_address?: string;
  intake_insured_name?: string;
  intake_carrier?: string;
  intake_policy_number?: string;
  intake_claim_number?: string;
  scope_notes?: string;
  scope_ai_summary?: string;
  damage_ai_summary?: string;
  pa_approved: boolean;
  pa_approved_at?: string;
  pa_notes?: string;
  final_report_url?: string;
  documents?: AdjusterCaseDocument[];
  policy_analyses?: AdjusterCasePolicyAnalysis[];
  created_at: string;
  updated_at: string;
}

export interface AdjusterCaseDocument {
  id: string;
  case_id: string;
  file_name: string;
  file_key: string;
  file_type: string;
  step: string;
  ai_extracted_text?: string;
  created_at: string;
}

export interface AdjusterCasePolicyAnalysis {
  id: string;
  case_id: string;
  coverage_type: string;
  limit_amount?: number;
  deductible?: number;
  exclusions?: string;
  ai_confidence: number;
  raw_ai_response?: string;
  created_at: string;
}
