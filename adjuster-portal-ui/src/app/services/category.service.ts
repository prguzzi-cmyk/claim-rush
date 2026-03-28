import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { User } from "../models/user.model";
import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Category } from "../models/category.model";

@Injectable({
  providedIn: "root",
})
export class CategoryService {
  private currentUserSubject: BehaviorSubject<User> = new BehaviorSubject<any>(
    ""
  );
  public currentUser: Observable<User> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) { }

  getCategoryList(pageIndex: number = 1, pageSize: number = 10) {
    const params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
    };

    return this.http.get<any>("categories", { params }).pipe(
      map((data) => {
        return data;
      })
    );
  }

  getAllCategoryList() {
    return this.http.get<any>("categories/all").pipe(
      map((data) => {
        return data;
      })
    );
  }

  createCategory(category: Category) {
    return this.http.post("categories", category);
  }

  updateCategory(category: Category) {
    return this.http.put('categories/' + category.id, { ...category }).pipe(
      map((response) => {
        return response
      })
    )
  }

  deleteCategory(id: string) {
    return this.http.delete<any>("categories/" + id).pipe(
      map((response) => {
        return response
      })
    )
  }
}
