import { DatePipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { delay } from 'rxjs/internal/operators/delay';
import { Claim } from 'src/app/models/claim.model';
import { Client } from 'src/app/models/client.model';
import { User } from 'src/app/models/user.model';
import { ClaimService } from 'src/app/services/claim.service';
import { ClientService } from 'src/app/services/client.service';
import { UserService } from 'src/app/services/user.service';
import * as Papa from 'papaparse';
const delay1 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

@Component({
    selector: 'app-import-claims-dialog',
    templateUrl: './import-claims-dialog.component.html',
    styleUrls: ['./import-claims-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ImportClaimsDialogComponent implements OnInit {
    action: string = 'add';
    fileUploadFormDisabled: boolean = false;

    filename: string | undefined;
    file: File | undefined;
    fileType: string | undefined;
    role: string;
    user: User;
    importCount: number = 0;
    processed: number = 0;

    public claimArray: Claim[] = [];
    claim: any;

    constructor(
        private dialogRef: MatDialogRef<ImportClaimsDialogComponent>,
        private snackBar: MatSnackBar,
        private clientService: ClientService,
        private claimService: ClaimService,
        private userService: UserService,
        public datepipe: DatePipe,
        private spinner: NgxSpinnerService,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        this.role = localStorage.getItem('role-name');
        if (data) {
            this.action = data.type;
            this.getUser();
        }
    }

    ngOnInit(): void { }

    getUser() {
        this.userService.currentUser.subscribe((user) => {
            if (user) {
                this.user = user;
            }
        });
    }

    selectFile(event: any) {
        this.file = event.target.files[0];
        this.filename = this.file?.name;
        this.fileType = this.file?.type;

        var reader = new FileReader();

        reader.readAsText(this.file);
        reader.onload = (event: any) => {
            var data = event.target.result; // Content of CSV file

            let csvToRowArray = data.split('\n');
            this.importCount = csvToRowArray?.length - 1;
        };
    }

    importClaims() {
        this.spinner.show();
        this.fileUploadFormDisabled = true;

        var reader = new FileReader();

        reader.readAsText(this.file);
        reader.onload = (event: any) => {
            var data = event.target.result; // Content of CSV file

            // Parse the CSV content
            Papa.parse(data, {
                complete: async (result) => {
                    // The data in 'result.data' is now an array of arrays or objects (depending on your parse settings)
                    this.fileUploadFormDisabled = true;
                    let csvToRowArray = result.data;
                    for (
                        let index = 1;
                        index < csvToRowArray?.length - 1;
                        index++
                    ) {
                        let row = csvToRowArray[index];
                        this.processed++;

                        let searchValue = '';
                        let searchField = 'email';

                        if (row[8].trim() != '') {
                            searchValue = row[8].trim();
                        } else {
                            searchField = 'phone';
                            searchValue = row[7].split(' ')[0];
                        }


                        await this.searchClients(searchValue, searchField).then(
                            (clients: any) => {

                                if (clients.length > 0) {
                                    this.saveClaim(row, clients[0].id);
                                } else {
                                    this.createClient(row).then((client: any) => {
                                        this.saveClaim(row, client.id);
                                    });;
                                }
                            },
                            (err) => {
                                console.error(err)
                            }
                        );

                        //
                    }

                    delay1(5000);
                    this.dialogRef.close();
                    this.fileUploadFormDisabled = false;
                },
                header: false, // Set to false if you want an array of arrays, or true for an array of objects
            });
        };
    }

    async saveClaim(row: any, client_id: any) {
        let claimData = new Claim();

        const parts = row[10].split('/').map((part) => parseInt(part, 10));
        let loss_date = new Date(parts[2], parts[1] - 1, parts[0]);

        claimData.loss_date = this.datepipe.transform(
            loss_date,
            'yyyy-MM-ddThh:mm'
        );

        claimData.peril = row[11];
        claimData.insurance_company = row[17];
        claimData.policy_type = row[18];
        claimData.policy_number = row[19];
        claimData.claim_number = row[20];

        const parts_date_logged = row[21].split('/').map((part) => parseInt(part, 10));
        let date_logged = new Date(parts_date_logged[2], parts_date_logged[1] - 1, parts_date_logged[0]);

        claimData.date_logged = this.datepipe.transform(
            date_logged,
            'yyyy-MM-dd'
        );

        claimData.source_info = 'company';

        if (row[4] == 'Closed w/o Pay') {
            claimData.current_phase = 'claim-closed';
        } else if (row[4] == 'OpenPhase: Negotiation') {
            claimData.current_phase = 'scope';
        } else if (row[4] == 'OpenPhase: Initial Payment') {
            claimData.current_phase = 'initial-payment-received';
        } else if (row[4] == 'OpenPhase: Litigation') {
            claimData.current_phase = 'mediation';
        } else if (row[4] == 'Settled') {
            claimData.current_phase = 'claim-closed';
        } else if (row[4] == 'OpenPhase: Claim Originated') {
            claimData.current_phase = 'claim-reported';
        } else if (row[4] == 'OpenPhase: Umpire') {
            claimData.current_phase = 'mediation';
        } else if (
            row[4] == 'OpenPhase: Appraisal' ||
            row[4] == 'OpenPhase: Evaluation'
        ) {
            claimData.current_phase = 'scope';
        } else if (row[4] == 'Canceled') {
            claimData.current_phase = 'claim-closed';
        } else {
            claimData.current_phase = 'claim-reported';
        }

        claimData.instructions_or_notes = row[12];
        claimData.assigned_to = this.user.id;
        claimData.client_id = client_id;
        claimData.can_be_removed = true;

        let address = '';
        let city = '';
        let state = '';
        let zip_code = '';

        if (row[9] != '') {
            let addressArray = row[9].split(',');

            address = addressArray[0].split('  ')[0];
            city = addressArray[0].split('  ')[1];
            state = addressArray[1].split(' ')[1];

            if (
                addressArray[1].split(' ')[2] != '' &&
                addressArray[1].split(' ')[2].length == 5
            ) {
                zip_code = addressArray[1].split(' ')[2];
            }
        }

        claimData.claim_contact = {
            address_loss: address,
            city_loss: city,
            state_loss: state,
            zip_code_loss: zip_code,
        };

        if (row[13].trim() != '') {
            claimData.anticipated_amount = row[13].trim().replace(',', '');
        }

        claimData.fee_type = 'percentage';
        claimData.fee = row[14].replace('%', '');

        const promise = new Promise<void>((resolve, reject) => {
            this.claimService.addClaim(claimData).subscribe({
                next: (res: any) => {
                    resolve();
                },
                error: (err: any) => {
                    reject(err);
                },
                complete: () => {
                    this.spinner.hide();
                },
            });
        });
        return promise;
    }

    async createClient(row: any) {
        let client = new Client();
        client.full_name = row[0] + ' ' + row[1];

        if (row[8].trim() != '') client.email = row[8];

        if (row[7] != '') {
            let phoneNumber = row[7].split(' ')[0];
            if (phoneNumber != '') client.phone_number = phoneNumber;
        }

        if (row[9] != '') {
            let addressArray = row[9].split(',');

            client.address = addressArray[0].split('  ')[0];
            client.city = addressArray[0].split('  ')[1];
            client.state = addressArray[1].split(' ')[1];

            if (
                addressArray[1].split(' ')[2] != '' &&
                addressArray[1].split(' ')[2].length == 5
            ) {
                client.zip_code = addressArray[1].split(' ')[2];
            }
        }

        client.belongs_to = this.user.id;

        const promise = new Promise<void>((resolve, reject) => {
            this.clientService.addClient(client).subscribe({
                next: (res: any) => {
                    resolve(res);
                },
                error: (err: any) => {
                    reject(err);
                },
                complete: () => {
                    this.spinner.hide();
                },
            });
        });
        return promise;
    }

    async searchClients(searchValue: any, searchField: any) {
        let clientData: any;
        if (searchField == 'email') {
            clientData = {
                search_field: "email",
                search_value: searchValue,
            };
        }

        if (searchField == 'phone') {
            clientData = {
                search_field: "phone_number",
                search_value: searchValue,
            };
        }

        const promise = new Promise<void>((resolve, reject) => {
            this.clientService.getClients(clientData).subscribe({
                next: (res: any) => {
                    resolve(res);
                },
                error: (err: any) => {
                    reject(err);
                },
                complete: () => {
                },
            });
        });
        return promise;
    }
}
