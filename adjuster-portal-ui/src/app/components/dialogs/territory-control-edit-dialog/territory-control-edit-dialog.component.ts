import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TerritoryControlService } from '../../../services/territory-control.service';
import {
  StateControlRow,
  CountyControlRow,
  StateCpStatus,
  CountyAgentStatus,
} from '../../../models/territory-control.model';

@Component({
  selector: 'app-territory-control-edit-dialog',
  templateUrl: './territory-control-edit-dialog.component.html',
  styleUrls: ['./territory-control-edit-dialog.component.scss'],
  standalone: false,
})
export class TerritoryControlEditDialogComponent implements OnInit {
  type: 'state' | 'county';
  stateRow: StateControlRow;
  countyRow: CountyControlRow;
  formDisabled = false;

  cpStatuses: StateCpStatus[] = ['available', 'reserved', 'assigned', 'locked'];
  agentStatuses: CountyAgentStatus[] = ['open', 'recruiting', 'full', 'locked'];

  constructor(
    private territoryControlService: TerritoryControlService,
    private dialogRef: MatDialogRef<TerritoryControlEditDialogComponent>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.type = data.type;
    if (this.type === 'state') {
      this.stateRow = { ...data.row };
    } else {
      this.countyRow = { ...data.row };
    }
  }

  ngOnInit(): void {}

  save(): void {
    this.formDisabled = true;
    if (this.type === 'state') {
      this.territoryControlService.saveStateRow(this.stateRow).subscribe(
        () => {
          this.formDisabled = false;
          this.dialogRef.close(true);
          this.snackBar.open('State territory updated', 'Close', {
            duration: 3000, horizontalPosition: 'end', verticalPosition: 'bottom',
          });
        },
        () => {
          this.formDisabled = false;
          this.snackBar.open('Error saving territory', 'Close', {
            duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom',
          });
        }
      );
    } else {
      this.territoryControlService.saveCountyRow(this.countyRow).subscribe(
        () => {
          this.formDisabled = false;
          this.dialogRef.close(true);
          this.snackBar.open('County territory updated', 'Close', {
            duration: 3000, horizontalPosition: 'end', verticalPosition: 'bottom',
          });
        },
        () => {
          this.formDisabled = false;
          this.snackBar.open('Error saving territory', 'Close', {
            duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom',
          });
        }
      );
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
