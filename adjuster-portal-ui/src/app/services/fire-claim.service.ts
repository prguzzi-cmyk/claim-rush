import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FireClaim, FireClaimMedia } from '../models/fire-claim.model';
import { EstimateProject } from '../models/estimating.model';

@Injectable({
  providedIn: 'root',
})
export class FireClaimService {
  private readonly basePath = 'fire-claims';

  constructor(private http: HttpClient) {}

  list(page: number = 1, size: number = 25): Observable<any> {
    return this.http
      .get(`${this.basePath}?page=${page}&size=${size}`)
      .pipe(map((response) => response));
  }

  get(id: string): Observable<FireClaim> {
    return this.http
      .get<FireClaim>(`${this.basePath}/${id}`)
      .pipe(map((response) => response));
  }

  create(data: Partial<FireClaim>): Observable<FireClaim> {
    return this.http
      .post<FireClaim>(`${this.basePath}`, data)
      .pipe(map((response) => response));
  }

  update(id: string, data: Partial<FireClaim>): Observable<FireClaim> {
    return this.http
      .put<FireClaim>(`${this.basePath}/${id}`, data)
      .pipe(map((response) => response));
  }

  markComplete(id: string): Observable<FireClaim> {
    return this.http
      .post<FireClaim>(`${this.basePath}/${id}/mark-complete`, {})
      .pipe(map((response) => response));
  }

  uploadMedia(
    claimId: string,
    file: File,
    mediaType: string = 'photo',
    caption: string = ''
  ): Observable<FireClaimMedia> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);
    if (caption) {
      formData.append('caption', caption);
    }
    return this.http
      .post<FireClaimMedia>(`${this.basePath}/${claimId}/media`, formData)
      .pipe(map((response) => response));
  }

  deleteMedia(claimId: string, mediaId: string): Observable<any> {
    return this.http
      .delete(`${this.basePath}/${claimId}/media/${mediaId}`)
      .pipe(map((response) => response));
  }

  analyzeDamage(id: string): Observable<FireClaim> {
    return this.http
      .post<FireClaim>(`${this.basePath}/${id}/analyze`, {})
      .pipe(map((response) => response));
  }

  generateCarrierReport(id: string): Observable<FireClaim> {
    return this.http
      .post<FireClaim>(`${this.basePath}/${id}/carrier-report`, {})
      .pipe(map((response) => response));
  }

  getOrCreateEstimate(id: string): Observable<EstimateProject> {
    return this.http
      .post<EstimateProject>(`${this.basePath}/${id}/estimate`, {})
      .pipe(map((response) => response));
  }
}
