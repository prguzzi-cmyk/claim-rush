import { Component, Inject, OnInit } from '@angular/core';
import { Territory } from 'src/app/models/territory.model';
import { TerritoryService } from 'src/app/services/territory.service';
import { UsStatesService } from 'src/app/services/us-states.service';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
    selector: 'app-territory-details-dialog',
    templateUrl: './territory-details-dialog.component.html',
    styleUrls: ['./territory-details-dialog.component.scss'],
    standalone: false
})
export class TerritoryDetailsDialogComponent implements OnInit {
    formDisabled: boolean = false;
    type: string = 'add';
    territory: Territory;
    states: any[] = [];

    territoryTypes = [
        { value: 'state', label: 'State' },
        { value: 'county', label: 'County' },
        { value: 'zip', label: 'ZIP Code' },
        { value: 'custom', label: 'Custom' },
    ];

    territoryForm = new FormGroup({
        name: new FormControl('', [Validators.required]),
        territoryType: new FormControl('', [Validators.required]),
        state: new FormControl(''),
        county: new FormControl(''),
        zipCode: new FormControl(''),
        customGeometry: new FormControl(''),
        isActive: new FormControl(true),
    });

    constructor(
        private territoryService: TerritoryService,
        private usStatesService: UsStatesService,
        private dialogRef: MatDialogRef<TerritoryDetailsDialogComponent>,
        private snackBar: MatSnackBar,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        this.states = this.usStatesService.getStatesList();

        if (data) {
            this.type = data.type;

            if (data.territory) {
                this.territory = data.territory;
                this.territoryForm.controls['name'].setValue(this.territory.name);
                this.territoryForm.controls['territoryType'].setValue(this.territory.territory_type);
                this.territoryForm.controls['state'].setValue(this.territory.state);
                this.territoryForm.controls['county'].setValue(this.territory.county);
                this.territoryForm.controls['zipCode'].setValue(this.territory.zip_code);
                this.territoryForm.controls['customGeometry'].setValue(this.territory.custom_geometry);
                this.territoryForm.controls['isActive'].setValue(this.territory.is_active);
            }

            // Prefill from map (create territory from map click)
            if (data.prefill) {
                const p = data.prefill;
                if (p.type) this.territoryForm.controls['territoryType'].setValue(p.type);
                if (p.state) this.territoryForm.controls['state'].setValue(p.state);
                if (p.county) this.territoryForm.controls['county'].setValue(p.county);
                if (p.zipCode) this.territoryForm.controls['zipCode'].setValue(p.zipCode);
                if (p.geometry) this.territoryForm.controls['customGeometry'].setValue(p.geometry);
                if (p.name) this.territoryForm.controls['name'].setValue(p.name);
            }
        }
    }

    ngOnInit(): void {}

    get selectedType(): string {
        return this.territoryForm.controls['territoryType'].value || '';
    }

    addTerritory() {
        this.formDisabled = true;

        let territory = new Territory();
        territory.name = this.territoryForm.controls['name'].value;
        territory.territory_type = this.territoryForm.controls['territoryType'].value;
        territory.state = this.territoryForm.controls['state'].value || null;
        territory.county = this.territoryForm.controls['county'].value || null;
        territory.zip_code = this.territoryForm.controls['zipCode'].value || null;
        territory.custom_geometry = this.territoryForm.controls['customGeometry'].value || null;
        territory.is_active = this.territoryForm.controls['isActive'].value;

        this.territoryService.createTerritory(territory).subscribe(
            () => {
                this.formDisabled = false;
                this.dialogRef.close();
                this.snackBar.open('Territory added', 'Close', {
                    duration: 5000,
                    horizontalPosition: 'end',
                    verticalPosition: 'bottom',
                });
            },
            () => {
                this.formDisabled = false;
            }
        );
    }

    saveTerritory() {
        this.formDisabled = true;

        let territory = { ...this.territory };
        territory.name = this.territoryForm.controls['name'].value;
        territory.territory_type = this.territoryForm.controls['territoryType'].value;
        territory.state = this.territoryForm.controls['state'].value || null;
        territory.county = this.territoryForm.controls['county'].value || null;
        territory.zip_code = this.territoryForm.controls['zipCode'].value || null;
        territory.custom_geometry = this.territoryForm.controls['customGeometry'].value || null;
        territory.is_active = this.territoryForm.controls['isActive'].value;

        this.territoryService.updateTerritory(territory).subscribe(
            () => {
                this.formDisabled = false;
                this.dialogRef.close();
                this.snackBar.open('Territory has been saved', 'Close', {
                    duration: 5000,
                    horizontalPosition: 'end',
                    verticalPosition: 'bottom',
                });
            },
            () => {
                this.formDisabled = false;
            }
        );
    }
}
