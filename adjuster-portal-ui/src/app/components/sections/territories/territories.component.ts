import { Component, OnInit } from '@angular/core';
import { TerritoryService } from 'src/app/services/territory.service';
import { Territory } from 'src/app/models/territory.model';
import { TerritoryDetailsDialogComponent } from 'src/app/components/dialogs/territory-details-dialog/territory-details-dialog.component';
import { DialogService } from 'src/app/services/dialog.service';
import { UserService } from 'src/app/services/user.service';
import { TabService } from 'src/app/services/tab.service';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
    selector: 'app-territories',
    templateUrl: './territories.component.html',
    styleUrls: ['./territories.component.scss'],
    standalone: false
})
export class TerritoriesComponent implements OnInit {
    territories: Territory[] = [];

    displayedColumns: string[] = [
        'sn',
        'name',
        'territory_type',
        'state',
        'county',
        'zip_code',
        'is_active',
        'created_at',
        'edit',
    ];

    constructor(
        private territoryService: TerritoryService,
        private dialogService: DialogService,
        public userService: UserService,
        private tabService: TabService,
        private spinner: NgxSpinnerService,
    ) {}

    ngOnInit() {
        this.getTerritories();
    }

    getTerritories() {
        this.territoryService.getTerritories().subscribe(
            (territories) => {
                this.territories = territories;
            },
            () => {
                this.spinner.hide();
            }
        );
    }

    openTerritoryAddDialog() {
        this.dialogService
            .openDialog(TerritoryDetailsDialogComponent, { type: 'add' })
            .subscribe(() => this.getTerritories());
    }

    openTerritoryViewDialog(territory: Territory) {
        this.dialogService
            .openDialog(TerritoryDetailsDialogComponent, {
                type: 'view',
                territory: territory,
            })
            .subscribe(() => this.getTerritories());
    }

    openTerritoryEditDialog(territory: Territory) {
        this.dialogService
            .openDialog(TerritoryDetailsDialogComponent, {
                type: 'edit',
                territory: territory,
            })
            .subscribe(() => this.getTerritories());
    }

    onNavigate(side: string) {
        this.tabService.setSideTitle(side);
    }
}
