import { DatePipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { Client } from 'src/app/models/client.model';
import { User } from 'src/app/models/user.model';
import { ClientService } from 'src/app/services/client.service';
import { UserService } from 'src/app/services/user.service';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
import * as Papa from 'papaparse';

@Component({
    selector: 'app-import-clients-dialog',
    templateUrl: './import-clients-dialog.component.html',
    styleUrls: ['./import-clients-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ImportClientsDialogComponent implements OnInit {
    action: string = 'add';
    fileUploadFormDisabled: boolean = false;

    filename: string | undefined;
    file: File | undefined;
    fileType: string | undefined;
    role: string;
    user: User;
    importCount: number = 0;
    processed: number = 0;

    public clientArray: Client[] = [];
    client: any;
    uploading: boolean = false;

    constructor(
        private dialogRef: MatDialogRef<ImportClientsDialogComponent>,
        private snackBar: MatSnackBar,
        private clientService: ClientService,
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

    ngOnInit(): void {}

    getUser() {
        this.spinner.show();
        this.userService.currentUser.subscribe((user) => {
            this.spinner.hide();
            if (user) {
                this.user = user;
            }
        });
    }

    selectFile(event: any) {
        this.fileUploadFormDisabled = false;
        this.file = event.target.files[0];
        this.filename = this.file?.name;
        this.fileType = this.file?.type;

        var reader = new FileReader();

        reader.readAsText(this.file);
        reader.onload = (event: any) => {
            var data = event.target.result; // Content of CSV file

            let csvToRowArray = data.split('\n');
            this.importCount = csvToRowArray.length - 1;
        };
    }

    importClients() {
        this.spinner.show();
        this.fileUploadFormDisabled = true;
        var reader = new FileReader();

        reader.readAsText(this.file);
        reader.onload = async (event: any) => {
            var data = event.target.result; // Content of CSV file

            // Parse the CSV content
            Papa.parse(data, {
                complete: async (result) => {
                    // The data in 'result.data' is now an array of arrays or objects (depending on your parse settings)
                    this.fileUploadFormDisabled = true;
                    let csvToRowArray = result.data;
                    for (
                        let index = 1;
                        index < csvToRowArray.length - 1;
                        index++
                    ) {
                        let row = csvToRowArray[index];
                        let data = new Client();

                        let name = row[1] + ' ' + row[0];
                        data.full_name = name.replace('"', '');

                        if (row[7].trim() != '') {
                            data.email = row[7];
                        }

                        if (row[6].trim() != '') {
                            data.phone_number = row[6];
                        }

                        data.address = row[2];
                        data.city = row[3];
                        data.state = row[4];
                        data.zip_code = row[5];
                        data.organization = row[9];
                        data.belongs_to = this.user.id;
                        // await delay(500);
                        await this.saveClient(data);
                        this.processed++;
                    }

                    this.spinner.hide();
                    this.fileUploadFormDisabled = false;
                    this.dialogRef.close();
         
                },
                header: false, // Set to false if you want an array of arrays, or true for an array of objects
            });
           
        };


    }

    async saveClient(data: any) {
        const promise = new Promise<void>((resolve, reject) => {
            this.clientService.addClient(data).subscribe({
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
}
