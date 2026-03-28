import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  PredictedClaimEvent,
  PredictedClaimZone,
  ClaimTickerMessage,
} from '../models/potential-claims.model';

@Injectable({ providedIn: 'root' })
export class PotentialClaimsService {
  private readonly basePath = 'potential-claims';

  constructor(private http: HttpClient) {}

  getEvents(hours?: number, minProbability?: number): Observable<PredictedClaimEvent[]> {
    let params = new HttpParams();
    if (hours !== undefined) params = params.set('hours', hours.toString());
    if (minProbability !== undefined) params = params.set('min_probability', minProbability.toString());
    return this.http.get<PredictedClaimEvent[]>(`${this.basePath}/events`, { params }).pipe(
      map(events => events.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })))
    );
  }

  getZones(hours?: number): Observable<PredictedClaimZone[]> {
    let params = new HttpParams();
    if (hours !== undefined) params = params.set('hours', hours.toString());
    return this.http.get<PredictedClaimZone[]>(`${this.basePath}/zones`, { params }).pipe(
      map(zones => zones.map(z => ({
        ...z,
        timestamp: new Date(z.timestamp),
      })))
    );
  }

  getTicker(hours?: number, limit?: number): Observable<ClaimTickerMessage[]> {
    let params = new HttpParams();
    if (hours !== undefined) params = params.set('hours', hours.toString());
    if (limit !== undefined) params = params.set('limit', limit.toString());
    return this.http.get<ClaimTickerMessage[]>(`${this.basePath}/ticker`, { params }).pipe(
      map(msgs => msgs.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })))
    );
  }
}
