import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { throwError } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { Network } from "../models/network.model";

@Injectable({
  providedIn: "root",
})
export class NetworkService {
  constructor(private http: HttpClient) {}

  getNetwork(networkId: string) {
    return this.http
      .get<Network>(`networking/${networkId}`)
      .pipe(map((response) => response));
  }

  getNetworks(urlParams?: {
    onlyRemoved: boolean;
    sortBy: string;
    orderBy: string;
    searchField: string;
    searchValue: string;
  }) {
    return this.http
      .get<any>(
        `networking${
          urlParams
            ? `?only_removed=${urlParams.onlyRemoved}&sort_by=${urlParams.sortBy}&order_by=${urlParams.orderBy}&search_field=${urlParams.searchField}&search_value=${urlParams.searchValue}`
            : ""
        }`
      )
      .pipe(map((response) => response));
  }

  createNetwork(network: Network) {
    return this.http.post("networking", network);
  }

  updateNetwork(networkId: string, network: Network) {
    return this.http.put(`networking/${networkId}`, network).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteNetwork(networkId: string) {
    return this.http.delete<Network>(`networking/${networkId}`).pipe(
      map((response) => {
        return response;
      }),
      catchError((error) => {
        return throwError(error);
      })
    );
  }

  restoreNetwork(networkId: string) {
    return this.http.patch<Network>(`networking/${networkId}/restore`, {}).pipe(
      map((response) => response),
      catchError((error) => {
        return throwError(error);
      })
    );
  }
}
