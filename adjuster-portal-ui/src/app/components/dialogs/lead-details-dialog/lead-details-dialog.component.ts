import { LeadService } from 'src/app/services/leads.service';
import { Component, Inject, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Lead } from 'src/app/models/lead.model';
import { NgxSpinnerService } from 'ngx-spinner';
import { UserService } from 'src/app/services/user.service';
import { User } from 'src/app/models/user.model';
import { DatePipe } from '@angular/common';
import { NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { UsStatesService } from 'src/app/services/us-states.service';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map, startWith } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { TabService } from 'src/app/services/tab.service';
import { ClientService } from 'src/app/services/client.service';

@Component({
    selector: 'app-lead-details-dialog',
    templateUrl: './lead-details-dialog.component.html',
    styleUrls: ['./lead-details-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class LeadDetailsDialogComponent implements OnInit {
    type: string = 'add';
    title: string = 'Add new lead';

    selectedAgent:
        | { id: number; first_name: string; last_name: string }
        | undefined;

    model: NgbDateStruct;
    statuses: string[] = [
        'callback',
        'not-interested',
        'signed',
        'transfer',
        'not-qualified',
        'interested',
        'pending-sign',
    ];
    sources: string[] = ['self', 'company', 'other'];
    closeResult = '';
    leadFormDisabled: boolean = false;

    states: any[] = [];
    stateService: any = inject(UsStatesService);

    lead: Lead;
    leads: any;

    lead_id: string = null;
    agent: User;
    agents: any[] = [];

    user: User;
    role: string;

    // Stabilization fix (2026-05-07): Validators.required removed from
    // sourceByControl + assignedToControl. The backend (LeadCreate) treats
    // both `source` and `assigned_to` as optional UUID | None. The previous
    // client-side gate blocked submit even though the request would have
    // been accepted. uuidValidator stays so a non-UUID typed value still
    // fails validation; empty values are now accepted.
    sourceByControl = new FormControl('', [
        this.uuidValidator,
    ]);
    assignedToControl = new FormControl('', [
        this.uuidValidator,
    ]);

    filteredSourceBy!: Observable<any[]>;
    filteredAssignedtoAgents!: Observable<any[]>;

    // Stabilization fix (2026-05-07): client-side required-validators
    // tightened to match the actual backend contract (LeadCreate +
    // LeadContactCreate). Backend requires only contact.full_name and
    // contact.phone_number; everything else is optional. Status defaults
    // to 'callback' (matches LeadStatusCreate enum default) so the
    // dropdown is pre-selected and submission isn't blocked when the
    // user doesn't change it. Format validators (Validators.email,
    // Validators.pattern) are preserved — those still flag bad input.
    public leadForm = new FormGroup({
        lossDate: new FormControl(''),
        peril: new FormControl(''),
        insuranceCompany: new FormControl(''),
        policyNumber: new FormControl(''),
        claimNumber: new FormControl(''),
        status: new FormControl('callback'),
        source: new FormControl(''),
        sourceInfo: new FormControl(''),
        instructionsOrNotes: new FormControl(''),
        assignedTo: new FormControl(''),

        fullName: new FormControl('', [Validators.required]),
        fullNameAlt: new FormControl(''),
        email: new FormControl('', [Validators.email]),
        emailAlt: new FormControl('', [Validators.email]),
        phoneNumber: new FormControl('', [Validators.required]),
        phoneNumberAlt: new FormControl(''),
        city: new FormControl(''),
        address: new FormControl(''),
        state: new FormControl(''),
        zipCode: new FormControl('', [Validators.pattern('\\d{5}')]),

        addressLoss: new FormControl(''),
        cityLoss: new FormControl(''),
        stateLoss: new FormControl(''),
        zipCodeLoss: new FormControl('', Validators.pattern('\\d{5}')),
    });

    constructor(
        private dialogRef: MatDialogRef<LeadDetailsDialogComponent>,
        private spinner: NgxSpinnerService,
        public datepipe: DatePipe,
        private snackBar: MatSnackBar,
        private router: Router,
        private route: ActivatedRoute,
        private tabService: TabService,
        private leadService: LeadService,
        public userService: UserService,
        private clientService: ClientService,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        if (data) {
            this.getUser();
            this.type = data.type;

            if (this.type == 'add') {
                this.getUsers();
            } else if (this.type == 'edit') {
                this.title = data?.lead?.contact?.full_name ?? 'Update lead';
                this.lead_id = data?.lead.id;
                this.getUsers();
            } else if (this.type == 'delete') {
                this.title = this.title =
                    data?.lead?.contact?.full_name ?? 'Delete lead';
                this.lead_id = data?.lead.id;
            }

            if (!this.userService.getUserPermissions('lead', 'create')) {
                return;
            }

            this.states = this.stateService.getStatesList();
        }
    }

    ngOnInit(): void {
        this.getUser();

        this.role = localStorage.getItem('role-name');

        if (this.role == 'super-admin' || this.role == 'admin') {
            this.statuses.push('signed-approved');
        }

        this.filteredSourceBy = this.sourceByControl.valueChanges.pipe(
            startWith(''),
            map((value) => {
                if (value == '') {
                    this.leadForm.controls['source'].setValue(null);
                }
                return this._filterAgents(value);
            })
        );

        this.filteredAssignedtoAgents =
            this.assignedToControl.valueChanges.pipe(
                startWith(''),
                map((value) => {
                    if (value == '') {
                        this.leadForm.controls['assignedTo'].setValue(null);
                    }
                    return this._filterAgents(value);
                })
            );

        // this.leadForm.get('source').valueChanges.subscribe((response) => {
        //     this.sourceByControl.setValidators(null);
        //     this.sourceByControl.updateValueAndValidity();
        // });

        // this.leadForm.get('assignedTo').valueChanges.subscribe((response) => {
        //     this.assignedToControl.setValidators(null);
        //     this.assignedToControl.updateValueAndValidity();
        // });
    }

    private _filterAgents(value: string): any[] {
        if (typeof value !== 'string') {
            return [];
        }

        const filterValue = value ? value : '';

        // If the input is empty, return an empty array to avoid displaying all agents.
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

    displayAgent(agent: any): string {
        return agent ? `${agent.first_name} ${agent.last_name}` : '';
    }

    deleteLead() {
        this.spinner.show();
        this.leadService.deleteLead(this.lead_id).subscribe((response) => {
            this.spinner.hide();
            this.dialogRef.close(true);

            this.snackBar.open('Lead has been deleted.', 'Close', {
                duration: 5000,
                horizontalPosition: 'end',
                verticalPosition: 'bottom',
            });
        });
    }

    getUser() {
        this.userService.currentUser.subscribe((user) => {
            if (user) {
                this.user = user;
            }
        });
    }

    getUsers() {
        if (this.userService.getUserPermissions('user', 'read')) {
            this.userService.getUsers(1, 1000).subscribe((agents) => {
                this.agents = agents.items;
                if (this.lead_id) {
                    this.getLead();
                }
            });
        } else {
            this.agents.push(this.user);
             
            if (this.lead_id) {
                this.getLead();
            }
        }
    }

    saveLead() {
        this.leadForm.markAllAsTouched();

        // Stabilization fix (2026-05-07): the previous "Source by" and
        // "Assigned to" hard-stop snackbars are removed. Both controls
        // still run their uuidValidator (so a non-UUID typed value still
        // blocks submit by failing the .valid check below); empty values
        // are accepted because the backend treats both as optional.
        if (
            this.leadForm.valid &&
            this.sourceByControl.valid &&
            this.assignedToControl.valid
        ) {
            this.leadFormDisabled = true;
            let leadData = new Lead();

            if (this.leadForm.controls['lossDate']?.value != '')
                leadData.loss_date = this.leadForm.controls['lossDate']?.value;

            leadData.peril = this.leadForm.controls['peril'].value;
            leadData.insurance_company =
                this.leadForm.controls['insuranceCompany'].value;
            leadData.policy_number =
                this.leadForm.controls['policyNumber'].value;
            leadData.claim_number = this.leadForm.controls['claimNumber'].value;
            // Stabilization fix (2026-05-07): only assign UUID fields when
            // non-empty. Backend treats source/assigned_to as `UUID | None`
            // — sending "" instead of omitting fails Pydantic UUID parsing.
            const sourceValue = this.leadForm.controls['source'].value;
            if (sourceValue) leadData.source = sourceValue;
            leadData.source_info = this.leadForm.controls['sourceInfo'].value;
            leadData.status = this.leadForm.controls['status'].value;
            leadData.instructions_or_notes =
                this.leadForm.controls['instructionsOrNotes'].value;
            const assignedToValue = this.leadForm.controls['assignedTo'].value;
            if (assignedToValue) leadData.assigned_to = assignedToValue;
            leadData.can_be_removed = true;
            leadData.instructions_or_notes =
                this.leadForm.controls['instructionsOrNotes'].value;

            leadData.contact = {
                full_name: this.leadForm.controls['fullName'].value,
                full_name_alt: this.leadForm.controls['fullNameAlt'].value,
                phone_number: this.leadForm.controls['phoneNumber'].value,
                phone_number_alt:
                    this.leadForm.controls['phoneNumberAlt'].value,
                address: this.leadForm.controls['address'].value,
                city: this.leadForm.controls['city'].value,
                state: this.leadForm.controls['state'].value,
                zip_code: this.leadForm.controls['zipCode'].value,
                address_loss: this.leadForm.controls['addressLoss'].value,
                city_loss: this.leadForm.controls['cityLoss'].value,
                state_loss: this.leadForm.controls['stateLoss'].value,
                zip_code_loss: this.leadForm.controls['zipCodeLoss'].value,
            };

            if (this.leadForm.controls['email'].value != '')
                leadData.contact.email = this.leadForm.controls['email'].value;

            if (this.leadForm.controls['emailAlt'].value != '')
                leadData.contact.email_alt =
                    this.leadForm.controls['emailAlt'].value;

            if (this.lead_id) {
                leadData.id = this.lead_id;
                this.leadService.updateLead(leadData).subscribe(
                    (data) => {
                        this.leadFormDisabled = false;
                        this.leads = data;

                        this.dialogRef.close();

                        if (this.leads?.client_id) {
                            this.snackBar
                                .open(
                                    'Lead has been updated and a new client record has been created for ' +
                                        this.leads?.contact?.full_name +
                                        '.',
                                    'View client',
                                    {
                                        duration: 5000,
                                        horizontalPosition: 'end',
                                        verticalPosition: 'bottom',
                                    }
                                )
                                .afterDismissed()
                                .subscribe(() => {
                                    this.clientService
                                        .getClient(this.leads?.client_id)
                                        .subscribe(
                                            (client) => {
                                                this.spinner.hide();
                                                if (client !== undefined) {
                                                    let id = client.id;
                                                    let name =
                                                        client?.full_name +
                                                        '-' +
                                                        client?.ref_string.slice(
                                                            -3
                                                        );
                                                    this.tabService.addItem({
                                                        id,
                                                        name,
                                                        type: 'client',
                                                    });
                                                }
                                            },
                                            (error) => {
                                                console.log(error);
                                            }
                                        );
                                });
                        } else {
                            this.snackBar
                                .open('Lead has been updated.', 'Close', {
                                    duration: 2000,
                                    horizontalPosition: 'end',
                                    verticalPosition: 'bottom',
                                })
                                .afterDismissed()
                                .subscribe(() => {
                                    this.dialogRef.close();
                                });
                        }
                    },
                    (error) => {
                        this.spinner.hide();
                        this.leadFormDisabled = false;
                        console.log(error);
                        this.leadFormDisabled = false;
                    }
                );
            } else {
                this.leadService.addLead(leadData).subscribe(
                    (data) => {
                        this.leads = data;

                        this.spinner.hide();
                        this.dialogRef.close();

                        this.snackBar
                            .open('Lead has been created', 'Close', {
                                duration: 2000,
                                horizontalPosition: 'end',
                                verticalPosition: 'bottom',
                            })
                            .afterDismissed()
                            .subscribe(() => {
                                this.router.navigateByUrl(
                                    '/app/leads/' + this.leads?.id
                                );
                            });
                    },
                    (error) => {
                        this.spinner.hide();
                        this.leadFormDisabled = false;
                        console.log(error);
                        this.leadFormDisabled = false;
                    }
                );
            }
        } else {
            const invalidControls = this.getInvalidControls(this.leadForm);
            this.snackBar.open(
                `Please complete all required fields. ${invalidControls.join(
                    ', '
                )}`,
                'Close',
                {
                    duration: 10000,
                    horizontalPosition: 'end',
                    verticalPosition: 'bottom',
                }
            );
        }
    }

    getLead() {
        this.spinner.show();
        this.leadService.getLead(this.lead_id).subscribe((lead) => {
            this.spinner.hide();

            if (lead !== undefined) {
                this.lead = lead;
                this.leadForm.controls['lossDate'].patchValue(
                    this.datepipe.transform(lead?.loss_date, 'yyyy-MM-ddThh:mm')
                );
                this.leadForm.controls['peril'].patchValue(lead?.peril);
                this.leadForm.controls['insuranceCompany'].patchValue(
                    lead?.insurance_company
                );
                this.leadForm.controls['policyNumber'].patchValue(
                    lead?.policy_number
                );
                this.leadForm.controls['claimNumber'].patchValue(
                    lead?.claim_number
                );
                this.leadForm.controls['status'].patchValue(lead?.status);
                // this.leadForm.controls['source'].patchValue(lead?.source);
                this.leadForm.controls['sourceInfo'].patchValue(
                    lead?.source_info
                );
                this.leadForm.controls['instructionsOrNotes'].patchValue(
                    lead?.instructions_or_notes
                );
                this.leadForm.controls['assignedTo'].patchValue(
                    lead?.assigned_to
                );
                this.leadForm.controls['fullName'].patchValue(
                    lead?.contact?.full_name
                );
                this.leadForm.controls['fullNameAlt'].patchValue(
                    lead?.contact?.full_name_alt
                );
                this.leadForm.controls['email'].patchValue(
                    lead?.contact?.email
                );
                this.leadForm.controls['emailAlt'].patchValue(
                    lead?.contact?.email_alt
                );
                this.leadForm.controls['phoneNumber'].patchValue(
                    lead?.contact?.phone_number
                );
                this.leadForm.controls['phoneNumberAlt'].patchValue(
                    lead?.contact?.phone_number_alt
                );
                this.leadForm.controls['address'].patchValue(
                    lead?.contact?.address
                );
                this.leadForm.controls['city'].patchValue(lead?.contact?.city);
                this.leadForm.controls['state'].patchValue(
                    lead?.contact?.state
                );
                this.leadForm.controls['zipCode'].patchValue(
                    lead?.contact?.zip_code
                );
                this.leadForm.controls['addressLoss'].patchValue(
                    lead?.contact?.address_loss
                );
                this.leadForm.controls['cityLoss'].patchValue(
                    lead?.contact?.city_loss
                );
                this.leadForm.controls['stateLoss'].patchValue(
                    lead?.contact?.state_loss
                );
                this.leadForm.controls['zipCodeLoss'].patchValue(
                    lead?.contact?.zip_code_loss
                );
                this.leadForm.controls['assignedTo'].patchValue(
                    lead?.assigned_to
                );

                this.leadForm.controls['source'].patchValue(lead?.source);

                this.assignedToControl.setValue(
                    this.agents.find((agent) => agent.id === lead?.assigned_to)
                );
                this.sourceByControl.setValue(
                    this.agents.find((agent) => agent.id === lead?.source)
                );

                if (lead.status == 'signed-approved') {
                    this.leadForm.disable();
                    this.sourceByControl.disable();
                    this.assignedToControl.disable();
                }
            }
        });
    }

    onLeadSourceSelected(event: any) {
        const selectedAgent = event.option.value;
        this.leadForm.get('source')?.setValue(selectedAgent.id);
    }

    onLeadAssignedToSelected(event: any) {
        const selectedAgent = event.option.value;
        this.leadForm.get('assignedTo').setValue(selectedAgent.id);
    }

    uuidValidator(control: FormControl) {
        const uuidPattern =
            /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
        if (!control.value?.id || !uuidPattern.test(control.value.id)) {
            return { invalidUuid: true };
        }
        return null;
    }

    getInvalidControls(form: FormGroup): string[] {
        const invalid = [];
        const controls = form.controls;
        for (const name in controls) {
            if (controls[name].invalid) {
                invalid.push(name);
            }
        }
        return invalid;
    }
}
