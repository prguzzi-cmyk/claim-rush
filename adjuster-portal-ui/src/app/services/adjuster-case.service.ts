import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AdjusterCase, AdjusterCaseDocument, AdjusterCasePolicyAnalysis } from '../models/adjuster-case.model';
import { AssistantActionRequest, AssistantActionResponse } from '../models/policy-document.model';
import { EstimateProject } from '../models/estimating.model';

@Injectable({
  providedIn: 'root',
})
export class AdjusterCaseService {
  private readonly basePath = 'adjuster-cases';

  constructor(private http: HttpClient) {}

  list(page: number = 1, size: number = 25): Observable<any> {
    return this.http
      .get(`${this.basePath}?page=${page}&size=${size}`)
      .pipe(map((response) => response));
  }

  get(id: string): Observable<AdjusterCase> {
    return this.http
      .get<AdjusterCase>(`${this.basePath}/${id}`)
      .pipe(map((response) => response));
  }

  create(data: Partial<AdjusterCase>): Observable<AdjusterCase> {
    return this.http
      .post<AdjusterCase>(`${this.basePath}`, data)
      .pipe(map((response) => response));
  }

  update(id: string, data: Partial<AdjusterCase>): Observable<AdjusterCase> {
    return this.http
      .patch<AdjusterCase>(`${this.basePath}/${id}`, data)
      .pipe(map((response) => response));
  }

  advance(id: string): Observable<AdjusterCase> {
    return this.http
      .post<AdjusterCase>(`${this.basePath}/${id}/advance`, {})
      .pipe(map((response) => response));
  }

  uploadDocument(
    id: string,
    file: File,
    fileType: string = 'other',
    step: string = 'intake'
  ): Observable<AdjusterCaseDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', fileType);
    formData.append('step', step);
    return this.http
      .post<AdjusterCaseDocument>(`${this.basePath}/${id}/documents`, formData)
      .pipe(map((response) => response));
  }

  getDocuments(id: string): Observable<AdjusterCaseDocument[]> {
    return this.http
      .get<AdjusterCaseDocument[]>(`${this.basePath}/${id}/documents`)
      .pipe(map((response) => response));
  }

  deleteDocument(id: string, docId: string): Observable<any> {
    return this.http
      .delete(`${this.basePath}/${id}/documents/${docId}`)
      .pipe(map((response) => response));
  }

  analyzePolicy(id: string): Observable<AdjusterCasePolicyAnalysis[]> {
    return this.http
      .post<AdjusterCasePolicyAnalysis[]>(`${this.basePath}/${id}/analyze-policy`, {})
      .pipe(map((response) => response));
  }

  analyzeDamage(id: string): Observable<any> {
    return this.http
      .post(`${this.basePath}/${id}/analyze-damage`, {})
      .pipe(map((response) => response));
  }

  generateScope(id: string): Observable<AdjusterCase> {
    return this.http
      .post<AdjusterCase>(`${this.basePath}/${id}/generate-scope`, {})
      .pipe(map((response) => response));
  }

  linkEstimate(id: string): Observable<EstimateProject> {
    return this.http
      .post<EstimateProject>(`${this.basePath}/${id}/link-estimate`, {})
      .pipe(map((response) => response));
  }

  paApprove(id: string, notes?: string): Observable<AdjusterCase> {
    return this.http
      .post<AdjusterCase>(`${this.basePath}/${id}/pa-approve`, null, {
        params: notes ? { pa_notes: notes } : {},
      })
      .pipe(map((response) => response));
  }

  generateReport(id: string): Observable<any> {
    return this.http
      .post(`${this.basePath}/${id}/generate-report`, {})
      .pipe(map((response) => response));
  }

  policyAction(id: string, request: AssistantActionRequest): Observable<AssistantActionResponse> {
    return this.http
      .post<AssistantActionResponse>(`${this.basePath}/${id}/policy-action`, request)
      .pipe(map((response) => response));
  }
}
