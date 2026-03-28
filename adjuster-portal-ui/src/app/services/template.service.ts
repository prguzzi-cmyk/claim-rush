import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map } from 'rxjs/operators';
import { Template } from '../models/template.model';
import { Observable, throwError } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class TemplateService {
    constructor(private http: HttpClient) {}

    getTemplates(pageIndex: number = 1, pageSize: number = 10): Observable<any> {

        let params = {
            page: pageIndex,
            size: pageSize
        }

        return this.http
            .get<Template[]>('template-files' , {params})
            .pipe(
                map((response) => {
                    return response;
                }),
                catchError(this.handleError)
            );
        }

    getTemplateById(id: string): Observable<any> {
        return this.http
            .get<any>(`template-files/${id}/`)
            .pipe(catchError(this.handleError));
    }

    addTemplate(templateData: any) {

        const formData = new FormData();
        formData.append('file', templateData.file, templateData.file.name);
        formData.append('file_name', templateData.file_name);
        formData.append('description', templateData.description);
        formData.append('state', templateData.state);

        return this.http.post('template-files', formData).pipe(
            map((response) => {
                return response;
            }),
            catchError(this.handleError)
        );
    }

    updateTemplate(templateData: any) {

        const formData = new FormData();
        formData.append('file_name', templateData.file_name);
        formData.append('description', templateData.description);
        formData.append('state', templateData.state);

        return this.http.put(`template-files/${templateData.id}` , formData ).pipe(
            map((response) => {
                return response;
            }),
            catchError(this.handleError)
        );
    }

    deleteTemplate(id: string) {
        return this.http.delete<any>(`template-files/${id}`).pipe(
            map((response) => {
                return response;
            }),
            catchError(this.handleError)
        );
    }

    private handleError(error: any) {
        // You can customize error handling here
        console.error('An error occurred:', error.error.message);
        return throwError(
            () => new Error('Template service error.')
        );
    }
}