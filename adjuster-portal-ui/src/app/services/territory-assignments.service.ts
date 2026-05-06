import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AssignableUser,
  CoverageGaps,
  HierarchyState,
  TerritoryAssignment,
  TerritoryAssignmentCreate,
  TerritoryAssignmentUpdate,
  TerritoryKpi,
  TestRoutingRequest,
  TestRoutingResponse,
} from '../models/territory-assignment.model';

@Injectable({ providedIn: 'root' })
export class TerritoryAssignmentsService {
  private readonly base = 'territory-assignments';

  constructor(private http: HttpClient) {}

  list(): Observable<TerritoryAssignment[]> {
    return this.http.get<TerritoryAssignment[]>(this.base);
  }

  myTerritories(): Observable<TerritoryAssignment[]> {
    return this.http.get<TerritoryAssignment[]>(`${this.base}/my-territories`);
  }

  create(body: TerritoryAssignmentCreate): Observable<TerritoryAssignment> {
    return this.http.post<TerritoryAssignment>(this.base, body);
  }

  update(id: string, body: TerritoryAssignmentUpdate): Observable<TerritoryAssignment> {
    return this.http.patch<TerritoryAssignment>(`${this.base}/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  // Command Center reads ----------------------------------------------------

  listUsers(role?: string): Observable<AssignableUser[]> {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    return this.http.get<AssignableUser[]>(`${this.base}/users`, { params });
  }

  kpi(): Observable<TerritoryKpi> {
    return this.http.get<TerritoryKpi>(`${this.base}/kpi`);
  }

  coverageGaps(): Observable<CoverageGaps> {
    return this.http.get<CoverageGaps>(`${this.base}/coverage-gaps`);
  }

  hierarchy(): Observable<HierarchyState[]> {
    return this.http.get<HierarchyState[]>(`${this.base}/hierarchy`);
  }

  testRouting(body: TestRoutingRequest): Observable<TestRoutingResponse> {
    return this.http.post<TestRoutingResponse>(`${this.base}/test-routing`, body);
  }
}
