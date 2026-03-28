import {Injectable} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {map} from 'rxjs/operators';

@Injectable({
    providedIn: 'root',
})
export class TitleChangeService {
    constructor(private http: HttpClient) { }

    tryChangeAgentTitle(userId: string, change_type: number) {
        return this.http.post<any>(`mlm/v1/title/try-change`, {
            owner_id: userId,
            change_type: change_type
        }).pipe(
            map((data) => {
                return data;
            })
        );
    }

    getNonTeamMembers(recruiter_id: string) {
        const params = {
            recruiter_id: recruiter_id
        };

        return this.http.get<any>(
                `mlm/v1/title/non-team-members`, { params }
            ).pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getTitleChangeTickets(owner_id: string, status: number, pageIndex: number = 1, pageSize: number = 10) {
        const params = {
            owner_id: owner_id,
            status: status,
            page_num: pageIndex.toString(),
            size_size: pageSize.toString()
        };

        return this.http
            .get<any>(
                `mlm/v1/title/change-ticket`, { params }
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    executeTitleChange(data: any) {
         return this.http.put(`mlm/v1/title/execute-change`, { ...data }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    cancelTitleChange(data: any) {
        return this.http.put(`mlm/v1/title/cancel-change`, { ...data }).pipe(
            map((response) => {
                return response;
            })
        );
    }

}
