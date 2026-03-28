import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MastersService {

  constructor(private http: HttpClient) { }

  getPolicyTypes() {
    return this.http.get<any>('masters/policy-types').pipe(
      map((response) => {
        return response;
      })
    );
  }

  getSubPolicyTypes(policy_type_slug:string) {
    return this.http.get<any>(`masters/policy-types/${policy_type_slug}/sub-policy-types`).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getPolicyType(policy_type_slug: string) {
    return this.http.get<any>('masters/policy-types/${policy_type_slug}').pipe(
      map((response) => {
        return response;
      })
    );
  }

  getCoverageTypes() {
    return this.http.get<any>('masters/coverage-types').pipe(
      map((response) => {
        return response;
      })
    );
  }

  getCoverageType(slug: string) {
    return this.http.get<any>('masters/coverage-types/' + slug).pipe(
      map((response) => {
        return response;
      })
    );
  }
}
