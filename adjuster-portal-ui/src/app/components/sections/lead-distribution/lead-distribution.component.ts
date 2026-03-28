import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { LeadDistributionService } from '../../../services/lead-distribution.service';
import { LeadService } from '../../../services/leads.service';
import { TerritoryService } from '../../../services/territory.service';
import { TabService } from '../../../services/tab.service';
import { Territory, TerritoryGroupedByState } from '../../../models/territory.model';
import {
  DistributeLeadRequest,
  DistributionResult,
  LeadDistributionHistory,
  TerritoryRotationState,
} from '../../../models/lead-distribution.model';

@Component({
  selector: 'app-lead-distribution',
  templateUrl: './lead-distribution.component.html',
  styleUrls: ['./lead-distribution.component.scss'],
  standalone: false,
})
export class LeadDistributionComponent implements OnInit {
  territories: Territory[] = [];
  groupedTerritories: TerritoryGroupedByState[] = [];

  // Distribute form
  selectedTerritoryId = '';
  selectedLeadType = '';
  leadId = '';
  distributing = false;
  distributionResult: DistributionResult | null = null;

  // Lead search autocomplete
  leadSearchControl = new FormControl('');
  filteredLeads: any[] = [];
  selectedLead: any = null;
  leadSearchLoading = false;

  leadTypes = [
    { value: 'fire', label: 'Fire' },
    { value: 'hail', label: 'Hail' },
    { value: 'storm', label: 'Storm' },
    { value: 'lightning', label: 'Lightning' },
    { value: 'flood', label: 'Flood' },
    { value: 'theft_vandalism', label: 'Theft / Vandalism' },
  ];

  // History table
  historyData: LeadDistributionHistory[] = [];
  historyColumns: string[] = ['lead_type', 'territory_id', 'assigned_agent_id', 'distributed_at'];

  // Rotation state
  rotationState: TerritoryRotationState | null = null;

  constructor(
    private leadDistributionService: LeadDistributionService,
    private leadService: LeadService,
    private territoryService: TerritoryService,
    private spinner: NgxSpinnerService,
    private snackBar: MatSnackBar,
    private tabService: TabService,
  ) {}

  ngOnInit(): void {
    this.loadTerritories();

    this.leadSearchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((value) => {
        if (!value || typeof value !== 'string' || value.length < 2) {
          this.filteredLeads = [];
          return of(null);
        }
        this.leadSearchLoading = true;
        return this.leadService.searchLeads(1, 10, value);
      })
    ).subscribe((response: any) => {
      this.leadSearchLoading = false;
      this.filteredLeads = response?.items || response?.data || [];
    });
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  loadTerritories(): void {
    this.territoryService.getTerritoriesGrouped().subscribe(
      (data) => {
        this.groupedTerritories = data;
        // Flatten counties into territories for getTerritoryName() lookups
        this.territories = data.reduce((acc: Territory[], group) => acc.concat(group.counties), []);
      },
      () => {
        this.snackBar.open('Error loading territories', 'Close', {
          duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom',
        });
      }
    );
  }

  onTerritoryChange(): void {
    if (!this.selectedTerritoryId) {
      this.historyData = [];
      this.rotationState = null;
      return;
    }
    this.loadHistory();
    this.loadRotationState();
  }

  loadHistory(territoryId?: string): void {
    const id = territoryId || this.selectedTerritoryId;
    if (!id) return;
    this.leadDistributionService.getHistoryByTerritory(id).subscribe(
      (data) => {
        this.historyData = data;
      },
      () => {
        this.historyData = [];
      }
    );
  }

  loadRotationState(territoryId?: string): void {
    const id = territoryId || this.selectedTerritoryId;
    if (!id) return;
    this.leadDistributionService.getRotationState(id).subscribe(
      (data) => {
        this.rotationState = data;
      },
      () => {
        this.rotationState = null;
      }
    );
  }

  displayLead = (lead: any): string => {
    return lead?.ref_string
      ? 'REF-' + lead.ref_string + ' – ' + (lead.contact?.full_name || 'No Contact')
      : '';
  };

  onLeadSelected(event: MatAutocompleteSelectedEvent): void {
    this.selectedLead = event.option.value;
    this.leadId = event.option.value.id;
  }

  distribute(): void {
    if (!this.selectedTerritoryId || !this.selectedLeadType || !this.selectedLead) {
      this.snackBar.open('Please select a territory, lead type, and lead', 'Close', {
        duration: 3000, horizontalPosition: 'end', verticalPosition: 'bottom',
      });
      return;
    }

    const req: DistributeLeadRequest = {
      lead_id: this.leadId,
      lead_type: this.selectedLeadType,
      territory_id: this.selectedTerritoryId,
    };

    const territoryId = this.selectedTerritoryId;
    this.distributing = true;
    this.distributionResult = null;

    this.leadDistributionService.distribute(req).subscribe(
      (result) => {
        this.distributing = false;
        this.distributionResult = result;
        this.snackBar.open('Lead distributed successfully', 'Close', {
          duration: 3000, horizontalPosition: 'end', verticalPosition: 'bottom',
        });
        this.loadHistory(territoryId);
        this.loadRotationState(territoryId);
      },
      (error) => {
        this.distributing = false;
        this.snackBar.open(this.getErrorMessage(error), 'Close', {
          duration: 7000, horizontalPosition: 'end', verticalPosition: 'bottom',
        });
      }
    );
  }

  getTerritoryName(territoryId: string): string {
    const t = this.territories.find((ter) => ter.id === territoryId);
    return t ? t.name : territoryId;
  }

  private getErrorMessage(error: any): string {
    const detail = error?.error?.detail;
    if (detail) return detail;
    if (error?.status === 0) return 'Unable to reach the server. Check your connection.';
    if (error?.status === 403) return 'You do not have permission to distribute leads.';
    return error?.message || 'An unexpected error occurred.';
  }
}
