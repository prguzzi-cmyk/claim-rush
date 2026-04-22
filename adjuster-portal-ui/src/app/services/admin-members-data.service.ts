import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * HTTP-backed data source for the existing-member regularization
 * onboarding flow (R1). Mirrors /v1/admin/members on the backend.
 */

export type MemberStatus = 'pending_charter' | 'pending_w9' | 'active';
export type InviteRole = 'cp' | 'rvp' | 'agent';

export interface MemberRowDTO {
  user_id: string;
  full_name: string;
  email: string;
  role: string;            // lowercase canonical (cp|rvp|agent|admin|adjuster)
  status: MemberStatus;
  charter_agreement_id: string | null;
  charter_signed_at: string | null;
  w9_uploaded: boolean;
  w9_file_id: string | null;
  created_at: string;
}

export interface InviteMemberRequest {
  email: string;
  full_name: string;
  role: InviteRole;
  territory_id?: string | null;
}

export interface InviteMemberResponse {
  user_id: string;
  agreement_id: string;
  signing_url: string;
  status: MemberStatus;
  invite_email_logged: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminMembersDataService {
  private readonly base = 'admin/members';

  constructor(private readonly http: HttpClient) {}

  list$(): Observable<MemberRowDTO[]> {
    return this.http.get<MemberRowDTO[]>(`${this.base}`);
  }

  invite$(payload: InviteMemberRequest): Observable<InviteMemberResponse> {
    return this.http.post<InviteMemberResponse>(`${this.base}/invite`, payload);
  }

  resendInvite$(userId: string): Observable<{ resent: boolean; agreement_id: string; signing_url: string }> {
    return this.http.post<{ resent: boolean; agreement_id: string; signing_url: string }>(
      `${this.base}/${userId}/resend-invite`, {},
    );
  }

  markW9Received$(userId: string): Observable<{ user_id: string; status: MemberStatus }> {
    return this.http.patch<{ user_id: string; status: MemberStatus }>(
      `${this.base}/${userId}/mark-w9-received`, {},
    );
  }
}
