import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpHeaders, HttpRequest } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Claim } from '../models/claim.model';
import { ClaimTask } from '../models/tasks-claim.model';
import { ClaimPayment } from '../models/payment-claim.model';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ClaimFileShareRequest } from '../models/share-claim-files.model';
import {Commission} from "../models/commission.model";

@Injectable({
    providedIn: 'root',
})
export class CommissionService {
    private cacheClaims = new Map<string, any>();
    constructor(private http: HttpClient) { }

    getCommissions(owner_id: string, status: number, pageIndex: number = 1, pageSize: number = 10) {
        const params = {
            owner_id: owner_id,
            status: status,
            page_num: pageIndex.toString(),
            page_size: pageSize.toString()
        };

        return this.http
            .get<any>(
                `mlm/v1/commission`, { params }
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getCommissionsByPayment(payment_id: string) {
        const params = {
            payment_id: payment_id,
            page_num: 1,
            page_size: 50
        };

        return this.http
            .get<any>(
                `mlm/v1/commission/${payment_id}`, { params }
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    generateCommission() {
        return this.http.post(`mlm/v1/commission`, { }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    confirmCommission(data: any) {
        return this.http.put(`mlm/v1/commission`, { ...data }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    readjustCommission(data: any) {
        return this.http.put(`mlm/v1/commission/readjust`, { ...data }).pipe(
            map((response) => {
                return response;
            })
        );
    }
}
