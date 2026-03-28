import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { throwError } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { Partnership } from "../models/partnership.model";

@Injectable({
  providedIn: "root",
})
export class PartnershipService {
  constructor(private http: HttpClient) {}

  getPartnership(partnershipId: string) {
    return this.http
      .get<Partnership>(`partnerships/${partnershipId}`)
      .pipe(map((response) => response));
  }

  getPartnerships(urlParams?: {
    onlyRemoved: boolean;
    sortBy: string;
    orderBy: string;
    searchField: string;
    searchValue: string;
  }) {
    return this.http
      .get<any>(
        `partnerships${
          urlParams
            ? `?only_removed=${urlParams.onlyRemoved}&sort_by=${urlParams.sortBy}&order_by=${urlParams.orderBy}&search_field=${urlParams.searchField}&search_value=${urlParams.searchValue}`
            : ""
        }`
      )
      .pipe(map((response) => response));
  }

  createPartnership(partnership: Partnership) {
    return this.http.post("partnerships", partnership);
  }

  updatePartnership(partnershipId: string, partnership: Partnership) {
    return this.http.put(`partnerships/${partnershipId}`, partnership).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deletePartnership(partnershipId: string) {
    return this.http.delete<Partnership>(`partnerships/${partnershipId}`).pipe(
      map((response) => {
        return response;
      }),
      catchError((error) => {
        return throwError(error);
      })
    );
  }

  restorePartnership(partnershipId: string) {
    return this.http
      .patch<Partnership>(`partnerships/${partnershipId}/restore`, {})
      .pipe(
        map((response) => response),
        catchError((error) => {
          return throwError(error);
        })
      );
  }
}
