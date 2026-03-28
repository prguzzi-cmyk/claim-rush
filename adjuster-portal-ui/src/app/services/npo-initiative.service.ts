import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { throwError } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { NpoInitiative } from "../models/npo-initiative.model";

@Injectable({
  providedIn: "root",
})
export class NpoInitiativeService {
  constructor(private http: HttpClient) {}

  getNpoInitiative(npoInitiativeId: string) {
    // &page=1&size=1000
    return this.http
      .get<NpoInitiative>(`npo-initiatives/${npoInitiativeId}`)
      .pipe(map((response) => response));
  }

  getNpoInitiatives(urlParams?: {
    onlyRemoved: boolean;
    sortBy: string;
    orderBy: string;
    searchField: string;
    searchValue: string;
  }) {
    return this.http
      .get<any>(
        `npo-initiatives${
          urlParams
            ? `?only_removed=${urlParams.onlyRemoved}&sort_by=${urlParams.sortBy}&order_by=${urlParams.orderBy}&search_field=${urlParams.searchField}&search_value=${urlParams.searchValue}`
            : ""
        }`
      )
      .pipe(map((response) => response));
  }

  createNpoInitiative(npoInitiative: NpoInitiative) {
    return this.http.post("npo-initiatives", npoInitiative);
  }

  updateNpoInitiative(npoInitiativeId: string, npoInitiative: NpoInitiative) {
    return this.http
      .put(`npo-initiatives/${npoInitiativeId}`, npoInitiative)
      .pipe(
        map((response) => {
          return response;
        })
      );
  }

  deleteNpoInitiative(npoInitiativeId: string) {
    return this.http
      .delete<NpoInitiative>(`npo-initiatives/${npoInitiativeId}`)
      .pipe(
        map((response) => {
          return response;
        }),
        catchError((error) => {
          return throwError(error);
        })
      );
  }

  restoreNpoInitiative(npoInitiativeId: string) {
    return this.http
      .patch<NpoInitiative>(`npo-initiatives/${npoInitiativeId}/restore`, {})
      .pipe(
        map((response) => response),
        catchError((error) => {
          return throwError(error);
        })
      );
  }
}
