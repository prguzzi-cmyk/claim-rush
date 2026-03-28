import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Role } from '../models/role.model';

@Injectable({
    providedIn: 'root',
})
export class RoleService {
    constructor(private http: HttpClient) {}

    getRoles() {
        return this.http.get<any>('roles?page=1&size=100').pipe(
            map((response) => {
                return response;
            })
        );
    }
    getRole(role_id) {
        return this.http.get<Role>('roles/' + role_id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    addRole(role: Role) {
        return this.http.post('roles', role);
    }

    updateRole(role: Role) {
        return this.http.put('roles/' + role.id, { ...role }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    deleteRole(id: string) {
        return this.http.delete<any>('roles/' + id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    searchRoles(
        pageIndex: number = 1,
        pageSize: number = 10,
        search_term: any
    ) {
        const params = {
            search_value: search_term ?? null,
            search_field: 'name',
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_field: 'display_name',
            sort_order: 'desc',
        };

        return this.http
            .get<any>('roles', { params })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }
}
