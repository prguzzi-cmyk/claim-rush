import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Territory, TerritoryGroupedByState, TerritoryWithAssignments, UserTerritoryInfo } from '../models/territory.model';

@Injectable({
    providedIn: 'root',
})
export class TerritoryService {
    constructor(private http: HttpClient) {}

    getTerritories() {
        return this.http.get<Territory[]>('territories').pipe(
            map((response) => {
                return response;
            })
        );
    }

    createTerritory(territory: Territory) {
        return this.http.post<Territory>('territories', territory);
    }

    updateTerritory(territory: Territory) {
        return this.http.put<Territory>('territories/' + territory.id, { ...territory }).pipe(
            map((response) => {
                return response;
            })
        );
    }

    getUserTerritories(userId: string) {
        return this.http.get<UserTerritoryInfo>('territories/users/' + userId).pipe(
            map((response) => {
                return response;
            })
        );
    }

    assignTerritories(userId: string, territoryIds: string[]) {
        return this.http.post('territories/users/' + userId + '/assign', {
            territory_ids: territoryIds,
        });
    }

    removeTerritories(userId: string, territoryIds: string[]) {
        return this.http.post('territories/users/' + userId + '/remove', {
            territory_ids: territoryIds,
        });
    }

    setNationalAccess(userId: string, nationalAccess: boolean) {
        return this.http.put('territories/users/' + userId + '/national-access', {
            national_access: nationalAccess,
        });
    }

    getTerritoriesGrouped() {
        return this.http.get<TerritoryGroupedByState[]>('territories/grouped');
    }

    getTerritoriesWithAssignments() {
        return this.http.get<TerritoryWithAssignments[]>('territories/with-assignments');
    }
}
