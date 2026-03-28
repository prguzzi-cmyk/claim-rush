export interface PolicyClause {
  id: string;
  policy_document_id: string;
  clause_type: string;
  title: string;
  summary?: string;
  raw_text?: string;
  amount?: number;
  percentage?: number;
  section_reference?: string;
  applies_to?: string;
  ai_confidence: number;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export interface AssistantActionRequest {
  action_type: string;
  claim_context?: string;
}

export interface AssistantActionResponse {
  action_type: string;
  result_text: string;
  clauses_referenced: string[];
}

export interface PolicyIntelligence {
  id: string;
  policy_document_id: string;
  carrier?: string;
  insured_name?: string;
  policy_number?: string;
  coverage_a_dwelling?: number;
  coverage_b_other_structures?: number;
  coverage_c_personal_property?: number;
  coverage_d_loss_of_use?: number;
  coverage_e_liability?: number;
  coverage_f_medical?: number;
  other_coverage_json?: string;
  deductible_amount?: number;
  deductible_percentage?: number;
  deductible_wind_hail?: number;
  deductible_hurricane?: number;
  deductible_details?: string;
  endorsements_json?: string;
  exclusions_json?: string;
  replacement_cost_language?: string;
  ordinance_and_law?: string;
  matching_language?: string;
  loss_settlement_clause?: string;
  appraisal_clause?: string;
  duties_after_loss?: string;
  ale_loss_of_use_details?: string;
  deadline_notice_details?: string;
  ai_summary?: string;
  confidence_score?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PolicyDocument {
  id: string;
  file_name: string;
  file_key: string;
  file_size?: number;
  content_type: string;
  insured_name?: string;
  carrier?: string;
  policy_number?: string;
  claim_number?: string;
  policy_type?: string;
  effective_date?: string;
  expiration_date?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  ai_extracted_text?: string;
  ai_metadata_json?: string;
  extraction_status: string;
  ai_summary?: string;
  assistant_ready: boolean;
  claim_guidance_notes?: string;
  clauses: PolicyClause[];
  intelligence?: PolicyIntelligence | null;
  notes?: string;
  parent_id?: string;
  version: number;
  claim_id?: string;
  client_id?: string;
  lead_id?: string;
  fire_claim_id?: string;
  adjuster_case_id?: string;
  is_removed: boolean;
  can_be_removed: boolean;
  created_by_id?: string;
  updated_by_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface PolicyDocumentSearch {
  carrier?: string;
  policy_number?: string;
  insured_name?: string;
  policy_type?: string;
  property_state?: string;
  claim_id?: string;
  client_id?: string;
  lead_id?: string;
  fire_claim_id?: string;
  adjuster_case_id?: string;
  effective_after?: string;
  effective_before?: string;
}

export type AnalysisStepStatus = 'waiting' | 'active' | 'complete' | 'error';

export interface AnalysisStep {
  id: string;
  label: string;
  status: AnalysisStepStatus;
  icon: string;
  detail?: string;
}

export interface AnalysisPipelineState {
  isRunning: boolean;
  currentStepIndex: number;
  steps: AnalysisStep[];
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  helperMessage: string;
}

// Gap Analysis placeholder (future feature)
export interface GapAnalysisResult {
  id: string;
  policy_document_id: string;
  estimate_document_id?: string;
  coverage_gaps: GapItem[];
  total_gap_amount?: number;
  status: 'pending' | 'complete' | 'error';
}

export interface GapItem {
  category: string;
  policy_amount?: number;
  estimate_amount?: number;
  difference?: number;
  notes?: string;
  severity: 'info' | 'warning' | 'critical';
}
