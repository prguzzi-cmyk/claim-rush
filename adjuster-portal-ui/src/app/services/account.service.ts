import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { User } from "../models/user.model";
import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable({
  providedIn: "root",
})
export class AccountService {
  getCreditList(account_id: string, pageIndex: number, pageSize: number) {
    const params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
    };

    return this.http.get<any>(`accounts/${account_id}/detail`, { params }).pipe(map((response) => {
      return response
    }))
  }

  private currentUserSubject: BehaviorSubject<User> = new BehaviorSubject<any>(
    ""
  );
  public currentUser: Observable<User> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) { }

  getMyAccount() {
    return this.http.get<any>('accounts/me').pipe(map((response) => {
      return response
    }))
  }

  getAccountList(pageIndex: number, pageSize: number) {
    const params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
    };
    return this.http.get<any>('accounts', { params }).pipe(map((response) => {
      return response
    }))
  }

  createCredit(data) {
    return this.http.post("accounts", data);
  }
}
