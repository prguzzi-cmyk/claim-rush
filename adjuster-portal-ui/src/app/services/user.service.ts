import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '../models/user.model';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import {map, catchError, tap} from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class UserService {
    private currentUserSubject: BehaviorSubject<User> =
        new BehaviorSubject<any>('');
    public currentUser: Observable<User> =
        this.currentUserSubject.asObservable();

    constructor(private http: HttpClient) { }

    getUser() {
        if ((environment as any).devAutoLogin) {
            const devUser: any = {
                id: 'dev_user',
                first_name: 'Dev',
                last_name: 'Admin',
                email: 'dev@localhost',
                role_id: 'super-admin',
                manager_id: null,
                role: { name: 'super-admin', display_name: 'Super Admin', can_be_removed: true, id: 'super-admin' },
                permissions: [],
                is_active: true,
                operating_mode: 'neutral',
            };
            this.currentUserSubject.next(devUser);
            return of(devUser);
        }
        return this.http.get<any>('users/me', {}).pipe(
            map((data) => {
                this.currentUserSubject.next(data);
                return data;
            })
        );
    }

    getUsers(pageIndex: number = 1, pageSize: number = 10, userParams: any = null) {

        const userParam = userParams || {};

        let params = {};
        params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: userParam['sort_by']??'created_at',
            order_by: userParam['order_by']??'desc',
        };

        return this.http.get<any>('users', { params }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getUsersReport(pageIndex: number = 1, pageSize: number = 10, userParams: any = null): Observable<any> {
        const userParam = userParams || {};
        let params = {};

        params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: userParam['sort_by']??'created_at',
            order_by: userParam['order_by']??'desc',
        };

        for (let key in userParams) {
            if (userParams[key] != '' && userParams[key] != null) {
                params[key] = userParams[key];
            }
        }

        return this.http
            .get<any>(
                'reports/users/advanced-search', { params }
            );
    }

    getUsersByRole(rolename: string) {
        return this.http.get<any>('users/role/' + rolename).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getUserPermissions(module: string, operation: string) {
        var permissions = JSON.parse(localStorage.getItem('permissions'));

        if (!permissions || !Array.isArray(permissions)) {
            return false;
        }

        let permission = permissions.filter(
            (obj) =>
                obj.module == module &&
                obj.operation == operation &&
                obj.effect != 'deny'
        )[0];
        if (permission) {
            return true;
        } else {
            return false;
        }
    }

    getUserModulePermissions(module: string): string[] | null {
        const permissions = JSON.parse(localStorage.getItem('permissions') || '[]');

        const permissionNames = permissions
            .filter(
                (permission) => permission.name.includes(module) && permission.effect !== 'deny'
            )
            .map(permission => permission.name);

        return permissionNames.length > 0 ? permissionNames : null;
    }

    addUser(user: User) {
        return this.http.post('users', user);
    }

    updateUser(user: User) {
        return this.http.put('users/' + user.id, { ...user }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    updateUserProfile(user: User) {
        return this.http.put('users/me', { ...user }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    updateUserStatus(id: number, status: string) {
        return this.http.patch('users/' + id, { status: status }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    changePassword(newPassword: string) {
        return this.http.put('users/me', { password: newPassword }).pipe(
            map((response) => {
                return response;
            }),
            catchError((error) => {
                return throwError(error);
            })
        );
    }
    resetPassword(newPassword: string, newToken: string) {
        return this.http
            .post('auth/reset-password', {
                token: newToken,
                new_password: newPassword,
            })
            .pipe(
                map((response) => {
                    return response;
                }),
                catchError((error) => {
                    return throwError(error);
                })
            );
    }

    deleteUser(id: string) {
        return this.http.delete<any>('users/' + id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getUserById(id: string) {
        return this.http.get<any>('users/' + id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    appendCollaborators(claim_id: string, collaborators: any) {
        return this.http
            .post(`claims/${claim_id}/append-collaborators`, {
                ...collaborators,
            })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    removeCollaborators(claim_id: string, collaborators: any) {
        return this.http
            .post(`claims/${claim_id}/remove-collaborators`, {
                ...collaborators,
            })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getUserProfile() {
        return this.http.get<any>('users/me', {}).pipe(
            map((response) => {
                return response;
            })
        );
    }

    savePersonalFiles(data: any) {
        const formData = new FormData();
        formData.append("file", data.file, data.file.name);
        formData.append("file_name", data.file_name);
        formData.append("description", data.description);
        formData.append("state", data.state);
        formData.append("expiration_date", data.expiration_date);

        return this.http.post("user-personal-file/my-files", formData).pipe(
            map((response) => {
                return response;
            })
        );
    }

    deletePersonalFiles(file_id: string) {
        return this.http.delete<any>("user-personal-file/my-files/" + file_id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getPersonalFiles() {//
        return this.http.get<any>("user-personal-file/my-files").pipe(
            map((response) => {
                return response;
            })
        );
    }


    updatePersonalFiles(fileData: { name: string; description: string; state: string, expiration_date: string, can_be_removed: boolean }, file_id: string) {
        return this.http.put("user-personal-file/my-files/" + file_id, fileData).pipe(
            map((response) => {
                return response;
            })
        );
    }

}
