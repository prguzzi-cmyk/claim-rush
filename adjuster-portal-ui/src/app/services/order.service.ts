import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { User } from "../models/user.model";
import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable({
  providedIn: "root",
})
export class OrderService {
  getOrderList(page: number, size: number) {
    const params = {
      page: page.toString(),
      size: size.toString()
    }
    return this.http.get<any>("orders", { params }).pipe(
      map((response) => {
        return response
      })
    )
  }

  updateOrder(order_id:string) {
    return this.http.put<any>("orders/"+ order_id,null).pipe(
      map((response) => {
        return response
      })
    )
  }


  getMyOrderList(page: number, size: number) {
    const params = {
      page: page.toString(),
      size: size.toString()
    }
    return this.http.get<any>("orders/me", { params }).pipe(
      map((response) => {
        return response
      })
    )
  }

  getOrderDetailList(order_id: string) {
    return this.http.get<any>("orders/" + order_id + '/details')
  }



  getOrderDetailListForManagement(order_id: string) {
    return this.http.get<any>("orders/" + order_id + '/details-management')
  }

  private currentUserSubject: BehaviorSubject<User> = new BehaviorSubject<any>(
    ""
  );
  public currentUser: Observable<User> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) { }

  createOrder() {
    return this.http.post<any>("orders", null).pipe(
      map((response) => {
        return response
      })
    )
  }
}
