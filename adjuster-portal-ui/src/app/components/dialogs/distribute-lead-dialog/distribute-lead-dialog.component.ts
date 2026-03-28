import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LeadDistributionService } from '../../../services/lead-distribution.service';
import { TerritoryService } from '../../../services/territory.service';
import { Territory } from '../../../models/territory.model';
import {
  DistributeLeadRequest,
  DistributionResult,
} from '../../../models/lead-distribution.model';

@Component({
  selector: 'app-distribute-lead-dialog',
  templateUrl: './distribute-lead-dialog.component.html',
  styleUrls: ['./distribute-lead-dialog.component.scss'],
  standalone: false,
})
export class DistributeLeadDialogComponent implements OnInit {
  countyTerritories: Territory[] = [];
  selectedTerritoryId = '';
  selectedLeadType = '';
  distributing = false;
  distributionResult: DistributionResult | null = null;

  leadTypes = [
    { value: 'fire', label: 'Fire' },
    { value: 'hail', label: 'Hail' },
    { value: 'storm', label: 'Storm' },
    { value: 'lightning', label: 'Lightning' },
    { value: 'flood', label: 'Flood' },
    { value: 'theft_vandalism', label: 'Theft / Vandalism' },
  ];

  constructor(
    private leadDistributionService: LeadDistributionService,
    private territoryService: TerritoryService,
    private dialogRef: MatDialogRef<DistributeLeadDialogComponent>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: { lead_id: string },
  ) {}

  ngOnInit(): void {
    this.territoryService.getTerritories().subscribe(
      (data) => {
        this.countyTerritories = data.filter((t) => t.territory_type === 'county');
      }
    );
  }

  distribute(): void {
    if (!this.selectedTerritoryId || !this.selectedLeadType) {
      this.snackBar.open('Please select territory and lead type', 'Close', {
        duration: 3000, horizontalPosition: 'end', verticalPosition: 'bottom',
      });
      return;
    }

    const req: DistributeLeadRequest = {
      lead_id: this.data.lead_id,
      lead_type: this.selectedLeadType,
      territory_id: this.selectedTerritoryId,
    };

    this.distributing = true;
    this.leadDistributionService.distribute(req).subscribe(
      (result) => {
        this.distributing = false;
        this.distributionResult = result;
        this.snackBar.open('Lead distributed successfully', 'Close', {
          duration: 3000, horizontalPosition: 'end', verticalPosition: 'bottom',
        });
      },
      (error) => {
        this.distributing = false;
        const detail = error?.error?.detail || error?.message || 'Unknown error';
        this.snackBar.open('Distribution failed: ' + detail, 'Close', {
          duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom',
        });
      }
    );
  }

  close(): void {
    this.dialogRef.close(this.distributionResult ? true : false);
  }
}
