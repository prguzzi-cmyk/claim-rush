import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Policy } from '../models/policy.model';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  constructor(
    private http: HttpClient,
  ) { }

  getPermissions(pageIndex: number = 1, pageSize: number = 1000) {

    let params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
    };


    return this.http.get<any>('permissions', {params})
    .pipe(map(response => {
      return response;
    }));
  }

  getUserPermissions(user_id: string) {
    return this.http.get<any>(`users/${user_id}/permissions?page=1&size=1000`)
    .pipe(map(response => {
      return response;
    }));
  }

  getRolePermissions(role_id: string) {
    return this.http.get<any>(`roles/${role_id}/permissions?page=1&size=1000`)
    .pipe(map(response => {
      return response;
    }));
  }

  addPermission(permission) {
    return this.http.post("permissions", permission);
  }

  updatePermission(permission) {
    return this.http.put("permissions/" + permission.id, { ...permission }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deletePermission(id: string) {
    return this.http.delete<any>("permissions/" + id).pipe(
      map((response) => {
        return response;
      })
    );
  }

  detachRolePermission(role_id: string, data: any) {
    return this.http.post<any>(`roles/${role_id}/detach-permissions` , { ...data }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getUserPolicy(user_id: string) {
    return this.http.get<any>(`users/${user_id}/policies?page=1&size=1000`)
    .pipe(map(response => {
      return response;
    }));
  }

  getPolicies(pageIndex: number = 1, pageSize: number = 10) {

    let params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
    };

    return this.http.get<any>(`users/policies/listing` , {params})
    .pipe(map(response => {
      return response;
    }));
  }

  addRolePermissions(role_id: string, data: any) {
    return this.http.post(`roles/${role_id}/append-permissions`, { ...data });
  }

  addPolicies(user_id: string, policy: Policy) {
    return this.http.post(`users/${user_id}/policies`, { ...policy });
  }

  deletePolicy(policy_id: string) {
    return this.http.delete<any>("users/policies/" + policy_id).pipe(
      map((response) => {
        return response;
      })
    );
  }


  getSystemModules() {
    return this.http.get<any>(`system/modules`)
    .pipe(map(response => {
      return response;
    }));
  }

}
