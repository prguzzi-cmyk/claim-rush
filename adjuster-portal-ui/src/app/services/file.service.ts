import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { throwError } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { FileResource } from "../models/file-resource.model";

@Injectable({
  providedIn: "root",
})
export class FileService {
  constructor(private http: HttpClient) {}

  getFile(fileId: string) {
    return this.http
      .get<FileResource>(`files/${fileId}`)
      .pipe(map((response) => response));
  }

  getFiles(urlParams?: {
    // view: string;
    sortBy: string;
    orderBy: string;
    searchField: string;
    searchValue: string;
  }) {
    // const { sortBy, orderBy, searchField, searchValue } = urlParams;

    return this.http
      .get<any>(
        `files/tags/agent-resource${
          urlParams
            ? `?sort_by=${urlParams.sortBy}&order_by=${urlParams.orderBy}&search_field=${urlParams.searchField}&search_value=${urlParams.searchValue}&page=1&size=1000
            `
            : ""
        }`
      )
      .pipe(map((response) => response));
  }

  uploadFile(file: FormData) {
    return this.http.post("files", file);
  }

  updateFile(fileId: string, file: FileResource) {
    return this.http.put(`files/${fileId}`, file).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteFile(fileId: string) {
    return this.http.delete<FileResource>(`files/${fileId}`).pipe(
      map((response) => {
        return response;
      }),
      catchError((error) => {
        return throwError(error);
      })
    );
  }
}
