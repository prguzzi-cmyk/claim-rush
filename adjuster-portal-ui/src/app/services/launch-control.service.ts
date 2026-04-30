import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  DeployResponse,
  EnrollRequest,
  EnrollResponse,
  LaunchControlUser,
  LaunchControlUserDetail,
} from '../models/launch-control.model';

@Injectable({ providedIn: 'root' })
export class LaunchControlService {
  private readonly base = 'launch-control';

  constructor(private http: HttpClient) {}

  list(): Observable<LaunchControlUser[]> {
    return this.http.get<LaunchControlUser[]>(`${this.base}/users`);
  }

  get(userId: string): Observable<LaunchControlUserDetail> {
    return this.http.get<LaunchControlUserDetail>(`${this.base}/users/${userId}`);
  }

  deploy(userId: string): Observable<DeployResponse> {
    return this.http.post<DeployResponse>(`${this.base}/users/${userId}/deploy`, {});
  }

  enroll(body: EnrollRequest): Observable<EnrollResponse> {
    return this.http.post<EnrollResponse>(`${this.base}/enroll`, body);
  }

  /** Soft-deactivate a Launch Control user. Sets `is_active = false` so
   *  the user disappears from the active roster without touching their
   *  leads / claims / territory assignments. Idempotent. */
  deactivate(userId: string): Observable<{ user_id: string; is_active: boolean; status: string }> {
    return this.http.post<{ user_id: string; is_active: boolean; status: string }>(
      `${this.base}/users/${userId}/deactivate`, {},
    );
  }
}
