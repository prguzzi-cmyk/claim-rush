import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Tag } from "../models/tag.model";
import { throwError } from "rxjs";
import { map, catchError } from "rxjs/operators";

@Injectable({
  providedIn: "root",
})
export class TagService {
  constructor(private http: HttpClient) {}

  getTag(tagId: string) {
    return this.http
      .get<Tag>(`tags/${tagId}`)
      .pipe(map((response) => response));
  }

  getTags(urlParams?: any) {
    return this.http
      .get<any>(
        `tags${
          urlParams
            ? `?only_removed=${urlParams.onlyRemoved}&sort_by=${urlParams.sortByValue}&order_by=${urlParams.orderByValue}&search_field=${urlParams.searchField}&search_value=${urlParams.searchValue}&page=1&size=100`
            : ""
        }`
      )
      .pipe(map((response) => response));
  }

  createTag(tag: Tag) {
    return this.http.post("tags", tag);
  }

  updateTag(tagId: string, tag: Tag) {
    return this.http.put(`tags/${tagId}`, tag).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteTag(tagId: string) {
    return this.http.delete<Tag>(`tags/${tagId}`).pipe(
      map((response) => {
        return response;
      }),
      catchError((error) => {
        return throwError(error);
      })
    );
  }

  restoreTag(tagId: string) {
    return this.http
      .patch<Tag>(`tags/${tagId}/restore`, {})
      .pipe(map((response) => response));
  }
}
