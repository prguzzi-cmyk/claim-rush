export interface DistributeLeadRequest {
  lead_id: string;
  lead_type: string;
  territory_id: string;
}

export interface AssignedAgent {
  agent_id: string;
  agent_name: string;
}

export interface DistributionResult {
  lead_id: string;
  lead_type: string;
  territory_id: string;
  assigned_agents: AssignedAgent[];
  is_exclusive: boolean;
  history_ids: string[];
}

export interface LeadDistributionHistory {
  id: string;
  lead_id: string;
  territory_id: string;
  assigned_agent_id: string;
  lead_type: string;
  distributed_at: string;
  created_at: string;
}

export interface TerritoryRotationState {
  territory_id: string;
  last_assigned_agent_id: string | null;
  rotation_index: number;
}
