import { SelectionModel } from '@angular/cdk/collections';
import { Component, Inject, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinner, NgxSpinnerService } from 'ngx-spinner';
import { Client } from 'src/app/models/client.model';
import { User } from 'src/app/models/user.model';
import { ClaimService } from 'src/app/services/claim.service';
import { ClientService } from 'src/app/services/client.service';
import { UsStatesService } from 'src/app/services/us-states.service';
import { UserService } from 'src/app/services/user.service';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { customEmailValidator } from 'src/app/validators/custom-email-validator';

@Component({
    selector: 'app-client-details-dialog',
    templateUrl: './client-details-dialog.component.html',
    styleUrls: ['./client-details-dialog.component.scss'],
    standalone: false
})
export class ClientDetailsDialogComponent implements OnInit {
    selection = new SelectionModel<Client>(true, []);

    action: string = 'add';
    title: string = 'Add new client';
    client: Client;

    role: string;
    agent: User;
    agents: any[];
    user: User;
    createClaim: boolean = false;

    states: any[] = [];
    stateService: any = inject(UsStatesService);

    clientFormDisabled: boolean = false;

    assignedToControl = new FormControl('', [
        Validators.required,
        this.uuidValidator,
    ]);

    filteredAssignedtoAgents!: Observable<any[]>;

    public clientForm = new FormGroup({
        full_name: new FormControl('', [Validators.required]),
        full_name_alt: new FormControl(''),
        email: new FormControl('', [customEmailValidator()]),
        email_alt: new FormControl(''),
        phone_number: new FormControl('', [Validators.required]),
        phone_number_alt: new FormControl(''),
        city: new FormControl(''),
        address: new FormControl(''),
        state: new FormControl(''),
        zip_code: new FormControl('', [Validators.pattern('\\d{5}')]),
        belongs_to: new FormControl('', [Validators.required]),
        can_be_removed: new FormControl(true),
        organization: new FormControl(),
    });

    public clientBelongsTo = new FormGroup({
        belongs_to: new FormControl('', [Validators.required]),
    });

    constructor(
        private userService: UserService,
        private dialogRef: MatDialogRef<ClientDetailsDialogComponent>,
        private snackBar: MatSnackBar,
        private clientService: ClientService,
        private spinner: NgxSpinnerService,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        this.initialize();
    }

    async initialize() {
        this.getUser();
        this.states = this.stateService.getStatesList();
        this.role = localStorage.getItem('role-name');

        if (this.userService.getUserPermissions('user', 'read')) {
            await this.getUsers();
        }

        if (this.data) {
            this.action = this.data.type;
        }

        if (
            this.action == 'view' ||
            this.action == 'edit' ||
            this.action == 'delete'
        ) {
            this.client = this.data?.client;
            this.clientForm.patchValue(this.client);
            this.assignedToControl.setValue(
                this.agents.find(
                    (agent) => agent.id === this.client?.belongs_to
                )
            );
            this.title = this.client.full_name;
        } else if (this.action == 'multiple') {
            this.selection = this.data?.selection;
            this.title = 'Edit multiple clients';
        } else if (this.action == 'multiple-delete') {
            this.selection = this.data?.selection;
            this.title = 'Delete multiple clients';
        }

        this.filteredAssignedtoAgents =
            this.assignedToControl.valueChanges.pipe(
                startWith(''),
                map((value) => this._filterAgents(value))
            );

        this.clientForm.get('belongs_to').valueChanges.subscribe((response) => {
            this.assignedToControl.setValidators(null);
            this.assignedToControl.updateValueAndValidity();
        });
    }

    ngOnInit(): void {}

    addClient() {
        this.clientFormDisabled = true;

        let client = new Client();
        client.full_name = this.clientForm.controls['full_name'].value;
        client.full_name_alt = this.clientForm.controls['full_name_alt'].value;

        if (this.clientForm.controls['email'].value != '')
            client.email = this.clientForm.controls['email'].value;

        if (this.clientForm.controls['email_alt'].value != '')
            client.email_alt = this.clientForm.controls['email_alt'].value;

        client.phone_number = this.clientForm.controls['phone_number'].value;
        client.phone_number_alt =
            this.clientForm.controls['phone_number_alt'].value;
        client.address = this.clientForm.controls['address'].value;
        client.city = this.clientForm.controls['city'].value;
        client.state = this.clientForm.controls['state'].value;
        client.zip_code = this.clientForm.controls['zip_code'].value;
        client.can_be_removed =
            this.clientForm.controls['can_be_removed'].value;
        client.belongs_to = this.clientForm.controls['belongs_to'].value;
        client.organization = this.clientForm.controls['organization'].value;

        this.clientService.addClient(client).subscribe(
            (client: Client) => {

                this.clientFormDisabled = false;

                if (this.createClaim) {
                    this.dialogRef.close(client);
                } else {
                    this.dialogRef.close();
                }

                this.snackBar.open('Client record created', 'Close', {
                    duration: 5000,
                    horizontalPosition: 'end',
                    verticalPosition: 'bottom',
                });
            },
            (error) => {
                this.clientFormDisabled = false;
            },
            () => {this.clientFormDisabled = false;}
        );
    }

    updateClient() {
        this.clientFormDisabled = true;

        let client = new Client();
        client.id = this.client.id;
        client.full_name = this.clientForm.controls['full_name'].value;
        client.full_name_alt = this.clientForm.controls['full_name_alt'].value;
        client.email = this.clientForm.controls['email'].value;
        client.email_alt = this.clientForm.controls['email_alt'].value;
        client.phone_number = this.clientForm.controls['phone_number'].value;
        client.phone_number_alt =
            this.clientForm.controls['phone_number_alt'].value;
        client.address = this.clientForm.controls['address'].value;
        client.city = this.clientForm.controls['city'].value;
        client.state = this.clientForm.controls['state'].value;
        client.zip_code = this.clientForm.controls['zip_code'].value;
        client.belongs_to = this.clientForm.controls['belongs_to'].value;
        client.can_be_removed =
            this.clientForm.controls['can_be_removed'].value;
        client.organization = this.clientForm.controls['organization'].value;

        this.clientService.updateClient(client).subscribe(() => {
            this.clientFormDisabled = false;
            this.dialogRef.close();

            this.snackBar.open('Client record updated', 'Close', {
                duration: 5000,
                horizontalPosition: 'end',
                verticalPosition: 'bottom',
            });
        },
        (error) => {
            this.clientFormDisabled = false;
        },
        () => {this.clientFormDisabled = false;});
    }

    deleteClient() {
        this.clientFormDisabled = true;

        this.clientService
            .deleteClient(this.client.id)
            .subscribe((result: any) => {
                this.clientFormDisabled = false;
                this.dialogRef.close();
                this.snackBar.open('Client has been deleted', 'Close', {
                    duration: 5000,
                    horizontalPosition: 'end',
                    verticalPosition: 'bottom',
                });
            });
    }

    updateMultiple() {
        let belongsTo = this.clientBelongsTo.controls['belongs_to'].value;
        this.spinner.show();
        var promise = new Promise((resolve, reject) => {
            this.selection.selected.forEach(async (client, index) => {
                await this.bulkUpdateClient(client.id, belongsTo);
                if (index === this.selection.selected.length - 1) resolve(true);
            });
        });

        promise.then(() => {
            this.spinner.hide();
            this.dialogRef.close();
            this.snackBar.open('Client records updated', 'Close', {
                duration: 5000,
                horizontalPosition: 'end',
                verticalPosition: 'bottom',
            });
        });
    }

    async bulkUpdateClient(client_id: string, belongs_to: string) {
        let client = new Client();

        client.id = client_id;
        client.belongs_to = belongs_to;

        const promise = new Promise<void>((resolve, reject) => {
            this.clientService.updateClient(client).subscribe({
                next: (lead: any) => {
                    resolve();
                },
                error: (err: any) => {
                    reject(err);
                },
                complete: () => {},
            });
        });
        return promise;
    }

    deleteMultiple() {
        this.spinner.show();
        var promise = new Promise((resolve, reject) => {
            this.selection.selected.forEach(async (client, index) => {
                await this.bulkDeleteClient(client.id);
                if (index === this.selection.selected.length - 1) resolve(true);
            });
        });

        promise.then(() => {
            this.spinner.hide();
            this.dialogRef.close();
            this.snackBar.open('Client records deleted.', 'Close', {
                duration: 5000,
                horizontalPosition: 'end',
                verticalPosition: 'bottom',
            });
        });
    }

    async bulkDeleteClient(client_id: string) {
        let client = new Client();

        const promise = new Promise<void>((resolve, reject) => {
            this.clientService.deleteClient(client_id).subscribe({
                next: (lead: any) => {
                    resolve();
                },
                error: (err: any) => {
                    reject(err);
                },
                complete: () => {},
            });
        });
        return promise;
    }
    getUsers(): Promise<void> {
        this.spinner.show();
        return new Promise((resolve, reject) => {
            this.userService.getUsers(1, 500).subscribe(
                (agents) => {
                    this.agents = agents.items;
                    resolve();
                },
                (error) => reject(error)
            );
            this.spinner.hide();
        });
    }

    getUser() {
        this.userService.currentUser.subscribe((user) => {
            if (user) {
                this.user = user;
            }
        });
    }

    toggleCanBeRemoved(event: MatSlideToggleChange) {
        this.clientForm.get('can_be_removed').setValue(event.checked);
    }

    toggleCreateClaim(event: MatSlideToggleChange) {
        this.createClaim = event.checked;
    }

    displayAgent(agent: any): string {
        return agent ? `${agent.first_name} ${agent.last_name}` : '';
    }

    onClientAssignedToSelected(event: any) {
        const selectedAgent = event.option.value;
        this.clientForm.get('belongs_to').setValue(selectedAgent.id);
    }

    private _filterAgents(value: string): any[] {
        if (typeof value !== 'string') {
            return [];
        }

        const filterValue = value ? value : '';

        if (!filterValue) {
            return [];
        }

        return this.agents.filter(
            (agent) =>
                agent.first_name
                    .toLowerCase()
                    .startsWith(filterValue?.toLowerCase()) ||
                agent.last_name
                    .toLowerCase()
                    .startsWith(filterValue?.toLowerCase())
        );
    }

    uuidValidator(control: FormControl) {
        const uuidPattern =
            /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
        if (!control.value.id || !uuidPattern.test(control.value.id)) {
            return { invalidUuid: true };
        }
        return null;
    }
}
