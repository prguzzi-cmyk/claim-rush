import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AssistantActionRequest,
  AssistantActionResponse,
  PolicyClause,
  PolicyDocument,
  PolicyDocumentSearch,
} from '../models/policy-document.model';

@Injectable({
  providedIn: 'root',
})
export class PolicyDocumentService {
  private readonly basePath = 'policy-documents';

  constructor(private http: HttpClient) {}

  list(page: number = 1, size: number = 25, filters?: PolicyDocumentSearch): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params = params.set(key, value);
        }
      });
    }

    return this.http
      .get(`${this.basePath}`, { params })
      .pipe(map((response) => response));
  }

  get(id: string): Observable<PolicyDocument> {
    return this.http
      .get<PolicyDocument>(`${this.basePath}/${id}`)
      .pipe(map((response) => response));
  }

  upload(file: File, metadata?: Partial<PolicyDocument>): Observable<PolicyDocument> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value.toString());
        }
      });
    }
    return this.http
      .post<PolicyDocument>(`${this.basePath}`, formData)
      .pipe(map((response) => response));
  }

  update(id: string, data: Partial<PolicyDocument>): Observable<PolicyDocument> {
    return this.http
      .patch<PolicyDocument>(`${this.basePath}/${id}`, data)
      .pipe(map((response) => response));
  }

  remove(id: string): Observable<any> {
    return this.http
      .delete(`${this.basePath}/${id}`)
      .pipe(map((response) => response));
  }

  getVersions(id: string): Observable<PolicyDocument[]> {
    return this.http
      .get<PolicyDocument[]>(`${this.basePath}/${id}/versions`)
      .pipe(map((response) => response));
  }

  uploadNewVersion(id: string, file: File): Observable<PolicyDocument> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<PolicyDocument>(`${this.basePath}/${id}/new-version`, formData)
      .pipe(map((response) => response));
  }

  extractMetadata(id: string): Observable<PolicyDocument> {
    return this.http
      .post<PolicyDocument>(`${this.basePath}/${id}/extract-metadata`, {})
      .pipe(map((response) => response));
  }

  extractClauses(id: string): Observable<PolicyClause[]> {
    return this.http
      .post<PolicyClause[]>(`${this.basePath}/${id}/extract-clauses`, {})
      .pipe(map((response) => response));
  }

  getClauses(id: string, type?: string): Observable<PolicyClause[]> {
    let params = new HttpParams();
    if (type) {
      params = params.set('type', type);
    }
    return this.http
      .get<PolicyClause[]>(`${this.basePath}/${id}/clauses`, { params })
      .pipe(map((response) => response));
  }

  summarize(id: string): Observable<PolicyDocument> {
    return this.http
      .post<PolicyDocument>(`${this.basePath}/${id}/summarize`, {})
      .pipe(map((response) => response));
  }

  assistantAction(id: string, request: AssistantActionRequest): Observable<AssistantActionResponse> {
    return this.http
      .post<AssistantActionResponse>(`${this.basePath}/${id}/assistant-action`, request)
      .pipe(map((response) => response));
  }

  attach(policyDocumentId: string, entityIds: {
    claim_id?: string;
    client_id?: string;
    lead_id?: string;
    fire_claim_id?: string;
    adjuster_case_id?: string;
  }): Observable<PolicyDocument> {
    return this.http
      .post<PolicyDocument>(`${this.basePath}/attach`, {
        policy_document_id: policyDocumentId,
        ...entityIds,
      })
      .pipe(map((response) => response));
  }

  getByEntity(entityIds: {
    claim_id?: string;
    client_id?: string;
    lead_id?: string;
    fire_claim_id?: string;
    adjuster_case_id?: string;
  }): Observable<PolicyDocument[]> {
    let params = new HttpParams();
    Object.entries(entityIds).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });
    return this.http
      .get<PolicyDocument[]>(`${this.basePath}/by-entity`, { params })
      .pipe(map((response) => response));
  }

  detach(id: string, entityType: string): Observable<PolicyDocument> {
    let params = new HttpParams().set(entityType, 'true');
    return this.http
      .post<PolicyDocument>(`${this.basePath}/${id}/detach`, {}, { params })
      .pipe(map((response) => response));
  }

  importFromClaimFile(claimFileId: string, fireClaimId: string): Observable<PolicyDocument> {
    return this.http
      .post<PolicyDocument>(`${this.basePath}/from-claim-file`, {
        claim_file_id: claimFileId,
        fire_claim_id: fireClaimId,
      })
      .pipe(map((response) => response));
  }
}
