import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { map } from "rxjs/operators";
import { Lead } from "../models/lead.model";
import { Followup } from "./../models/followup.model";
import { LeadFile } from "../models/files-lead.model";
import { LeadTask } from "../models/tasks-lead.model";
import { LeadOutcome, LeadOutcomeCreate } from "../models/lead-outcome.model";
import { Observable, of, from, timer } from "rxjs";
import { tap, concatMap } from "rxjs/operators";
import { ClientPortalAccountService } from "./client-portal-account.service";

@Injectable({
  providedIn: "root",
})
export class LeadService {
  private cacheLeads = new Map<string, any>();

  constructor(
    private http: HttpClient,
    private portalAccountService: ClientPortalAccountService,
  ) {}

  private generateCacheKey(params: any): string {
    return JSON.stringify(params);
  }

  searchLeads(pageIndex: number = 1, pageSize: number = 10, search_term: any) {
    const params = {
      search_term: search_term ?? null,
      page: pageIndex.toString(),
      size: pageSize.toString(),
      sort_by: "created_at",
      period_type: "all-time",
      order_by: "desc",
    };

    return this.http
      .get<any>("reports/leads/search-everywhere", { params })
      .pipe(
        map((response) => {
          return response;
        })
      );
  }

  getLeads(
    pageIndex: number = 1,
    pageSize: number = 10,
    leadParams: any = null
  ) {
    const leadParam = leadParams || {};

    let params: any;

    if (leadParam["search_field"] && leadParam["search_field"].trim() !== "") {
      params = {
        page: pageIndex.toString(),
        size: pageSize.toString(),
        sort_by: leadParam["sort_by"] ?? "created_at",
        order_by: leadParam["order_by"] ?? "desc",
        search_field: leadParam["search_field"],
        search_value: leadParam["search_value"],
      };
    } else {
      params = {
        page: pageIndex.toString(),
        size: pageSize.toString(),
        sort_by: leadParam["sort_by"] ?? "created_at",
        order_by: leadParam["order_by"] ?? "desc",
      };
    }

    return this.http.get<any>("leads", { params }).pipe(
      map((response) => {
        return response;
      }),
      tap((data) => {})
    );
  }

  getLeadsByUserId(
    user_id: string,
    searchField: string,
    pageIndex: number = 1,
    pageSize: number = 10
  ) {
    const params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
      sort_by: "created_at",
      order_by: "desc",
      search_field: searchField,
      search_value: user_id,
    };

    return this.http.get<any>("leads", { params }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getLeadsComments(leadData: any) {
    let params = new URLSearchParams();
    for (let key in leadData) {
      if (leadData[key] != "" && leadData[key] != null) {
        params.set(key, leadData[key]);
      }
    }

    return this.http
      .get<any>(
        `reports/leads/comments?` +
          params.toString() +
          "&limit=100&sorted_by=created_at&order_by=desc"
      )
      .pipe(
        map((response) => {
          return response;
        })
      );
  }

  getLeadsFiles(fileData: any) {
    let params = new URLSearchParams();
    for (let key in fileData) {
      if (fileData[key] != "" && fileData[key] != null) {
        params.set(key, fileData[key]);
      }
    }

    return this.http
      .get<any>(
        `reports/leads/files?` +
          params.toString() +
          "&limit=100&sorted_by=created_at&order_by=desc"
      )
      .pipe(
        map((response) => {
          return response;
        })
      );
  }

  getLeadsTasks(leadData: any) {
    let params = new URLSearchParams();
    for (let key in leadData) {
      if (leadData[key] != "" && leadData[key] != null) {
        params.set(key, leadData[key]);
      }
    }

    return this.http
      .get<any>(
        `reports/leads/tasks?` +
          params.toString() +
          "&limit=100&sorted_by=created_at&order_by=desc"
      )
      .pipe(
        map((response) => {
          return response;
        })
      );
  }

  getLeadsReport(pageIndex: number = 1, pageSize: number = 10, leadData: any) {
    let params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
      sort_by: "created_at",
      order_by: "desc",
    };

    for (let key in leadData) {
      if (leadData[key] != "" && leadData[key] != null) {
        params[key] = leadData[key];
      }
    }

    return this.http.get<any>(`reports/leads/advanced-search`, { params }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getClientLeads(
    data: any = null,
    pageIndex: number = 1,
    pageSize: number = 10
  ) {
    let params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
      sort_by: "created_at",
      order_by: "desc",
    };

    return this.http
      .get<any>("clients/" + data?.client_id + "/leads", { params })
      .pipe(
        map((response) => {
          return response;
        })
      );
  }

  getLead(lead_id: string) {
    return this.http.get<Lead>("leads/" + lead_id).pipe(
      map((response) => {
        return response;
      })
    );
  }

  addLead(lead: Lead) {
    return this.http.post("leads", lead).pipe(
      map((response) => {
        return response;
      })
    );
  }

  addLeads(leads: Lead[], delayMs: number) {
    return from(leads).pipe(
      concatMap((lead) =>
        timer(delayMs).pipe(concatMap(() => this.addLead(lead)))
      )
    );
  }

  updateLead(lead: Lead) {
    return this.http.put("leads/" + lead.id, { ...lead }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  /** Send only the fields explicitly provided — no class defaults leaking in. */
  patchLead(leadId: string, fields: Record<string, any>) {
    return this.http.put<any>("leads/" + leadId, fields).pipe(
      map((response) => response)
    );
  }

  deleteLead(id: string) {
    return this.http.delete<any>("leads/" + id).pipe(
      map((response) => {
        return response;
      })
    );
  }

  addTasks(leadTask: LeadTask, lead_id: string) {
    return this.http.post("leads/" + lead_id + "/tasks", leadTask).pipe(
      map((response) => {
        return response;
      })
    );
  }

  updateLeadTask(leadTask: LeadTask) {
    return this.http.put("leads/tasks/" + leadTask.id, { ...leadTask }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteLeadTask(id: string) {
    return this.http.delete<any>("leads/tasks/" + id).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getLeadTasks(lead_id: string, pageIndex: number = 1, pageSize: number = 10) {
    let params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
      sort_by: "created_at",
      order_by: "desc",
    };

    return this.http.get<any>("leads/" + lead_id + "/tasks", { params }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getLeadFiles(lead_id: string, pageIndex: number = 1, pageSize: number = 10) {
    let params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
      sort_by: "created_at",
      order_by: "desc",
    };

    return this.http.get<any>("leads/" + lead_id + "/files", { params }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  saveLeadFiles(data: any, lead_id: string) {
    const formData = new FormData();
    formData.append("file", data.file, data.file.name);
    formData.append("file_name", data.file_name);
    formData.append("description", data.description);

    return this.http.post("leads/" + lead_id + "/files", formData).pipe(
      map((response) => {
        return response;
      })
    );
  }

  updateLeadFiles(data: any, file_id: string) {
    return this.http.put("leads/files/" + file_id, data).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteLeadFiles(file_id: string) {
    return this.http.delete<any>("leads/files/" + file_id).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getLeadComments(
    lead_id: string,
    pageIndex: number = 1,
    pageSize: number = 10
  ) {
    let params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
      sort_by: "created_at",
      order_by: "desc",
    };

    return this.http
      .get<any>("leads/" + lead_id + "/comments", { params })
      .pipe(
        map((response) => {
          return response;
        })
      );
  }

  addLeadComments(data: any, lead_id: string) {
    return this.http.post("leads/" + lead_id + "/comments", data).pipe(
      map((response) => {
        return response;
      })
    );
  }

  updateLeadComments(data: any, comment_id: string) {
    return this.http.put("leads/comments/" + comment_id, { ...data }).pipe(
      map((response) => {
        console.log(response);
        return response;
      })
    );
  }

  deleteLeadComment(id: string) {
    return this.http.delete<any>("leads/comments/" + id).pipe(
      map((response) => {
        return response;
      })
    );
  }

  recordOutcome(lead_id: string, outcome: LeadOutcomeCreate) {
    return this.http.post<LeadOutcome>("leads/" + lead_id + "/outcomes", outcome).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getLeadOutcomes(lead_id: string) {
    return this.http.get<LeadOutcome[]>("leads/" + lead_id + "/outcomes").pipe(
      map((response) => {
        return response;
      })
    );
  }

  convertLead(leadId: string, data?: any): Observable<any> {
    return this.http.post<any>("leads/" + leadId + "/convert", data || {}).pipe(
      tap((result: any) => {
        // Automatically create a client portal account
        // when a lead is converted to a client.
        this.portalAccountService.createPortalAccountFromConversion(result);
      }),
    );
  }
}
