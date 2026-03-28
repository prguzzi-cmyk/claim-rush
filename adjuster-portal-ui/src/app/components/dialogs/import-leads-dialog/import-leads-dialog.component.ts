import { DatePipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Lead } from 'src/app/models/lead.model';
import { User } from 'src/app/models/user.model';
import { LeadService } from 'src/app/services/leads.service';
import { UserService } from 'src/app/services/user.service';
import * as Papa from 'papaparse';
import { NgxSpinnerService } from 'ngx-spinner';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

@Component({
    selector: 'app-import-leads-dialog',
    templateUrl: './import-leads-dialog.component.html',
    styleUrls: ['./import-leads-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ImportLeadsDialogComponent implements OnInit {
    action: string = 'add';
    fileUploadFormDisabled: boolean = false;

    filename: string | undefined;
    file: File | undefined;
    fileType: string | undefined;
    role: string;
    user: User;
    importCount: number = 0;
    processed: number = 0;

    leadCsvData: any;

    public leadArray: Lead[] = [];
    lead: any;

    constructor(
        private dialogRef: MatDialogRef<ImportLeadsDialogComponent>,
        private snackBar: MatSnackBar,
        private leadService: LeadService,
        private userService: UserService,
        public datepipe: DatePipe,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        this.role = localStorage.getItem('role-name');
        if (data) {
            this.action = data.type;
            this.getUser();
        }
    }

    ngOnInit(): void {}

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
            this.importCount = csvToRowArray.length - 1; //exclude first row
        };
    }

    importLeads() {
        var reader = new FileReader();

        reader.readAsText(this.file);
        reader.onload = (event: any) => {
            var data = event.target.result; // Content of CSV file

            // Parse the CSV content
            Papa.parse(data, {
                complete: async (result) => {
                    // The data in 'result.data' is now an array of arrays or objects (depending on your parse settings)
                    this.fileUploadFormDisabled = true;
                    this.leadCsvData = result.data;
                    let csvToRowArray = result.data;
                    for (
                        let index = 1;
                        index < csvToRowArray.length - 1;
                        index++
                    ) {
                        let row = csvToRowArray[index];
                        await this.saveLead(row);
                    }

                    delay(5000);
                    this.dialogRef.close();
                    this.fileUploadFormDisabled = false;
                },
                header: false, // Set to false if you want an array of arrays, or true for an array of objects
            });
        };
    }

    async saveLead(row: any) {
        let leadData = new Lead();

        leadData.loss_date = this.datepipe.transform(
            row[2],
            'yyyy-MM-dd HH:mm:ss'
        );
        leadData.peril = '';
        leadData.insurance_company = '';
        leadData.policy_number = '';
        leadData.claim_number = '';
        leadData.source = 'company';
        leadData.status = 'callback';
        leadData.source_info = '';
        leadData.instructions_or_notes = row[11];
        leadData.assigned_to = this.user.id;
        leadData.can_be_removed = true;

        leadData.contact = {
            full_name: row[3] + ' ' + row[4],
            full_name_alt: '',
            phone_number: row[5],
            phone_number_alt: '',
            address: row[6],
            city: row[7],
            state: row[8],
            zip_code: row[9],
            address_loss: row[6],
            city_loss: row[7],
            state_loss: row[8],
            zip_code_loss: row[9],
        };

        const promise = new Promise<void>((resolve, reject) => {
            this.leadService.addLead(leadData).subscribe({
                next: async (lead: any) => {
                    this.lead = lead;
                    this.processed++;

                    if (row[15] != '') {
                        await this.addComments(row[15], lead.id);
                    }

                    if (row[16] != '') {
                        this.addComments(row[16], lead.id);
                    }

                    if (row[17] != '') {
                        this.addComments(row[17], lead.id);
                    }

                    if (row[18] != '') {
                        this.addComments(row[16], lead.id);
                    }

                    if (row[19] != '') {
                        this.addComments(row[16], lead.id);
                    }

                    resolve();
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

    async addComments(comment: string, lead_id: string) {
        let data = {
            text: comment,
            can_be_removed: true,
        };

        const promise = new Promise<void>((resolve, reject) => {
            this.leadService.addLeadComments(data, lead_id).subscribe({
                next: (lead: any) => {
                    resolve();
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
