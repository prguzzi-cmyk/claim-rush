import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class CallTypeConfigService {
  constructor(private http: HttpClient) {}

  getCallTypeConfigs(
    pageIndex: number = 1,
    pageSize: number = 50
  ): Observable<any> {
    const params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
    };
    return this.http
      .get<any>('call-type-configs', { params })
      .pipe(map((response) => response));
  }

  getEnabledCallTypes(): Observable<any> {
    return this.http
      .get<any>('call-type-configs/enabled')
      .pipe(map((response) => response));
  }

  updateCallTypeConfig(id: string, data: any): Observable<any> {
    return this.http
      .put<any>(`call-type-configs/${id}`, data)
      .pipe(map((response) => response));
  }
}
