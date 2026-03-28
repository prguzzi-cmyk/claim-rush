import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import {
  LeadIntakeRecord,
  ManualLeadIntakeRequest,
  ManualLeadIntakeResponse,
} from '../models/lead-intake.model';

@Injectable({ providedIn: 'root' })
export class LeadIntakeService {
  constructor(private http: HttpClient) {}

  getIntakeRecords(
    page = 1,
    size = 25,
    statusFilter = 'all',
    sourceFilter = 'all',
    dateFrom?: string,
    dateTo?: string
  ) {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('status_filter', statusFilter)
      .set('source_filter', sourceFilter);
    if (dateFrom) params = params.set('date_from', dateFrom);
    if (dateTo) params = params.set('date_to', dateTo);
    return this.http
      .get<{ items: LeadIntakeRecord[]; total: number }>('lead-intake', {
        params,
      })
      .pipe(map((response) => response));
  }

  createManualLead(req: ManualLeadIntakeRequest) {
    return this.http
      .post<ManualLeadIntakeResponse>('lead-intake/manual', req)
      .pipe(map((response) => response));
  }
}
