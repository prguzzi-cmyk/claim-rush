import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  RoofAnalysisRecord,
  RoofAnalysisListResponse,
  RoofAnalysisBatchRequest,
  RoofAnalysisBatchResponse,
  RoofAnalysisBatchStatusResponse,
  RoofAnalysisStats,
  RoofAnalysisUpdateRequest,
  ZoneScanRequest,
  ZoneScanResponse,
  ScanQueueStats,
  ScanQueueItem,
} from '../models/roof-intelligence.model';

@Injectable({ providedIn: 'root' })
export class RoofIntelligenceService {
  private readonly basePath = 'roof-analysis';

  constructor(private http: HttpClient) {}

  getAnalyses(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    damage_label?: string;
    state?: string;
    city?: string;
    analysis_mode?: string;
    is_demo?: boolean;
  }): Observable<RoofAnalysisListResponse> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.skip !== undefined) httpParams = httpParams.set('skip', params.skip.toString());
      if (params.limit !== undefined) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.damage_label) httpParams = httpParams.set('damage_label', params.damage_label);
      if (params.state) httpParams = httpParams.set('state', params.state);
      if (params.city) httpParams = httpParams.set('city', params.city);
      if (params.analysis_mode) httpParams = httpParams.set('analysis_mode', params.analysis_mode);
      if (params.is_demo !== undefined) httpParams = httpParams.set('is_demo', params.is_demo.toString());
    }
    return this.http.get<RoofAnalysisListResponse>(this.basePath, { params: httpParams }).pipe(
      map((response) => response)
    );
  }

  /**
   * GET /roof-analysis/opportunities — V1 scored property opportunities
   * generated from real storm event data.
   */
  getOpportunities(params?: {
    date_range?: string;
    state?: string;
    limit?: number;
  }): Observable<{ items: any[]; total: number; scoring_version: string }> {
    let httpParams = new HttpParams();
    if (params?.date_range) httpParams = httpParams.set('date_range', params.date_range);
    if (params?.state) httpParams = httpParams.set('state', params.state);
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this.http.get<{ items: any[]; total: number; scoring_version: string }>(
      `${this.basePath}/opportunities`, { params: httpParams }
    );
  }

  getAnalysisById(id: string): Observable<RoofAnalysisRecord> {
    return this.http.get<RoofAnalysisRecord>(`${this.basePath}/${id}`).pipe(
      map((response) => response)
    );
  }

  getStats(): Observable<RoofAnalysisStats> {
    return this.http.get<RoofAnalysisStats>(`${this.basePath}/stats`).pipe(
      map((response) => response)
    );
  }

  submitBatch(request: RoofAnalysisBatchRequest): Observable<RoofAnalysisBatchResponse> {
    return this.http.post<RoofAnalysisBatchResponse>(`${this.basePath}/batch`, request).pipe(
      map((response) => response)
    );
  }

  getBatchStatus(batchId: string): Observable<RoofAnalysisBatchStatusResponse> {
    return this.http.get<RoofAnalysisBatchStatusResponse>(`${this.basePath}/batch/${batchId}/status`).pipe(
      map((response) => response)
    );
  }

  updateAnalysis(id: string, data: RoofAnalysisUpdateRequest): Observable<RoofAnalysisRecord> {
    return this.http.put<RoofAnalysisRecord>(`${this.basePath}/${id}`, data).pipe(
      map((response) => response)
    );
  }

  // ── Zone Scan / Property Ingestion ──────────────────────────────

  triggerZoneScan(request: ZoneScanRequest): Observable<ZoneScanResponse> {
    return this.http.post<ZoneScanResponse>(`${this.basePath}/zone-scan`, request).pipe(
      map((response) => response)
    );
  }

  getScanQueueStats(zoneId?: string): Observable<ScanQueueStats> {
    let httpParams = new HttpParams();
    if (zoneId) httpParams = httpParams.set('zone_id', zoneId);
    return this.http.get<ScanQueueStats>(`${this.basePath}/scan-queue/stats`, { params: httpParams }).pipe(
      map((response) => response)
    );
  }

  getScanQueue(zoneId: string, skip?: number, limit?: number): Observable<{ items: ScanQueueItem[]; total: number }> {
    let httpParams = new HttpParams().set('zone_id', zoneId);
    if (skip !== undefined) httpParams = httpParams.set('skip', skip.toString());
    if (limit !== undefined) httpParams = httpParams.set('limit', limit.toString());
    return this.http.get<{ items: ScanQueueItem[]; total: number }>(`${this.basePath}/scan-queue`, { params: httpParams }).pipe(
      map((response) => response)
    );
  }
}
