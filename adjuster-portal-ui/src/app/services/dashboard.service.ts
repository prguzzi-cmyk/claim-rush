import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  constructor(
    private http: HttpClient
  ) { }

  getLeadsByStatus(data: any = null) {
    if(data) {

    }

    return this.http.get<any>('dashboard/leads-count-by-status?period_type=current-year')
    .pipe(map(response => {
      return response;
    }));
  }

  getLeadsBySource(data: any = null) {
    if(data) {

    }

    return this.http.get<any>('dashboard/leads-count-by-source?period_type=current-year')
    .pipe(map(response => {
      return response;
    }));
  }

  getLeadsByUser(data: any = null) {
    if(data) {

    }

    return this.http.get<any>('dashboard/leads-count-by-assigned-user?period_type=current-year')
    .pipe(map(response => {
      return response;
    }));
  }

  getClaimsCountByPhase(data: any = null) {
    if(data) {

    }

    return this.http.get<any>('dashboard/claims-count-by-current-phase?period_type=current-year')
    .pipe(map(response => {
      return response;
    }));
  }

  getUserCountByRole(data: any = null) {
    if(data) {

    }

    return this.http.get<any>('dashboard/users-count-by-role?period_type=current-year')
    .pipe(map(response => {
      return response;
    }));
  }

  getFireIncidentsCount(dateFrom: string, callType?: string) {
    const params: any = { page: '1', size: '1', date_from: dateFrom };
    if (callType) params.call_type = callType;
    return this.http.get<any>('fire-incidents', { params }).pipe(map(response => response));
  }

  getRecentFireIncidents(page: number = 1, size: number = 500, dateFrom?: string, callType?: string) {
    const params: any = { page: page.toString(), size: size.toString() };
    if (dateFrom) params.date_from = dateFrom;
    if (callType) params.call_type = callType;
    return this.http.get<any>('fire-incidents', { params }).pipe(map(response => response));
  }

  getAgentPerformance(periodType: string = 'current-year', filters?: { agent_id?: string; state?: string; county?: string }) {
    let params: any = { period_type: periodType };
    if (filters?.agent_id) params.agent_id = filters.agent_id;
    if (filters?.state) params.state = filters.state;
    if (filters?.county) params.county = filters.county;
    return this.http.get<any>('dashboard/agent-performance', { params })
      .pipe(map(response => response));
  }

  getLeadOutcomeBreakdown(periodType: string = 'current-year', filters?: { agent_id?: string; state?: string; county?: string }) {
    let params: any = { period_type: periodType };
    if (filters?.agent_id) params.agent_id = filters.agent_id;
    if (filters?.state) params.state = filters.state;
    if (filters?.county) params.county = filters.county;
    return this.http.get<any>('dashboard/lead-outcome-breakdown', { params })
      .pipe(map(response => response));
  }

  getCommunicationMetrics(periodType: string = 'current-year') {
    return this.http.get<any>('dashboard/communication-metrics?period_type=' + periodType)
      .pipe(map(response => response));
  }

  getAgentOutcomeBreakdown(periodType: string = 'current-year', filters?: { agent_id?: string; state?: string; county?: string }) {
    let params: any = { period_type: periodType };
    if (filters?.agent_id) params.agent_id = filters.agent_id;
    if (filters?.state) params.state = filters.state;
    if (filters?.county) params.county = filters.county;
    return this.http.get<any>('dashboard/agent-outcome-breakdown', { params })
      .pipe(map(response => response));
  }

  getClientConversionStats(periodType: string = 'current-year') {
    return this.http.get<any>('dashboard/client-conversion-stats?period_type=' + periodType)
      .pipe(map(response => response));
  }

  /** Fetch active AI voice call count from the voice campaign engine. */
  getActiveVoiceCallCount() {
    return this.http.get<any>('voice-campaigns/active-call-count').pipe(
      map(response => response?.count ?? 0)
    );
  }
}
