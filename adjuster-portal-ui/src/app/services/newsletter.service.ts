import { Newsletter } from './../models/newsletter.model';
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { map } from "rxjs/operators";
import { NewsletterFile } from '../models/files-newsletter.model';

@Injectable({
  providedIn: "root",
})

export class NewsletterService {
  constructor(private http: HttpClient) {}

  getNewsletters(pageIndex: number = 1, pageSize: number = 10) {

    let params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
      sort_by: 'publication_date',
      order_by: 'desc'
    };

    return this.http.get<any>("newsletters", {params}).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getNewsletter(id) {
    return this.http.get<Newsletter>("newsletters/" + id).pipe(
      map((response) => {
        return response;
      })
    );
  }

  addNewsletter(newsletter: Newsletter) {
    return this.http.post("newsletters", newsletter);
  }

  addNewsletterFile(newsletter_id: string, file : any) {
    const formData = new FormData();
    formData.append('file', file.file, file.file.name);
    formData.append('file_name', file.file_name);
    formData.append('description', file.description);

    return this.http.post(`newsletters/${newsletter_id}/files`, formData);
  }

  updateFile(fileId: string, file: any) {

    const formData = new FormData();
    formData.append('file', file.file, file.file.name);
    formData.append('file_name', file.file_name);
    formData.append('description', file.description);

    return this.http.put(`newsletters/${fileId}/files`, formData).pipe(
      map((response) => {
        return response;
      })
    );
  }

  updateNewsletter(newsletter: Newsletter) {
    return this.http.put("newsletters/" + newsletter.id, { ...newsletter }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteNewsletter(id: string) {
    return this.http.delete<any>(`newsletters/${id}`).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteNewsletterFile(id: string) {
    return this.http.delete<any>(`newsletters/files/${id}`).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getNewsletterFiles(id: string) {

    return this.http.get<any>(`newsletters/${id}/files`).pipe(
      map((response) => {
        return response;
      })
    );

  }

}
