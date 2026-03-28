import { Announcement } from './../models/announcement.model';
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { map } from "rxjs/operators";

@Injectable({
  providedIn: "root",
})

export class AnnouncementService {
  constructor(private http: HttpClient) {}

  getAnnouncements(pageIndex: number = 1, pageSize: number = 10) {

    let params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
      sort_by: 'announcement_date',
      order_by: 'desc'
    };

    return this.http.get<any>("announcements", {params} ).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getAnnouncement(id) {
    return this.http.get<Announcement>("announcements/" + id).pipe(
      map((response) => {
        return response;
      })
    );
  }

  addAnnouncement(announcement: Announcement) {
    return this.http.post("announcements", announcement);
  }


  addAnnouncementActivity(announcement: Announcement, activity: any) {
    return this.http.post('announcements/' + announcement.id + '/activities', activity).pipe(
      map(response => { return response; })
    );
  }

  updateAnnouncement(announcement: Announcement) {
    return this.http.put("announcements/" + announcement.id, { ...announcement }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteAnnouncement(id: string) {
    return this.http.delete<any>(`announcements/${id}`).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteAnnouncementFile(id: string) {
    return this.http.delete<any>(`announcements/files/${id}`).pipe(
      map((response) => {
        return response;
      })
    );
  }

  addAnnouncementFile(newsletter_id: string, file : any) {
    const formData = new FormData();
    formData.append('file', file.file, file.file.name);
    formData.append('file_name', file.file_name);
    formData.append('description', file.description);

    return this.http.post(`announcements/${newsletter_id}/files`, formData);
  }


  getAnnouncementFiles(id: string, pageIndex: number = 1, pageSize: number = 100) {

    let params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
    };

    return this.http.get<any>(`announcements/${id}/files`, {params}).pipe(
      map((response) => {
        return response;
      })
    );

  }



}
