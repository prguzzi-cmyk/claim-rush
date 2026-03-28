import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Client } from '../models/client.model';
import { Claim } from '../models/claim.model';
import { ClientTask } from '../models/tasks-client.model';
import { Observable, forkJoin, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ClientPortalAccountService } from './client-portal-account.service';

@Injectable({
    providedIn: 'root',
})
export class ClientService {
    private cacheClients = new Map<string, any>();

    constructor(
        private http: HttpClient,
        private portalAccountService: ClientPortalAccountService,
    ) { }

    private generateCacheKey(params: any): string {
        return JSON.stringify(params);
    }

    searchClients(
        pageIndex: number = 1,
        pageSize: number = 10,
        search_term: any,
        clientParams: any = null
    ) {
        const clientParam = clientParams || {};

        const params = {
            search_term: search_term ?? null,
            page: pageIndex.toString(),
            size: pageSize.toString(),
            period_type: clientParam['period_type'] ?? 'all-time',
            sort_by: clientParam['sort_by'] ?? 'created_at',
            order_by: clientParam['order_by'] ?? 'desc',
        };

        return this.http
            .get<any>('reports/clients/search-everywhere', { params })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getClientsByUserId(
        userEmail: string,
        pageIndex: number = 1,
        pageSize: number = 10
    ) {
        const params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
            search_field: 'belonged_user_email',
            search_value: userEmail,
        };

        return this.http.get<any>('clients', { params }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    searchClientsNavbar(
        pageIndex: number = 1,
        pageSize: number = 10,
        search_term: any,
        clientParams: any = null
      ): Observable<any[]> {
        const clientParam = clientParams || {};
      
        if (typeof search_term === 'object' || search_term === '') {
          // Always return an observable, even for empty or invalid search
          return of([]);
        }
      
        const params = {
          full_name: search_term ?? null,
          page: pageIndex.toString(),
          size: pageSize.toString(),
          period_type: clientParam['period_type'] ?? 'all-time',
          order_by: clientParam['order_by'] ?? 'asc',
          search_field: 'full_name',
          search_value: search_term.trim() ?? null,
        };
      
        const clients$ = this.http.get<any>('reports/clients/advanced-search', { params }).pipe(
          map((response) =>
            response.items.map((client: any) => ({
              full_name: client.full_name,
              id: client.id,
              ref_number: client.ref_number,
              ref_string: client.ref_string,
              address: client.address,
              city: client.city,
              state: client.state,
              zip_code: client.zip_code,
              type: 'client',
            }))
          )
        );
      
        const leads$ = this.http.get<any>('leads', { params }).pipe(
          map((response) =>
            response.items.map((lead: any) => ({
              full_name: lead.contact.full_name,
              id: lead.id,
              ref_number: lead.ref_number,
              ref_string: lead.ref_string,
              address: lead.contact?.address_loss,
              city: lead.contact?.city_loss,
              state: lead.contact?.state,
              zip_code: lead.contact?.zip_code,
              type: 'lead',
            }))
          )
        );
      
        return forkJoin({ clients: clients$, leads: leads$ }).pipe(
          map((result) => [...result.clients, ...result.leads])
        );
      }

    getClients(pageIndex: number = 1, pageSize: number = 10, clientParams: any = null) {

        const clientParam = clientParams || {};

        let params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: clientParam['sort_by'] ?? 'created_at',
            order_by: clientParam['order_by'] ?? 'desc',
            period_type: clientParam['period_type'] ?? 'all-time',
            search_term: ''
        };

        return this.http.get<any>('reports/clients/search-everywhere', { params }).pipe(
            map((response) => {
                return response;
            }),
            tap((data) => { })
        );
    }

    getClient(client_id: string) {
        return this.http.get<Client>('clients/' + client_id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClientsReport(
        pageIndex: number = 1,
        pageSize: number = 10,
        clientData: any
    ) {
        let params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
        };

        for (let key in clientData) {
            if (clientData[key] != '' && clientData[key] != null) {
                params[key] = clientData[key];
            }
        }

        return this.http
            .get<any>(`reports/clients/advanced-search`, { params })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getClientsComments(
        clientData: any,
        pageIndex: number = 1,
        pageSize: number = 10
    ) {
        let params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
        };

        for (let key in clientData) {
            if (clientData[key] != '' && clientData[key] != null) {
                params[key] = clientData[key];
            }
        }

        return this.http.get<any>(`reports/clients/comments?`, { params }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClientsTasks(clientData: any) {
        let params = new URLSearchParams();
        for (let key in clientData) {
            if (clientData[key] != '' && clientData[key] != null) {
                params.set(key, clientData[key]);
            }
        }

        return this.http
            .get<any>(
                `reports/clients/tasks?` +
                params.toString() +
                '&limit=100&sorted_by=created_at&order_by=desc'
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    getClientsFiles(clientData: any) {
        let params = new URLSearchParams();
        for (let key in clientData) {
            if (clientData[key] != '' && clientData[key] != null) {
                params.set(key, clientData[key]);
            }
        }

        return this.http
            .get<any>(
                `reports/clients/files?` +
                params.toString() +
                '&limit=100&sorted_by=created_at&order_by=desc'
            )
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    addClient(client: Client) {
        return this.http.post('clients', client).pipe(
            map((response) => {
                return response;
            }),
            tap((created: any) => {
                // Automatically create a client portal account
                // after the client record is persisted.
                this.portalAccountService.createPortalAccount(created);
            }),
        );
    }

    updateClient(client: Client) {
        return this.http.put('clients/' + client?.id, { ...client }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    deleteClient(id: string) {
        return this.http.delete<any>('clients/' + id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClaims() {
        return this.http.get<any>('claims').pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClaim(claim_id: string) {
        return this.http.get<Claim>('claims/' + claim_id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    addClaim(claim: Claim) {
        return this.http.post('claims', claim).pipe(
            map((response) => {
                return response;
            })
        );
    }

    updateClaim(claim: Claim) {
        return this.http.put('claims/' + claim?.id, { ...claim }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    deleteClaim(id: string) {
        return this.http.delete<any>('claims/' + id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClientFiles(
        client_id: string,
        pageIndex: number = 1,
        pageSize: number = 10
    ) {
        let params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
        };

        return this.http
            .get<any>('clients/' + client_id + '/files', { params })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    saveClientFiles(data: any, client_id: string) {
        const formData = new FormData();
        formData.append('file', data.file, data.file.name);
        formData.append('file_name', data.file_name);
        formData.append('description', data.description);

        return this.http.post('clients/' + client_id + '/files', formData).pipe(
            map((response) => {
                return response;
            })
        );
    }

    updateClientFiles(data: any, file_id: string) {
        return this.http.put('clients/files/' + file_id, data).pipe(
            map((response) => {
                return response;
            })
        );
    }

    deleteClientFiles(file_id: string) {
        return this.http.delete<any>('clients/files/' + file_id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClientComments(
        client_id: string,
        pageIndex: number = 1,
        pageSize: number = 10
    ) {
        let params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
        };

        return this.http
            .get<any>('clients/' + client_id + '/comments', { params })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    addClientComments(data: any, client_id: string) {
        return this.http.post('clients/' + client_id + '/comments', data).pipe(
            map((response) => {
                return response;
            })
        );
    }

    updateClientComments(data: any) {
        return this.http
            .put('clients/comments/' + data.client_comment_id, { ...data })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    deleteClientComment(id: string) {
        return this.http.delete<any>('clients/comments/' + id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    addClientTask(clientTask: ClientTask, lead_id: string) {
        return this.http.post('clients/' + lead_id + '/tasks', clientTask).pipe(
            map((response) => {
                return response;
            })
        );
    }

    updateClientTask(clientTask: ClientTask) {
        return this.http
            .put('clients/tasks/' + clientTask.id, { ...clientTask })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    deleteClientTask(id: string) {
        return this.http.delete<any>('clients/tasks/' + id).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getClientTasks(
        client_id: string,
        pageIndex: number = 1,
        pageSize: number = 10
    ) {
        let params = {
            page: pageIndex.toString(),
            size: pageSize.toString(),
            sort_by: 'created_at',
            order_by: 'desc',
        };

        return this.http
            .get<any>('clients/' + client_id + '/tasks', { params })
            .pipe(
                map((response) => {
                    return response;
                })
            );
    }

    saveBulkClientFiles(file: File, client_id: string) {
        console.log(file);
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('file_name', file.name);
        formData.append('description', 'bulk import');

        const req = new HttpRequest(
            'POST',
            'clients/' + client_id + '/files',
            formData,
            {
                reportProgress: true,
                responseType: 'json',
            }
        );

        return this.http.request(req);
    }
}
