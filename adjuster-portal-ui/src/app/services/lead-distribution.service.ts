import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import {
  DistributeLeadRequest,
  DistributionResult,
  LeadDistributionHistory,
  TerritoryRotationState,
} from '../models/lead-distribution.model';

@Injectable({
  providedIn: 'root',
})
export class LeadDistributionService {
  constructor(private http: HttpClient) {}

  distribute(req: DistributeLeadRequest) {
    return this.http.post<DistributionResult>('lead-distribution/distribute', req).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getHistoryByLead(leadId: string) {
    return this.http.get<LeadDistributionHistory[]>('lead-distribution/history/lead/' + leadId).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getHistoryByTerritory(territoryId: string, leadType?: string) {
    let params = new HttpParams();
    if (leadType) {
      params = params.set('lead_type', leadType);
    }
    return this.http.get<LeadDistributionHistory[]>('lead-distribution/history/territory/' + territoryId, { params }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getRotationState(territoryId: string) {
    return this.http.get<TerritoryRotationState>('lead-distribution/rotation/' + territoryId).pipe(
      map((response) => {
        return response;
      })
    );
  }
}
