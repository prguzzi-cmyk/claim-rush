import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LeadSkipTrace } from '../models/lead-skip-trace.model';

@Injectable({
  providedIn: 'root',
})
export class SkipTraceService {
  constructor(private http: HttpClient) {}

  getSkipTrace(leadId: string): Observable<LeadSkipTrace> {
    return this.http.get<LeadSkipTrace>('skip-trace-wallet/leads/' + leadId + '/owner-intelligence');
  }

  runSkipTrace(leadId: string): Observable<any> {
    return this.http.post('skip-trace-wallet/leads/' + leadId + '/run', {});
  }
}
