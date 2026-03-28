import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpHeaders, HttpRequest } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Claim } from '../models/claim.model';
import { ClaimTask } from '../models/tasks-claim.model';
import { ClaimPayment } from '../models/payment-claim.model';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ClaimFileShareRequest } from '../models/share-claim-files.model';

@Injectable({
    providedIn: 'root',
})
export class ClaimService {
    private cacheClaims = new Map<string, any>();
    constructor(private http: HttpClient) { }

    private generateCacheKey(params: any): string {
        return JSON.stringify(params);
    }


    searchClaims(claimParams: any = null) {
        const claimParam = claimParams || {};

        let params = {};
        params = {
            search_term: claimParam['search_term'] ?? '',
            page: claimParam['page'] ?? 1,
            size: claimParam['size'] ?? 10,
            sort_by: claimParam['sort_by'] ?? 'created_at',
            order_by: claimParam['order_by'] ?? 'desc',
            period_type: claimParam['period_type'] ?? 'all-time'
        };

        return this.http
            .get<any>(
                'reports/claims/search-everywhere', { params }
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getClaims(pageIndex: number = 1, pageSize: number = 10) {

        const params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc'
        };

        return this.http
            .get<any>(
                'claims', { params }
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getClaimsByClientId(client_id: string, pageIndex: number = 1, pageSize: number = 10) {

        const params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
            search_field: 'client_id',
            search_value: client_id
        };

        return this.http
            .get<any>(
                'claims', { params }
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getClaimsByUserId(user_id: string, search_field: string,  pageIndex: number = 1, pageSize: number = 10) {

        const params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
            search_field: search_field,
            search_value: user_id
        };

        return this.http
            .get<any>(
                'claims', { params }
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getClaimsReport(pageIndex: number = 1, pageSize: number = 10, claimParams: any = null): Observable<any> {
        const claimParam = claimParams || {};

        let params = {};
        params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: claimParam['sort_by'] ?? 'created_at',
            order_by: claimParam['order_by'] ?? 'desc',
        };

        for (let key in claimParams) {
            if (claimParams[key] != '' && claimParams[key] != null) {
                params[key] = claimParams[key];
            }
        }

        return this.http
            .get<any>(
                'reports/claims/advanced-search', { params }
            );
    }

    getClaimsReportByZipcode(claimData: any) {
        let params = new URLSearchParams();
        for (let key in claimData) {
            if (claimData[key] != '' && claimData[key] != null) {
                params.set(key, claimData[key]);
            }
        }

        return this.http
            .get<any>(
                `reports/claims/by-zip-code?` +
                params.toString() +
                '&limit=100&sorted_by=created_at&order_by=desc'
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getClaimsComments(claimData: any, pageIndex: number = 1, pageSize: number = 10) {

        let params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
        };

        for (let key in claimData) {
            if (claimData[key] != '' && claimData[key] != null) {
                params[key] = claimData[key];
            }
        }

        return this.http
            .get<any>(
                `reports/claims/comments`, { params }
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getClaimsFiles(fileData: any) {
        let params = new URLSearchParams();
        for (let key in fileData) {
            if (fileData[key] != '' && fileData[key] != null) {
                params.set(key, fileData[key]);
            }
        }

        return this.http
            .get<any>(
                `reports/claims/files?` +
                params.toString() +
                '&limit=100&sorted_by=created_at&order_by=desc'
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getClaim(claim_id: string) {
        return this.http.get<Claim>('claims/' + claim_id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    addClaim(claim: Claim) {
        return this.http.post('claims', claim).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClaimPaymentsReady(pageIndex: number = 1, pageSize: number = 10, until_date: string) {

        const params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            until_date: until_date,
            sort_by: 'created_at',
            order_by: 'desc'
        };

        return this.http
            .get<any>(
                'claims/payments/ready-to-process', { params }
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    fixBusinessEmailIssues(claim_id: string) {
        return this.http.post(`business-emails/${claim_id}/fix-issues`, {}).pipe(
            map((response) => {
                return response;
            })
        );
    }

    updateClaim(claim: Claim) {
        return this.http.put('claims/' + claim.id, { ...claim }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    deleteClaim(id: string) {
        return this.http.delete<any>('claims/' + id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClaimComments(claim_id: string, pageIndex: number = 1, pageSize: number = 10) {

        let params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
        };

        return this.http
            .get<any>(
                'claims/' +
                claim_id +
                '/comments', { params }
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getClaimsTasks(claimData: any, pageIndex: number = 1, pageSize: number = 10) {

        let params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
        };

        for (let key in claimData) {
            if (claimData[key] != '' && claimData[key] != null) {
                params[key] = claimData[key];
            }
        }

        return this.http
            .get<any>(
                `reports/claims/tasks?` +
                params.toString() +
                '&limit=100&sorted_by=created_at&order_by=desc'
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    addClaimComments(data: any, claim_id: string) {
        return this.http.post('claims/' + claim_id + '/comments', data).pipe(
            map((response) => {
                return response;
            })
        );
    }

    updateClaimComments(data: any) {
        return this.http
            .put('claims/comments/' + data.claim_comment_id, { ...data })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    deleteClaimComment(id: string) {
        return this.http.delete<any>('claims/comments/' + id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    addClaimTask(claimTask: ClaimTask, lead_id: string) {
        return this.http.post('claims/' + lead_id + '/tasks', claimTask).pipe(
            map((response) => {
                return response;
            })
        );
    }

    updateClaimTask(claimTask: ClaimTask) {
        return this.http
            .put('claims/tasks/' + claimTask.id, { ...claimTask })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    deleteClaimTask(id: string) {
        return this.http.delete<any>('claims/tasks/' + id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClaimTasks(claim_id: string, pageIndex: number = 1, pageSize: number = 10) {

        const params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
        };

        return this.http.get<any>('claims/' + claim_id + '/tasks', { params }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClaimFiles(claim_id: string, pageIndex: number = 1, pageSize: number = 10) {

        const params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
        };

        return this.http.get<any>('claims/' + claim_id + '/files', { params }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    saveClaimFiles(data: any, claim_id: string) {
        const formData = new FormData();
        formData.append('file', data.file, data.file.name);
        formData.append('file_name', data.file_name || data.file.name);
        formData.append('description', data.description || '');
        if (data.can_be_removed !== undefined && data.can_be_removed !== null) {
            formData.append('can_be_removed', String(data.can_be_removed));
        }
        if (data.visibility) {
            formData.append('visibility', data.visibility);
        }

        return this.http.post('claims/' + claim_id + '/files', formData).pipe(
            map((response) => {
                return response;
            })
        );
    }

    saveBulkClaimFiles(
        file: File,
        claim_id: string,
        visibility: string = 'internal'
    ): Observable<HttpEvent<any>> {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('file_name', file.name);
        formData.append('description', 'bulk import');
        formData.append('visibility', visibility);
        const headers = { 'Content-Disposition': `inline; filename: ${file.name}`, };

        return this.http
            .post('claims/' + claim_id + '/files', formData, {
                reportProgress: true,
                observe: 'events',
                headers: headers,
            })
            .pipe(
                map((response) => {
                    return response;
                })
            );

    }

    updateClaimFiles(data: any, file_id: string) {
        return this.http.put('claims/files/' + file_id, data).pipe(
            map((response) => {
                return response;
            })
        );
    }

    deleteClaimFiles(file_id: string) {
        return this.http.delete<any>('claims/files/' + file_id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClaimTimeline(claim_id: string) {
        return this.http.get<any>(`claims/${claim_id}/timeline`).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClaimPaymentSummary(claim_id: string) {
        return this.http.get<any>('claims/' + claim_id + '/payment-summary');
    }

    getClaimPayments(claim_id: string, paymentParams: any = null) {

        const paymentParam = paymentParams || {};

        let params = {};
        params = {
            page: paymentParam['page'],
            size: paymentParam['size'],
            sort_by: paymentParam['sort_by']??'created_at',
            order_by: paymentParam['order_by']??'desc',
        };

        return this.http
            .get<any>(`claims/${claim_id}/payments`, { params })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    addClaimPayment(claim_id: string, claimPayment: any) {
        return this.http.post(`claims/${claim_id}/payments`, claimPayment).pipe(
            map((response) => {
                return response;
            })
        );
    }

    updateClaimPayment(claimPayment: any) {
        return this.http
            .put(`claims/payments/${claimPayment?.id}`, claimPayment)
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    deleteClaimPayment(id: string) {
        return this.http.delete<any>(`claims/payments/${id}`).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClaimPhases() {
        return this.http.get<any>('claims/claim-phases').pipe(
            map((response) => {
                return response;
            })
        );
    }

    getEscalationPaths() {
        return this.http.get<any>('claims/escalation-paths').pipe(
            map((response) => {
                return response;
            })
        );
    }

    getSubStatuses() {
        return this.http.get<any>('claims/sub-statuses').pipe(
            map((response) => {
                return response;
            })
        );
    }

    getOriginTypes() {
        return this.http.get<any>('claims/origin-types').pipe(
            map((response) => {
                return response;
            })
        );
    }

    getRecoveryModes() {
        return this.http.get<any>('claims/recovery-modes').pipe(
            map((response) => {
                return response;
            })
        );
    }

    shareClaimFiles(request: ClaimFileShareRequest) {
        return this.http.post('claims/files/share', request).pipe(
            map(response => {
                return response;
            })
        );
    }

    getClaimRoles() {
        return this.http.get<any>('masters/claim-roles-permissions').pipe(
            map((response) => {
                return response;
            })
        );
    }

    getSharedLinks(file_share_id: string) {
        return this.http.get(`claims/files/share/${file_share_id}`).pipe(
            map(response => {
                return response;
            })
        );
    }

    getClaimPaymentFiles(payment_id: string, pageIndex: number = 1, pageSize: number = 10) {

        const params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'payment_date',
            order_by: 'desc',
        };

        return this.http
            .get<any>(`claim-payments/${payment_id}/files`, { params })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    saveClaimPaymentFiles(data: any, payment_id: string) {
        const formData = new FormData();
        formData.append('files', data.file, data.file.name);
        formData.append('file_names', data.file_name);
        formData.append('descriptions', data.description);

        return this.http.post('claim-payments/' + payment_id + '/files', formData).pipe(
            map((response) => {
                return response;
            })
        );
    }


    updateClaimPaymentFiles(data: any, file_id: string) {
        return this.http.put('claim-payment/files/' + file_id, data).pipe(
            map((response) => {
                return response;
            })
        );
    }

    deleteClaimPaymentFiles(file_id: string) {
        return this.http.delete<any>('claim-payments/files/' + file_id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    // --- Claim Communications Hub ---

    getClaimCommunications(claim_id: string, message_type?: string) {
        let params: any = {};
        if (message_type) {
            params.message_type = message_type;
        }
        return this.http
            .get<any>('claims/' + claim_id + '/communications', { params })
            .pipe(map((response) => response));
    }

    getClaimCommunicationsSummary(claim_id: string) {
        return this.http
            .get<any>('claims/' + claim_id + '/communications/summary')
            .pipe(map((response) => response));
    }

    addClaimCommunication(data: any, claim_id: string) {
        return this.http
            .post('claims/' + claim_id + '/communications', data)
            .pipe(map((response) => response));
    }

    deleteClaimCommunication(comm_id: string) {
        return this.http
            .delete<any>('claims/communications/' + comm_id)
            .pipe(map((response) => response));
    }

    getCommunicationThread(comm_id: string) {
        return this.http
            .get<any>('claims/communications/' + comm_id + '/thread')
            .pipe(map((response) => response));
    }

}
