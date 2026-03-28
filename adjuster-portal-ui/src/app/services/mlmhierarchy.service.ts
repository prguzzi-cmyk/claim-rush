import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { User } from "../models/user.model";
import { BehaviorSubject, Observable, throwError, of } from "rxjs";
import { map, catchError } from "rxjs/operators";
import {TeamHierarchy} from "../models/team-hierarchy.model";

@Injectable({
  providedIn: "root",
})
export class MlmHierarchyService {
  private orgHierarchySubject: BehaviorSubject<TeamHierarchy> = new BehaviorSubject<any>("");

  constructor(private http: HttpClient) { }

  saveTeamMember(hierarchy: TeamHierarchy) {
    return this.http.post<any>("mlm/v1/hierarchy", hierarchy).pipe(
        map((data) => {
          this.orgHierarchySubject.next(data);
          return data;
        })
    );
  }

    getHierarchyByUserId(userId: string) {
        return this.http.get<any>(`mlm/v1/team-hierarchy/${userId}`).pipe(
            map((data) => {
                this.orgHierarchySubject.next(data);
                return data;
            })
        );
    }

    getMyRecruits(userId: string) {
        return this.http.get<any>(`mlm/v1/my-recruits/${userId}`).pipe(
            map((data) => {
                this.orgHierarchySubject.next(data);
                return data;
            })
        );
    }

    deleteNodeFromOrg(userId: string) {
        return this.http.delete<any>(`mlm/v1/hierarchy/${userId}`).pipe(
            map((data) => {
                this.orgHierarchySubject.next(data);
                return data;
            })
        );
    }

    syncOrgChartFromCRM() {
        return this.http.post<any>(`mlm/v1/sync/from-crm`, {}).pipe(
            map((data) => {
                this.orgHierarchySubject.next(data);
                return data;
            })
        );
    }
}
