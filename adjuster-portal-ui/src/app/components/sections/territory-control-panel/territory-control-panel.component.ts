import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { TerritoryService } from '../../../services/territory.service';
import { TerritoryControlService } from '../../../services/territory-control.service';
import { DialogService } from '../../../services/dialog.service';
import { TabService } from '../../../services/tab.service';
import { TerritoryWithAssignments } from '../../../models/territory.model';
import { TerritoryControlEditDialogComponent } from '../../dialogs/territory-control-edit-dialog/territory-control-edit-dialog.component';

@Component({
  selector: 'app-territory-control-panel',
  templateUrl: './territory-control-panel.component.html',
  styleUrls: ['./territory-control-panel.component.scss'],
  standalone: false,
})
export class TerritoryControlPanelComponent implements OnInit {
  territoriesWithAssignments: TerritoryWithAssignments[] = [];

  // Stats
  totalTerritories = 0;
  availableTerritories = 0;
  takenTerritories = 0;
  totalStates = 0;
  lockedStates = 0;
  assignedStates = 0;
  totalCounties = 0;
  lockedCounties = 0;
  fullCounties = 0;

  constructor(
    private territoryService: TerritoryService,
    private territoryControlService: TerritoryControlService,
    private dialogService: DialogService,
    private spinner: NgxSpinnerService,
    private snackBar: MatSnackBar,
    private tabService: TabService,
  ) {}

  ngOnInit(): void {
    this.loadTerritories();
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  loadTerritories(): void {
    this.spinner.show();
    this.territoryService.getTerritoriesWithAssignments().subscribe(
      (data) => {
        console.log('[TerritoryControl] API response:', data.length, 'records');
        console.log('[TerritoryControl] CP assigned:', data.filter((t: any) => t.chapter_president).length);
        console.log('[TerritoryControl] No CP:', data.filter((t: any) => !t.chapter_president).length);
        this.territoriesWithAssignments = data;
        this.computeStats();
        console.log('[TerritoryControl] Stats → total:', this.totalTerritories, 'available:', this.availableTerritories, 'taken:', this.takenTerritories, 'cpAssigned:', this.assignedStates);
        this.spinner.hide();
      },
      (error) => {
        this.spinner.hide();
        this.snackBar.open('Error loading territories: ' + (error?.message || 'Unknown'), 'Close', {
          duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom',
        });
      }
    );
  }

  private computeStats(): void {
    const all = this.territoriesWithAssignments;
    const states = all.filter((t) => t.territory_type === 'state');
    const counties = all.filter((t) => t.territory_type === 'county');

    // Use territory_status from the backend — single source of truth
    // Matches the same logic used by the public territories endpoint
    const isTaken = (t: TerritoryWithAssignments) =>
      t.territory_status === 'Locked' || t.territory_status === 'Full' || t.territory_status === 'CP Assigned';

    this.totalTerritories = all.length;
    this.takenTerritories = all.filter(isTaken).length;
    this.availableTerritories = all.filter((t) => t.territory_status === 'Available').length;

    // State-level
    this.totalStates = states.length;
    this.lockedStates = states.filter((t) => t.territory_status === 'Locked').length;
    this.assignedStates = states.filter((t) => t.territory_status === 'CP Assigned').length;

    // County-level
    this.totalCounties = counties.length;
    this.lockedCounties = counties.filter((t) => t.territory_status === 'Locked').length;
    this.fullCounties = counties.filter((t) => t.territory_status === 'Full').length;
  }

  onTerritoryClicked(territory: TerritoryWithAssignments): void {
    if (territory.territory_type === 'state') {
      const row = this.territoryControlService.buildStateRow(territory);
      this.dialogService.openDialog(
        TerritoryControlEditDialogComponent,
        { type: 'state', row },
        { width: '550px' },
      ).subscribe((result) => {
        if (result) {
          this.loadTerritories();
        }
      });
    } else if (territory.territory_type === 'county') {
      const row = this.territoryControlService.buildCountyRow(territory);
      this.dialogService.openDialog(
        TerritoryControlEditDialogComponent,
        { type: 'county', row },
        { width: '550px' },
      ).subscribe((result) => {
        if (result) {
          this.loadTerritories();
        }
      });
    }
  }

  /** Auto-create a territory record when clicking a state/county that has none */
  onCreateTerritory(data: any): void {
    const newTerritory: any = {
      name: data.name,
      territory_type: data.type,
      state: data.state,
      is_active: true,
    };

    if (data.type === 'county') {
      newTerritory.county = data.county;
      newTerritory.max_adjusters = 3;
    }

    if (data.type === 'custom') {
      newTerritory.custom_geometry = data.geometry;
    }

    this.spinner.show();
    this.territoryService.createTerritory(newTerritory).subscribe(
      (created) => {
        this.snackBar.open(`Territory "${created.name}" created`, 'Close', {
          duration: 3000, horizontalPosition: 'end', verticalPosition: 'bottom',
        });
        // Reload to get full assignment data, then open edit dialog
        this.territoryService.getTerritoriesWithAssignments().subscribe(
          (all) => {
            this.territoriesWithAssignments = all;
            this.computeStats();
            this.spinner.hide();
            const newT = all.find((t) => t.id === created.id);
            if (newT) {
              this.onTerritoryClicked(newT);
            }
          },
          () => {
            this.spinner.hide();
          }
        );
      },
      (error) => {
        this.spinner.hide();
        const detail = error?.error?.detail || error?.message || 'Unknown error';
        this.snackBar.open('Error creating territory: ' + detail, 'Close', {
          duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom',
        });
      }
    );
  }
}
