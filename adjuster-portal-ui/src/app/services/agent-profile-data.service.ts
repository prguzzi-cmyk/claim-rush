import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * HTTP-backed data source for /v1/agents/*.
 *
 * Same dev-user alias pattern as CommissionEngineDataService — any time a
 * component wants to pass the logged-in user's id to an `/by-user/…` route,
 * it should call `resolveUserId(id)` first so the devAutoLogin stub user
 * (`dev_user`) is swapped for Alice's seeded UUID on the way out.
 */

const DEV_USER_ID = 'dev_user';
// uuid5(NAMESPACE_DNS, 'rin-portal.commission.user.alice_nguyen') — matches seed
const DEV_ALIAS_UUID = 'a88fe7c8-1982-5856-aa70-5efe96ece7c7';

export function resolveAgentUserId(userId: string): string {
  return userId === DEV_USER_ID ? DEV_ALIAS_UUID : userId;
}

// ─── DTO shapes (mirror the FastAPI Pydantic schemas) ────────────────────────

export interface AgentProfileDTO {
  id: string;
  user_id: string;
  agent_number: string;
  user_name: string;
  user_email: string;
  user_role: string;
  is_active: boolean;
  ssn_or_itin_last4: string | null;
  tax_classification: string | null;
  w9_signed_at: string | null;
  w9_file_id: string | null;
  employment_start_date: string | null;
  employment_end_date: string | null;
  termination_reason: string | null;
  background_check_status: string | null;
  background_check_completed_at: string | null;
  drug_test_passed_at: string | null;
  non_compete_signed_at: string | null;
  non_compete_file_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  beneficiary_name: string | null;
  beneficiary_relationship: string | null;
  commission_tier_override: number | null;
  adjuster_comp_type: string | null;
  adjuster_comp_percent: number | null;
  adjuster_annual_salary: number | null;
  adjuster_hourly_rate: number | null;
  adjuster_comp_effective_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AgentLicenseDTO {
  id: string;
  user_id: string;
  state: string;
  license_type: string;
  license_number: string;
  issued_on: string | null;
  expires_on: string | null;
  verified_at: string | null;
  verified_by_id: string | null;
  status: 'ACTIVE' | 'LAPSED' | 'REVOKED' | 'SUSPENDED' | 'PENDING_RENEWAL';
  file_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AgentLicenseCreateRequest {
  state: string;
  license_type: string;
  license_number: string;
  issued_on?: string | null;
  expires_on?: string | null;
  status?: string;
  notes?: string | null;
}

export interface AgentLicenseUpdateRequest {
  state?: string;
  license_type?: string;
  license_number?: string;
  issued_on?: string | null;
  expires_on?: string | null;
  status?: string;
  notes?: string | null;
}

export interface AgentBankingDTO {
  id: string;
  user_id: string;
  payout_method: string | null;
  account_holder_name: string | null;
  bank_name: string | null;
  account_number_last4: string | null;
  routing_number_last4: string | null;
  ach_authorization_signed_at: string | null;
  ach_authorization_file_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AgentDocumentDTO {
  id: string;
  state: string;
  expiration_date: string | null;
  name: string | null;
  type: string | null;
  size: number | null;
}

export interface RoleOption {
  id: string;
  name: string;         // UPPERCASE canonical: AGENT / RVP / CP / ADMIN / ADJUSTER
  display_name: string;
}

export interface AgentWithUserCreateRequest {
  first_name: string;
  last_name: string;
  email: string;
  role_id: string;
  manager_id?: string | null;
  employment_start_date?: string | null;
}

export interface AgentProfileUpdateRequest {
  ssn_or_itin_last4?: string | null;
  tax_classification?: string | null;
  w9_signed_at?: string | null;
  employment_start_date?: string | null;
  employment_end_date?: string | null;
  termination_reason?: string | null;
  background_check_status?: string | null;
  background_check_completed_at?: string | null;
  drug_test_passed_at?: string | null;
  non_compete_signed_at?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  beneficiary_name?: string | null;
  beneficiary_relationship?: string | null;
  commission_tier_override?: number | null;
  adjuster_comp_type?: string | null;
  adjuster_comp_percent?: number | null;
  adjuster_annual_salary?: number | null;
  adjuster_hourly_rate?: number | null;
  adjuster_comp_effective_date?: string | null;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AgentProfileDataService {
  private readonly base = 'agents';

  constructor(private readonly http: HttpClient) {}

  list$(): Observable<AgentProfileDTO[]> {
    return this.http.get<AgentProfileDTO[]>(`${this.base}/`);
  }

  getById$(profileId: string): Observable<AgentProfileDTO> {
    return this.http.get<AgentProfileDTO>(`${this.base}/${profileId}`);
  }

  getByUserId$(userId: string): Observable<AgentProfileDTO> {
    return this.http.get<AgentProfileDTO>(
      `${this.base}/by-user/${resolveAgentUserId(userId)}`,
    );
  }

  getByAgentNumber$(agentNumber: string): Observable<AgentProfileDTO> {
    return this.http.get<AgentProfileDTO>(`${this.base}/by-number/${agentNumber}`);
  }

  update$(profileId: string, payload: AgentProfileUpdateRequest): Observable<AgentProfileDTO> {
    return this.http.patch<AgentProfileDTO>(`${this.base}/${profileId}`, payload);
  }

  delete$(profileId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${profileId}`);
  }

  listCommissionRoles$(): Observable<RoleOption[]> {
    return this.http.get<RoleOption[]>(`${this.base}/meta/roles`);
  }

  createWithUser$(payload: AgentWithUserCreateRequest): Observable<AgentProfileDTO> {
    return this.http.post<AgentProfileDTO>(`${this.base}/with-user`, payload);
  }

  // ─── Licenses ─────────────────────────────────────────────────────────

  listLicenses$(profileId: string): Observable<AgentLicenseDTO[]> {
    return this.http.get<AgentLicenseDTO[]>(`${this.base}/${profileId}/licenses`);
  }

  createLicense$(profileId: string, payload: AgentLicenseCreateRequest): Observable<AgentLicenseDTO> {
    return this.http.post<AgentLicenseDTO>(`${this.base}/${profileId}/licenses`, payload);
  }

  updateLicense$(
    profileId: string,
    licenseId: string,
    payload: AgentLicenseUpdateRequest,
  ): Observable<AgentLicenseDTO> {
    return this.http.patch<AgentLicenseDTO>(
      `${this.base}/${profileId}/licenses/${licenseId}`,
      payload,
    );
  }

  deleteLicense$(profileId: string, licenseId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${profileId}/licenses/${licenseId}`);
  }

  // ─── Banking (read-only) ──────────────────────────────────────────────

  getBanking$(profileId: string): Observable<AgentBankingDTO | null> {
    return this.http.get<AgentBankingDTO | null>(`${this.base}/${profileId}/banking`);
  }

  // ─── Documents (read-only) ────────────────────────────────────────────

  listDocuments$(profileId: string): Observable<AgentDocumentDTO[]> {
    return this.http.get<AgentDocumentDTO[]>(`${this.base}/${profileId}/documents`);
  }
}
