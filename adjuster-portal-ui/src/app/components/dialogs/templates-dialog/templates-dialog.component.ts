import { Component, Inject, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { Template } from 'src/app/models/template.model';
import { TemplateService } from 'src/app/services/template.service';
import { UsStatesService } from 'src/app/services/us-states.service';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import PizZipUtils from 'pizzip/utils/index.js';
import { saveAs } from 'file-saver';
import { Claim } from 'src/app/models/claim.model';
import { NgxSpinnerService } from 'ngx-spinner';
import { UserService } from 'src/app/services/user.service';
import { User } from 'src/app/models/user.model';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'app-templates-dialog',
    templateUrl: './templates-dialog.component.html',
    styleUrls: ['./templates-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class TemplatesDialogComponent implements OnInit {
    claim: Claim;
    agent: User;
    content: any;
    action: string = 'add';
    template: Template;
    template_id: string = '';
    fileUploadFormDisabled: boolean = false;

    stateService: any = inject(UsStatesService);
    states: any[] = [];

    displayedColumns: string[] = ['name'];

    // Pagination
    dataSource = new MatTableDataSource<Template>();
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

    templateForm = new FormGroup({
        fileName: new FormControl('', [Validators.required]),
        description: new FormControl('', [Validators.required]),
        state: new FormControl('', [Validators.required]),
    });

    filename: string | undefined;
    file: File | undefined;
    fileType: string | undefined;

    templates: Template[];
    state = "0";

    canBeRemoved: boolean = true;
    title: string = 'Add new template';

    constructor(
        private templateService: TemplateService,
        public dialogRef: MatDialogRef<TemplatesDialogComponent>,
        private spinner: NgxSpinnerService,
        private snackBar: MatSnackBar,
        private datepipe: DatePipe,
        private userService: UserService,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        if (data) {
            this.getAgent();

            this.states = this.stateService.getStatesList();
            this.action = data.type;

            if (this.action == 'select') {
                this.claim = data?.claim;
                this.title = 'Claim letters and forms';
                this.getTemplates();
            } else if (
                this.action == 'view' ||
                this.action == 'delete' ||
                this.action == 'edit'
            ) {
                this.template = data?.template;

                if (this.action == 'view') {
                    this.title = this.template?.name;
                }

                if (this.action == 'delete') {
                    this.title = 'Delete template - ' + this.template?.name;
                    this.template_id = this.template.id;
                }

                if (this.action == 'edit') {
                    if (data) {
                        this.template_id = data?.template?.id;
                    }
                    this.title = 'Edit template - ' + this.template?.name;
                    this.templateForm.controls['fileName'].setValue(
                        this.template?.name
                    );
                    this.templateForm.controls['description'].setValue(
                        this.template?.description
                    );
                    this.templateForm.controls['state'].setValue(
                        this.template?.state
                    );
                    this.state = this.template?.state;
                    this.canBeRemoved = this.template?.can_be_removed;
                }
            } else if (this.action == 'add') {

            }
        }
    }

    ngOnInit(): void { }

    getAgent() {
        this.userService.currentUser.subscribe((agent) => {
            this.agent = agent;
            console.log(this.agent);

            if (this.agent) {
                this.agent = agent;
            }
        });
    }

    getTemplates() {
        return this.templateService.getTemplates(1, 50).subscribe((templates) => {
            this.templates = templates.items;
            this.dataSource = new MatTableDataSource(templates.items);
        });
    }

    generate(path: any, file_name: any) {
        console.log(path);
        this.spinner.show();
        PizZipUtils.getBinaryContent(path, async (error, data) => {
            if (error) {
                this.spinner.hide();
                throw error;
            }
            this.content = data;

            const zip = new PizZip(data);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
            });
            doc.setData({
                client_full_name: this.claim?.client?.full_name ?? '',
                client_signature: this.claim?.client?.full_name ?? '',
                client_phone: this.claim?.client?.phone_number ?? '',
                client_email: this.claim?.client?.email ?? '',
                client_address: this.claim?.claim_contact.address_loss ?? '',
                client_city: this.claim?.claim_contact?.city_loss ?? '',
                client_state: this.claim?.claim_contact?.state_loss ?? '',
                client_zipcode: this.claim?.claim_contact?.zip_code_loss ?? '',
                agent_first_name: this.agent?.first_name ?? '',
                agent_last_name: this.agent?.last_name ?? '',
                agent_signature:
                    this.agent?.first_name ??
                    '' + ' ' + this.agent?.last_name ??
                    '',
                agent_email: this.agent?.email ?? '',
                agent_address: this.agent?.user_meta?.address ?? '',
                agent_city: this.agent?.user_meta?.city ?? '',
                agent_state: this.agent?.user_meta?.state ?? '',
                agent_zipcode: this.agent?.user_meta?.zip_code ?? '',
                agent_phone: this.agent?.user_meta?.phone_number ? this.formatPhoneNumber(this.agent?.user_meta?.phone_number) : '',
                agent_ext: this.agent?.user_meta?.phone_number_extension != null ? this.agent?.user_meta?.phone_number_extension : '',
                xagent_ext: this.agent?.user_meta?.phone_number_extension != null ? 'x' + this.agent?.user_meta?.phone_number_extension : '',
                loss_address: this.claim?.claim_contact?.address_loss + ' ' + this.claim?.claim_contact?.city_loss + ' ' + this.claim?.claim_contact?.state_loss + ' ' + this.claim?.claim_contact?.zip_code_loss,
                peril: this.claim.peril ?? '',
                policy_number: this.claim.policy_number ?? '',
                claim_number: this.claim?.claim_number ?? '',
                loss_date: this.datepipe.transform(this.claim?.loss_date, 'MM-dd-yyyy') ?? '',
                insurance_company: this.claim?.insurance_company ?? '',
                date_today: this.datepipe.transform(new Date(), 'MM-dd-yyyy') ?? '',
            });
            try {
                // render the document (replace all occurences of {first_name} by John, {last_name} by Doe, ...)
                doc.render();
            } catch (error) {
                this.spinner.hide();
                // The error thrown here contains additional information when logged with JSON.stringify (it contains a properties object containing all suberrors).
                function replaceErrors(key, value) {
                    if (value instanceof Error) {
                        return Object.getOwnPropertyNames(value).reduce(
                            function (error, key) {
                                error[key] = value[key];
                                return error;
                            },
                            {}
                        );
                    }
                    return value;
                }
                console.log(JSON.stringify({ error: error }, replaceErrors));

                if (
                    error.properties &&
                    error.properties.errors instanceof Array
                ) {
                    const errorMessages = error.properties.errors
                        .map(function (error) {
                            return error.properties.explanation;
                        })
                        .join('\n');
                    console.log('errorMessages', errorMessages);
                }
                throw error;
            }
            const out = doc.getZip().generate({
                type: 'blob',
                mimeType:
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });

            saveAs(out, this.claim?.client?.full_name + ' - ' + this.claim?.ref_string + '.docx');
            this.dialogRef.close();
            this.spinner.hide();
        });
    }

    downloadTemplate() { }

    selectFile(event) {
        this.file = event.target.files[0] || null;
        this.filename = this.file?.name;
        this.fileType = this.file?.type;
    }

    saveTemplate() {
        this.fileUploadFormDisabled = true;

        let state = null;

        if (this.templateForm.get('state').value != "0") {
            state = this.templateForm.get('state').value;
        }

        let templateData = {
            file: this.file,
            file_name: this.templateForm.get('fileName').value,
            description: this.templateForm.get('description').value,
            state: state,
            can_be_removed: this.canBeRemoved,
        };

        this.templateService
            .addTemplate(templateData)
            .subscribe((result: any) => {
                if (result?.id != '') {
                    this.fileUploadFormDisabled = false;
                    this.dialogRef.close();

                    this.snackBar.open('Template has been saved', 'Close', {
                        duration: 5000,
                        horizontalPosition: 'end',
                        verticalPosition: 'bottom',
                    });
                }
            });
    }

    updateTemplate() {
        this.fileUploadFormDisabled = true;

        let templateData = {
            id: this.template_id,
            file_name: this.templateForm.get('fileName').value,
            description: this.templateForm.get('description').value,
            state: this.templateForm.get('state').value,
            can_be_removed: this.canBeRemoved,
        };

        this.templateService
            .updateTemplate(templateData)
            .subscribe((result: any) => {
                if (result?.id != '') {
                    this.fileUploadFormDisabled = false;
                    this.dialogRef.close();

                    this.snackBar.open('Template has been saved', 'Close', {
                        duration: 5000,
                        horizontalPosition: 'end',
                        verticalPosition: 'bottom',
                    });
                }
            });
    }

    deleteTemplate() {
        this.fileUploadFormDisabled = true;

        this.templateService.deleteTemplate(this.template_id).subscribe(
            (result: any) => {
                this.fileUploadFormDisabled = false;
                this.dialogRef.close();
                this.snackBar.open('Template has been deleted', 'Close', {
                    duration: 5000,
                    horizontalPosition: 'end',
                    verticalPosition: 'bottom',
                });
            }
        );
    }

    formatPhoneNumber(phoneNumber: string): string {
        if (!phoneNumber) return phoneNumber;
      
        const cleaned = ('' + phoneNumber).replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
      
        if (match) {
          return `(${match[1]}) ${match[2]}-${match[3]}`;
        }
    }
}
