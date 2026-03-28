import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CommunicationLogItem {
  id: string;
  lead_id: string | null;
  lead_address: string | null;
  channel: string;
  direction: string;
  purpose: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  body_preview: string | null;
  send_status: string;
  sent_at: string | null;
  created_at: string | null;
}

export interface CommunicationLogsResponse {
  items: CommunicationLogItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

@Injectable({
  providedIn: 'root',
})
export class CommunicationHubService {
  constructor(private http: HttpClient) {}

  getLogs(params: {
    channel?: string;
    direction?: string;
    page?: number;
    size?: number;
  } = {}): Observable<CommunicationLogsResponse> {
    const queryParams: any = {};
    if (params.channel) queryParams['channel'] = params.channel;
    if (params.direction) queryParams['direction'] = params.direction;
    if (params.page) queryParams['page'] = params.page.toString();
    if (params.size) queryParams['size'] = params.size.toString();

    return this.http.get<CommunicationLogsResponse>('communications/logs', { params: queryParams }).pipe(
      map((response) => response)
    );
  }
}
