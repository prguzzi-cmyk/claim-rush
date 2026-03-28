import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Territory } from 'src/app/models/territory.model';
import { TerritoryService } from 'src/app/services/territory.service';

@Component({
    selector: 'app-territory-assign-dialog',
    templateUrl: './territory-assign-dialog.component.html',
    styleUrls: ['./territory-assign-dialog.component.scss'],
    standalone: false
})
export class TerritoryAssignDialogComponent implements OnInit {
    availableTerritories: Territory[] = [];
    selectedTerritoryIds: string[] = [];
    loading: boolean = true;
    submitting: boolean = false;
    userId: string;
    assignedTerritoryIds: string[];

    constructor(
        private territoryService: TerritoryService,
        private dialogRef: MatDialogRef<TerritoryAssignDialogComponent>,
        private snackBar: MatSnackBar,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        this.userId = data.userId;
        this.assignedTerritoryIds = data.assignedTerritoryIds || [];
    }

    ngOnInit(): void {
        this.territoryService.getTerritories().subscribe(
            (territories) => {
                this.availableTerritories = territories.filter(
                    (t) => t.is_active && !this.assignedTerritoryIds.includes(t.id)
                );
                this.loading = false;
            },
            () => {
                this.loading = false;
            }
        );
    }

    onSelectionChange(event: any) {
        this.selectedTerritoryIds = event.source.selectedOptions.selected.map(
            (o: any) => o.value
        );
    }

    assign() {
        if (this.selectedTerritoryIds.length === 0) return;

        this.submitting = true;
        this.territoryService
            .assignTerritories(this.userId, this.selectedTerritoryIds)
            .subscribe(
                () => {
                    this.submitting = false;
                    this.dialogRef.close(true);
                    this.snackBar.open('Territories assigned', 'Close', {
                        duration: 5000,
                        horizontalPosition: 'end',
                        verticalPosition: 'bottom',
                    });
                },
                () => {
                    this.submitting = false;
                }
            );
    }
}
