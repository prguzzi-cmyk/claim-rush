import { Component, OnInit, ViewChild, Input } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { Claim } from 'src/app/models/claim.model';
import { Client } from 'src/app/models/client.model';
import { ClientComment } from 'src/app/models/comment-client.model';
import { ClientCommentsDialogComponent } from 'src/app/components/dialogs/client-comments-dialog/client-comments-dialog.component';
import { ClientFile } from 'src/app/models/files-client.model';
import { ClientFilesDialogComponent } from 'src/app/components/dialogs/client-files-dialog/client-files-dialog.component';
import { ClientTask } from 'src/app/models/tasks-client.model';
import { ClientTasksDialogComponent } from 'src/app/components/dialogs/client-tasks-dialog/client-tasks-dialog.component';
import { User } from 'src/app/models/user.model';
import { ClientService } from 'src/app/services/client.service';
import { DialogService } from 'src/app/services/dialog.service';
import { UserService } from 'src/app/services/user.service';
import { Location } from '@angular/common';
import { DatePipe } from '@angular/common';
import { ClaimDialogComponent } from 'src/app/components/dialogs/client-claim-dialog/claim-dialog.component';
import {
    FormBuilder,
    FormControl,
    FormGroup,
    Validators,
} from '@angular/forms';
import { LeadService } from 'src/app/services/leads.service';
import { TabService } from 'src/app/services/tab.service';
import { Lead } from 'src/app/models/lead.model';
import { ClientDetailsDialogComponent } from 'src/app/components/dialogs/client-details-dialog/client-details-dialog.component';
import { ClaimService } from 'src/app/services/claim.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabGroup } from '@angular/material/tabs';
import { ClientBulkFilesDialogComponent } from 'src/app/components/dialogs/client-bulk-files-dialog/client-bulk-files-dialog.component';
import { ViewDocumentDialogComponent } from 'src/app/components/dialogs/view-document-dialog/view-document-dialog.component';
import { NgxSpinnerService } from 'ngx-spinner';
import { LeadDetailsDialogComponent } from 'src/app/components/dialogs/lead-details-dialog/lead-details-dialog.component';
import { SelectionModel } from '@angular/cdk/collections';

@Component({
    selector: 'app-client',
    templateUrl: './client.component.html',
    styleUrls: ['./client.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ClientComponent implements OnInit {
    pageIndexClaims = 1;
    pageIndexLeads = 1;
    pageIndexFiles = 1;
    pageIndexComments = 1;
    pageIndexTasks = 1;

    totalRecordsClaims = 0;
    totalRecordsLeads = 0;
    totalRecordsFiles = 0;
    totalRecordsComments = 0;
    totalRecordsTasks = 0;

    pageSize = 10;
    pageSizeOptions = [5, 10, 25, 50];

    selectionLength = 0;

    @ViewChild('tabGroup') tabGroup: MatTabGroup;

    displayedColumnsClaims: string[] = [
        'ref_number',
        'name',
        'phone_number',
        'email',
        'current_phase',
        'loss_date',
        'address_loss',
        'city_loss',
        'state_loss',
        'zip_code_loss',
        'peril',
        'anticipated_amount',
        'fee',
        'source',
        'signed_by',
        'adjusted_by',
        'assigned_to',
        'insurance_company',
        'policy_number',
        'policy_type',
        'sub_policy_type',
        'claim_number',
        'fema_claim',
        'state_of_emergency',
        'inhabitable',
        'created_by',
        'created_at',
        'updated_by',
        'updated_at',
        'edit',
    ];
    displayedColumnsFiles: string[] = [
        'select',
        'sn',
        'name',
        'description',
        'type',
        'created_at',
        'created_by',
        'download',
        'edit',
        'delete',
    ];
    displayedColumnsTasks: string[] = [
        'sn',
        'title',
        'task_type',
        'status',
        'priority',
        'due_date',
        'created_at',
        'created_by',
        'edit',
        'delete',
    ];
    displayedColumnsComments: string[] = ['description', 'edit', 'delete'];

    @Input() client_id: string;
    clientFiles: [ClientFile] = null;
    clientComments: ClientComment[] = null;
    clientTasks: ClientTask[] = null;

    client: Client;
    user: User;

    searchFormGroup: any;
    commentForm: any;
    commentFormDisabled: boolean = false;
    searchClaimsFormGroup: any;
    selection = new SelectionModel<ClientFile>(true, []);

    dataSource: MatTableDataSource<Lead>;
    dataSourcePending: MatTableDataSource<Lead>;
    @ViewChild('paginator', { static: false }) paginator: MatPaginator;

    dataSourceClaims: MatTableDataSource<Claim>;
    @ViewChild('paginatorClaims', { static: false })
    paginatorClaims: MatPaginator;

    dataSourceFile: MatTableDataSource<ClientFile>;
    @ViewChild('paginatorFile', { static: false }) paginatorFile: MatPaginator;

    dataSourceTasks: MatTableDataSource<ClientTask>;
    @ViewChild('paginatorTasks', { static: false })
    paginatorTasks: MatPaginator;

    dataSourceComments: MatTableDataSource<ClientComment>;
    @ViewChild('paginatorComments', { static: false })
    paginatorComments: MatPaginator;

    leads: [Lead] = null;
    claims: [Claim] = null;
    displayedColumns: string[] = [
        'sn',
        'ref_string',
        'full_name',
        'phone_number',
        'email',
        'source',
        'status',
        'created_by',
        'created_at',
        'edit',
        'delete',
    ];
    statuses: string[] = [
        'callback',
        'not-interested',
        'signed',
        'signed-approved',
    ];
    claimPhases: string[] = [
        'claim-originated',
        'notifying-carrier',
        'scheduling-inspection',
        'inspection',
        'negotiation',
        'mortgage-processing',
        'recovering-depreciation',
        'initial-payment',
        'final-payment',
        'settled',
        'ready-to-close',
        'under-review',
        'appraisal',
        'coverage-dispute',
        'collections',
        'litigation',
        'mediation',
        'on-hold',
    ];
    searches: any[] = [
        { id: 'ref_string', name: 'Ref. #' },
        { id: 'claim_number', name: 'Claim #' },
        { id: 'current_phase', name: 'Current phase' },
        { id: 'created_at', name: 'Creation date' },
    ];

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        public userService: UserService,
        private leadService: LeadService,
        private dialogService: DialogService,
        private clientService: ClientService,
        private claimService: ClaimService,
        private location: Location,
        private _formBuilder: FormBuilder,
        private snackBar: MatSnackBar,
        public datepipe: DatePipe,
        private spinner: NgxSpinnerService,
        private tabService: TabService,
    ) {
        if (!this.userService.getUserPermissions('claim', 'read')) {
            return;
        }

        this.getUser();

        // if (this.route.snapshot.paramMap.get('id')) {
        //     this.client_id = this.route.snapshot.paramMap.get('id');
        //     this.getClient();
        // } else {
        //     this.router.navigate(['/app/leads']);
        // }
    }

    ngOnInit(): void {
        if (!this.userService.getUserPermissions('client', 'read')) {
            return;
        }

        if(this.client_id)
            this.getClient();
          else
            this.router.navigate(['/app/leads']);

        this.searchFormGroup = this._formBuilder.group({
            search: null,
            name: null,
            email: null,
            phone: null,
            address: null,
            status: null,
            create_at: null,
            assignedTo: null,
        });

        this.commentForm = new FormGroup({
            text: new FormControl('', [Validators.required]),
        });

        this.searchClaimsFormGroup = this._formBuilder.group({
            search: null,
            claim_number: null,
            current_phase: null,
            assigned_to: null,
            ref_string: null,
            created_at: null,
        });
    }

    getClient() {
        this.spinner.show();
        this.clientService.getClient(this.client_id).subscribe(
            (client) => {
                if (client !== undefined) {
                    this.client = client;
                    this.spinner.hide();
                }
            },
            (error) => {
                this.spinner.hide();
            }
        );
    }

    ngAfterViewInit() {
        this.selection.changed.subscribe((x) => {
            this.selectionLength = x.source.selected.length;
        });
    }

    getClientComments() {
        this.spinner.show();
        this.clientService
            .getClientComments(
                this.client_id,
                this.pageIndexComments,
                this.pageSize
            )
            .subscribe((clientComments) => {
                this.spinner.hide();
                if (clientComments !== undefined) {
                    this.clientComments = clientComments.items;
                    this.dataSourceComments = new MatTableDataSource(
                        clientComments.items
                    );

                    this.totalRecordsComments = clientComments.total;
                    this.pageSize = clientComments.size;
                    this.pageIndexComments = clientComments.page;
                }
            });
    }

    getUser() {
        this.userService.currentUser.subscribe((user) => {
            this.user = user;
        });
    }

    getClientTasks() {
        this.spinner.show();
        this.clientService
            .getClientTasks(this.client_id, this.pageIndexTasks, this.pageSize)
            .subscribe((clientTasks) => {
                this.spinner.hide();
                if (clientTasks !== undefined) {
                    this.clientTasks = clientTasks.items;

                    // Remove delete followup
                    this.dataSourceTasks = new MatTableDataSource(
                        clientTasks.items
                    );

                    this.totalRecordsTasks = clientTasks.total;
                    this.pageSize = clientTasks.size;
                    this.pageIndexTasks = clientTasks.page;
                }
            });
    }

    getClientClaims() {
        this.spinner.show();
        let data = {
            search_field: 'client_id',
            search_value: this.client_id,
        };

        this.claimService
            .getClaimsByClientId(
                this.client_id,
                this.pageIndexClaims,
                this.pageSize
            )
            .subscribe((claims) => {
                this.spinner.hide();
                if (claims !== undefined) {
                    this.dataSourceClaims = new MatTableDataSource(
                        claims.items
                    );
                    this.claims = claims.items;
                    this.totalRecordsClaims = claims.total;
                    this.pageSize = claims.size;
                    this.pageIndexClaims = claims.page;
                }
            });
    }

    onClaimDetail(id: string, name: string) {
        this.tabService.addItem({id, name, type:"claim"});
    }

    getClientFiles() {
        this.spinner.show();
        this.clientService
            .getClientFiles(this.client_id, this.pageIndexFiles, this.pageSize)
            .subscribe((clientFiles) => {
                this.spinner.hide();
                if (clientFiles !== undefined) {
                    if (clientFiles) {
                        this.clientFiles = clientFiles.items;

                        // Remove delete followup
                        this.dataSourceFile = new MatTableDataSource(
                            clientFiles.items
                        );

                        this.dataSourceFile.filterPredicate = function (
                            data,
                            filter: string
                        ): boolean {
                            return (
                                data.type.toLowerCase().includes(filter) ||
                                data.name.toLowerCase().includes(filter) ||
                                data.description.toString().includes(filter)
                            );
                        };

                        this.totalRecordsFiles = clientFiles.total;
                        this.pageSize = clientFiles.size;
                        this.pageIndexFiles = clientFiles.page;
                    }
                }
            });
    }

    search() {
        this.searchClaimsFormGroup.markAllAsTouched();

        if (this.searchClaimsFormGroup.valid) {
            let search_value;

            if (
                this.searchClaimsFormGroup.get('search').value == 'claim_number'
            )
                search_value =
                    this.searchClaimsFormGroup.get('claim_number').value;
            else if (
                this.searchClaimsFormGroup.get('search').value == 'created_at'
            ) {
                search_value =
                    this.searchClaimsFormGroup.get('created_at').value;
                search_value = this.datepipe.transform(
                    search_value,
                    'yyyy-MM-dd'
                );
            } else if (
                this.searchClaimsFormGroup.get('search').value ==
                'current_phase'
            )
                search_value =
                    this.searchClaimsFormGroup.get('current_phase').value;
            else if (
                this.searchClaimsFormGroup.get('search').value == 'ref_string'
            )
                search_value =
                    this.searchClaimsFormGroup.get('ref_string').value;

            let data = {
                search_field: this.searchClaimsFormGroup.get('search').value,
                search_value: search_value,
            };

            this.claimService.getClaims().subscribe((claims) => {
                if (claims !== undefined) {
                    // filter deleted claims
                    this.dataSourceClaims = new MatTableDataSource(
                        claims.items.filter((row) => row.is_removed === false)
                    );

                    this.dataSourceClaims.filterPredicate = function (
                        data,
                        filter: string
                    ): boolean {
                        return (
                            data.claim_number.toLowerCase().includes(filter) ||
                            data.ref_string.toLowerCase().includes(filter)
                        );
                    };

                    this.claims = claims.items;
                }
            });
        }
    }

    applyFilter(filterValue: string, module: string) {
        filterValue = filterValue.trim(); // Remove whitespace
        filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches

        if (module == 'files') {
            this.dataSourceFile.filter = filterValue;

            if (this.dataSourceFile.paginator) {
                this.dataSourceFile.paginator.firstPage();
            }
        } else if (module == 'tasks') {
            this.dataSourceTasks.filter = filterValue;

            if (this.dataSourceTasks.paginator) {
                this.dataSourceTasks.paginator.firstPage();
            }
        } else if (module == 'comments') {
            this.dataSourceComments.filter = filterValue;

            if (this.dataSourceComments.paginator) {
                this.dataSourceComments.paginator.firstPage();
            }
        }
    }

    getLeads() {
        let data = {
            client_id: this.client_id,
        };
        this.leadService
            .getClientLeads(data, this.pageIndexLeads, this.pageSize)
            .subscribe((leads) => {
                if (leads !== undefined) {
                    // filter deleted leads
                    this.dataSource = new MatTableDataSource(
                        leads.items.filter((row) => row.is_removed === false)
                    );

                    this.dataSource.filterPredicate = function (
                        data,
                        filter: string
                    ): boolean {
                        return (
                            data.contact.full_name
                                .toLowerCase()
                                .includes(filter) ||
                            data.source.toLowerCase().includes(filter) ||
                            data.contact.phone_number
                                .toLowerCase()
                                .includes(filter) ||
                            data.contact.email.toLowerCase().includes(filter) ||
                            data.status.toString().includes(filter)
                        );
                    };

                    this.leads = leads.items;
                }
            });
    }

    addComment() {
        this.commentFormDisabled = true;
        let data = {
            text: this.commentForm.get('text').value,
            can_be_removed: true,
        };
        this.clientService.addClientComments(data, this.client_id).subscribe(
            (result: any) => {
                if (result?.id != '') {
                    this.commentFormDisabled = false;
                    this.getClientComments();
                    this.commentForm.get('text').setValue('');
                    this.commentForm.markAsPristine();
                    this.commentForm.markAsUntouched();

                    this.snackBar.open('Comment has been saved', 'Close', {
                        duration: 5000,
                        horizontalPosition: 'end',
                        verticalPosition: 'bottom',
                    });
                }
            },
            (error) => {
                this.commentFormDisabled = false;
            }
        );
    }

    tabChange(index: number) {
        if (index === 1) {
            if (!this.claims) {
                this.getClientClaims();
            }
        }
        if (index === 2) {
            this.getLeads();
        }
        if (index === 3) {
            if (!this.clientTasks) {
                this.getClientTasks();
            }
        }
        if (index === 4) {
            if (!this.clientFiles) {
                this.getClientFiles();
            }
        }
        if (index === 5) {
            if (!this.clientComments) {
                this.getClientComments();
            }
        }
    }

    changePage(event: PageEvent, module: string) {
        if (module == 'claim') {
            this.pageIndexComments = event.pageIndex + 1;

            if (this.pageIndexClaims == 0) {
                this.pageIndexClaims = 1;
            }
            this.getClientClaims();
        }

        if (module == 'comment') {
            this.pageIndexComments = event.pageIndex + 1;

            if (this.pageIndexComments == 0) {
                this.pageIndexComments = 1;
            }
            this.getClientComments();
        }

        if (module == 'task') {
            this.pageIndexTasks = event.pageIndex + 1;

            if (this.pageIndexTasks == 0) {
                this.pageIndexTasks = 1;
            }
            this.getClientTasks();
        }

        if (module == 'file') {
            this.pageIndexFiles = event.pageIndex + 1;

            if (this.pageIndexFiles == 0) {
                this.pageIndexFiles = 1;
            }
            this.getClientFiles();
        }
    }

    viewLead(id: string) {
        this.router.navigate(['/app/leads/', id]);
    }

    editLead(id: string) {
        this.router.navigate(['/app/leads/create', id]);
    }

    openClientEditDialog(client: Client) {
        this.dialogService
            .openDialog(ClientDetailsDialogComponent, {
                type: 'edit',
                client: client,
            })
            .subscribe(() => this.getClient());
    }

    openClientDeleteDialog(client: Client) {
        this.dialogService
            .openDialog(ClientDetailsDialogComponent, {
                type: 'delete',
                client: client,
            })
            .subscribe(() => this.router.navigate(['/app/clients']));
    }

    openFileUploadDialog(client: Client) {
        this.dialogService
            .openDialog(ClientFilesDialogComponent, {
                type: 'add',
                client: client,
            })
            .subscribe(() => this.getClientFiles());
    }

    openFileViewDialog(clientFile: ClientFile) {
        this.dialogService
            .openDialog(ClientFilesDialogComponent, {
                type: 'view',
                clientFile: clientFile,
            })
            .subscribe(() => this.getClientFiles());
    }

    openFileEditDialog(clientFile: ClientFile) {
        this.dialogService
            .openDialog(ClientFilesDialogComponent, {
                type: 'edit',
                clientFile: clientFile,
            })
            .subscribe(() => this.getClientFiles());
    }

    openFileDeleteDialog(clientFile: ClientFile) {
        this.dialogService
            .openDialog(ClientFilesDialogComponent, {
                type: 'delete',
                clientFile: clientFile,
            })
            .subscribe(() => this.getClientFiles());
    }

    openTasksViewDialog(clientTask: ClientTask) {
        this.dialogService
            .openDialog(ClientTasksDialogComponent, {
                type: 'view',
                clientTask: clientTask,
            })
            .subscribe(() => this.getClientTasks());
    }

    openTasksEditDialog(clientTask: ClientTask) {
        this.dialogService
            .openDialog(ClientTasksDialogComponent, {
                type: 'edit',
                clientTask: clientTask,
            })
            .subscribe(() => this.getClientTasks());
    }

    openTasksDeleteDialog(clientTask: ClientTask) {
        this.dialogService
            .openDialog(ClientTasksDialogComponent, {
                type: 'delete',
                clientTask: clientTask,
            })
            .subscribe(() => this.getClientTasks());
    }

    openTaskAddDialog(client: Client) {
        this.dialogService
            .openDialog(ClientTasksDialogComponent, {
                type: 'add',
                client: client,
            })
            .subscribe(() => this.getClientTasks());
        this.tabGroup.selectedIndex = 3;
    }

    openCommentsAddDialog(client: Client) {
        this.dialogService
            .openDialog(ClientCommentsDialogComponent, {
                type: 'add',
                client: client,
            })
            .subscribe(() => this.getClientComments());
        this.tabGroup.selectedIndex = 5;
    }

    openCommentEditDialog(clientComment: ClientComment) {
        this.dialogService
            .openDialog(ClientCommentsDialogComponent, {
                type: 'edit',
                clientComment: clientComment,
            })
            .subscribe(() => this.getClientComments());
    }

    openCommentDeleteDialog(clientComment: ClientComment) {
        this.dialogService
            .openDialog(ClientCommentsDialogComponent, {
                type: 'delete',
                clientComment: clientComment,
            })
            .subscribe(() => this.getClientComments());
    }

    openCommentViewDialog(clientComment: ClientComment) {
        this.dialogService
            .openDialog(ClientCommentsDialogComponent, {
                type: 'view',
                clientComment: clientComment,
            })
            .subscribe(() => this.getClientComments());
    }

    openBulkUploadDialog(client: Client) {
        this.dialogService
            .openDialog(ClientBulkFilesDialogComponent, {
                type: 'add',
                client: client,
            })
            .subscribe(() => this.getClientFiles());
    }

    openClaimAddDialog(client: Client) {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'add',
                client: client,
            })
            .subscribe(() => this.getClientClaims());
        this.tabGroup.selectedIndex = 1;
    }

    openClaimEditDialog(claim: Claim) {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'edit',
                claim: claim,
            })
            .subscribe(() => this.getClientClaims());
    }

    openClaimDeleteDialog(claim: Claim) {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'delete',
                claim: claim,
            })
            .subscribe(() => this.getClientClaims());
    }

    openClaimViewDialog(claim: Claim) {
        this.router.navigate(['/app/claim/', claim.id]);
    }

    openLeadEditDialog(lead: Lead) {
        this.dialogService
        .openDialog(LeadDetailsDialogComponent, { type: "edit", lead: lead })
        .subscribe(() => this.getLeads());
      }

    searchChange(event: any) {
        if (this.searchFormGroup.get('search').value == '') {
            this.getLeads();
        }
    }

    searchClaimChange(event: any) {
        if (this.searchClaimsFormGroup.get('search').value == '') {
            this.searchClaimsFormGroup.reset();
            this.getClientClaims();
        }
    }

    openClientFilesMultipleDeleteDialog() {
        this.dialogService
        .openDialog(ClientFilesDialogComponent, {
          type: "multiple-delete",
          selection: this.selection,
        })
        .subscribe(() => { 
          this.selection.clear();
          this.getClientFiles();
        });
    }

    backClicked() {
        this.location.back();
    }

    openFile(file: any, type: any) {
        this.dialogService
            .openDialog(ViewDocumentDialogComponent, { type: type, file: file })
            .subscribe(() => this.getClientFiles());
        this.tabGroup.selectedIndex = 4;
    }

    /** Whether the number of selected elements matches the total number of rows. */
    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.dataSourceFile.data.length;
        return numSelected === numRows;
    }

    /** Selects all rows if they are not all selected; otherwise clear selection. */
    masterToggle() {
        this.isAllSelected()
            ? this.selection.clear()
            : this.dataSourceFile.data.forEach((row) =>
                this.selection.select(row)
            );
    }

    onSidebarClick(data: string) {
        this.tabService.setSideTitle(data);
    }

    onLeadDetail(id: string, name: string) {
        this.tabService.addItem({ id, name, type: "lead" });
      }

    logSelection() {
        this.selection.selected.forEach((s) => console.log(s.name));
    }
}
