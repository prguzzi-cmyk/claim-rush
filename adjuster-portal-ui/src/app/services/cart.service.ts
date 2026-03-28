import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { User } from "../models/user.model";
import { BehaviorSubject, Observable, throwError, of } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { Category } from "../models/category.model";
import { Product } from "../models/product.model";

@Injectable({
  providedIn: "root",
})
export class CartService {

  private currentUserSubject: BehaviorSubject<User> = new BehaviorSubject<any>(
    ""
  );
  public currentUser: Observable<User> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) { }

  getCartList() {
    return this.http.get<any>("carts").pipe(
      map((data) => {
        return data;
      })
    );
  }

  createProduct(data: FormData) {
    return this.http.post('products', data).pipe(map((response) => {
      return response
    }))
  }

  addProductToCart(product: Product) {
    const data = {
      product_id : product.id,
      product_name: product.name,
      product_image: product.product_image,
      quantity: 1,
      price: product.price
    }
    return this.http.post('carts', data).pipe(map((response) => {
      return response
    }))
  }

  updateCart(data:any) {
    return this.http.put('carts', data).pipe(map((response) => {
      return response
    }))
  }

  deleteCart(id: string) {
    return this.http.delete<any>("carts/" + id).pipe(
      map((response) => {
        return response
      })
    )
  }

  checkout() {
    return this.http.post<any>("carts/check-out", null).pipe(
      map((response) => {
        return response
      })
    )
  }
}
