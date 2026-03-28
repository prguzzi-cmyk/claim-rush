import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { User } from "../models/user.model";
import { BehaviorSubject, Observable, throwError, of } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { Category } from "../models/category.model";

@Injectable({
  providedIn: "root",
})
export class ProductService {

  private currentUserSubject: BehaviorSubject<User> = new BehaviorSubject<any>(
    ""
  );
  public currentUser: Observable<User> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) { }

  getProductList(pageIndex: number = 1, pageSize: number = 10, categoryId = null) {
    const params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
    };
    if (categoryId !== null) {
      params['category_id'] = categoryId
    }

    return this.http.get<any>("products", { params }).pipe(
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

  updateProduct(product_id: string, data: FormData) {
    return this.http.put('products/' + product_id, data).pipe(map((response) => {
      return response
    }))
  }

  deleteProduct(id: string) {
    return this.http.delete<any>("products/" + id).pipe(
      map((response) => {
        return response
      })
    )
  }
}
