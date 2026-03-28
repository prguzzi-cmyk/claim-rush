import { DatePipe } from '@angular/common';
import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Claim } from 'src/app/models/claim.model';
import { Client } from 'src/app/models/client.model';
import { User } from 'src/app/models/user.model';
import { ClaimService } from 'src/app/services/claim.service';
import { ClientService } from 'src/app/services/client.service';
import { UserService } from 'src/app/services/user.service';
import { Location } from '@angular/common';
import { DialogService } from 'src/app/services/dialog.service';
import { ClaimFilesDialogComponent } from 'src/app/components/dialogs/claim-files-dialog/claim-files-dialog.component';
import { ClaimTasksDialogComponent } from 'src/app/components/dialogs/claim-tasks-dialog/claim-tasks-dialog.component';
import { ClaimCommentsDialogComponent } from 'src/app/components/dialogs/claim-comments-dialog/claim-comments-dialog.component';
import { ClaimTask } from 'src/app/models/tasks-claim.model';
import { ClaimComment } from 'src/app/models/comment-claim.model';
import { ClaimCommunication, MESSAGE_TYPE_LABELS, MESSAGE_TYPE_COLORS, MESSAGE_TYPE_ICONS } from 'src/app/models/claim-communication.model';
import { ClaimFile } from 'src/app/models/files-claim.model';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { ClaimDialogComponent } from 'src/app/components/dialogs/client-claim-dialog/claim-dialog.component';
import { MatTabGroup } from '@angular/material/tabs';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClaimLedgerDialogComponent } from 'src/app/components/dialogs/claim-ledger-dialog/claim-ledger-dialog.component';
import { ClaimLedgerComponent } from '../claim-ledger/claim-ledger.component';
import { ACTIVITY_ICONS, getActivityIcon, getActivityColor, getActivityLabel } from 'src/app/models/claim-activity.model';
import { NgxSpinnerService } from 'ngx-spinner';
import { ClaimBulkfilesDialogComponent } from 'src/app/components/dialogs/claim-bulkfiles-dialog/claim-bulkfiles-dialog.component';
import { ViewDocumentDialogComponent } from 'src/app/components/dialogs/view-document-dialog/view-document-dialog.component';
import { TemplatesDialogComponent } from 'src/app/components/dialogs/templates-dialog/templates-dialog.component';
import { SelectionModel } from '@angular/cdk/collections';
import { ClaimFilesShareDialogComponent } from 'src/app/components/dialogs/claim-files-share-dialog/claim-files-share-dialog.component';
import { TabService } from '../../../../services/tab.service';
import { MastersService } from 'src/app/services/masters.service';
import { EstimatingService } from 'src/app/services/estimating.service';
import { CollaboratorsDialogComponent } from 'src/app/components/dialogs/collaborators-dialog/collaborators-dialog.component';
import { forkJoin } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ESCALATION_PATHS, PHASE_MILESTONES } from 'src/app/models/claim-phases.model';

export { ESCALATION_PATHS, PHASE_MILESTONES };

@Component({
    selector: 'app-claim',
    templateUrl: './claim.component.html',
    styleUrls: ['./claim.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ClaimComponent implements OnInit {
    @ViewChild('tabGroup') tabGroup: MatTabGroup;
    @ViewChild(ClaimLedgerComponent)
    claimLedgerChildComponent: ClaimLedgerComponent;
    selection = new SelectionModel<ClaimFile>(true, []);

    timelineFilter: string = '';
    activityTypes = Object.keys(ACTIVITY_ICONS);
    getActivityIcon = getActivityIcon;
    getActivityColor = getActivityColor;
    getActivityLabel = getActivityLabel;

    claim: Claim;
    @Input() claim_id: string;
    client: Client = null;
    client_id: any;
    showFile: any;

    totalRecordsComments = 0;
    totalRecordsTasks = 0;
    totalRecordsFiles = 0;
    totalRecordsPayments = 0;
    pageIndexComments: number = 1;
    pageIndexTasks: number = 1;
    pageIndexFiles: number = 1;
    pageIndexPayments: number = 1;
    pageSize = 10;
    pageSizeFiles = 10;
    pageSizeOptions = [10, 25, 50, 100];
    showEmailLinkingLink: boolean = false;

    selectionLength = 0;
    user: User;
    totalPaymentReceived: number = 0;
    totalPaymentPercentage: any = 0;

    claimFiles: [ClaimFile] = null;
    claimComments: ClaimComment[] = null;
    claimTasks: ClaimTask[] = null;
    claimTimeline: any[] = null;
    claimRole: any = null;

    commentForm: any;
    commentFormDisabled: boolean = false;

    // Communications Hub
    claimCommunications: ClaimCommunication[] = null;
    communicationsFiltered: ClaimCommunication[] = [];
    commMessageTypeFilter: string = '';
    commForm: FormGroup;
    commFormDisabled: boolean = false;
    commFormMessageType: string = 'carrier';
    commSummary: any = null;
    messageTypeLabels = MESSAGE_TYPE_LABELS;
    messageTypeColors = MESSAGE_TYPE_COLORS;
    messageTypeIcons = MESSAGE_TYPE_ICONS;

    policyTypes: any;
    subPolicyTypes: any;
    coverageTypes: any;
    permissions: any = {};
    claimRolepermissions: any = {};

    isSalesRep: boolean = false;
    isCommentExternal: boolean = false;
    taskViewMode: 'table' | 'board' = 'table';

    phaseMilestones = PHASE_MILESTONES;
    escalationPaths = ESCALATION_PATHS;
    subStatuses: any[] = [];
    showPhaseOverride = false;
    phaseUpdating = false;
    escalationUpdating = false;
    subStatusUpdating = false;

    dataSourceFile: MatTableDataSource<ClaimFile>;
    @ViewChild(MatPaginator, { static: false }) paginatorFile: MatPaginator;

    dataSourceTasks: MatTableDataSource<ClaimTask>;
    @ViewChild(MatPaginator, { static: false }) paginatorTasks: MatPaginator;

    dataSourceComments: MatTableDataSource<ClaimComment>;
    @ViewChild(MatPaginator, { static: false }) paginatorComments: MatPaginator;

    displayedColumnsFiles: string[] = ['sn', 'name', 'created_at', 'download'];
    displayedColumnsTasks: string[] = [
        'sn',
        'title',
        'task_type',
        'priority',
        'status',
        'due_date',
        'created_at',
        'created_by',
        'edit',
        'delete',
    ];
    displayedColumnsComments: string[] = ['description', 'edit', 'delete'];

    constructor(
        private claimService: ClaimService,
        private router: Router,
        private route: ActivatedRoute,
        public datepipe: DatePipe,
        public userService: UserService,
        private clientService: ClientService,
        private snackBar: MatSnackBar,
        private location: Location,
        private spinner: NgxSpinnerService,
        private dialogService: DialogService,
        private tabService: TabService,
        private mastersService: MastersService,
        private estimatingService: EstimatingService,
    ) {}

    // Estimate data
    estimateProjects: any[] = [];
    estimatesLoading = false;

    loadEstimateProjects(): void {
        if (!this.claim?.id || this.estimateProjects.length > 0) return;
        this.estimatesLoading = true;
        this.estimatingService.getEstimates(1, 50).subscribe({
            next: (res: any) => {
                const items = res?.items || res?.data || res || [];
                this.estimateProjects = (Array.isArray(items) ? items : [])
                    .filter((p: any) => p.claim_id === this.claim.id);
                this.estimatesLoading = false;
            },
            error: () => { this.estimatesLoading = false; },
        });
    }

    openEstimateProject(projectId: string): void {
        this.router.navigate(['/app/estimating', projectId]);
    }

    openNewEstimate(): void {
        this.router.navigate(['/app/estimating/create'], {
            queryParams: { claim_id: this.claim?.id },
        });
    }

    openBlackoutView(projectId: string): void {
        this.router.navigate(['/app/estimating', projectId], {
            queryParams: { view: 'blackout' },
        });
    }

    ngOnInit(): void {
        this.isSalesRep = localStorage.getItem('role-name') === 'sales-rep';
        this.permissions = this.userService.getUserModulePermissions('claim');
        this.claimRolepermissions = this.permissions;
    
        if (this.claim_id && this.userService.getUserPermissions('claim', 'read')) {
            forkJoin([this.getPolicyTypes(), this.getCoverageTypes()]).subscribe(() => {
                this.getClaim();
            });
            this.claimService.getSubStatuses().subscribe(statuses => this.subStatuses = statuses);
        } else {
            this.router.navigate(['/app/clients']);
        }
    
        this.commentForm = new FormGroup({
            text: new FormControl('', [Validators.required]),
        });

        this.commForm = new FormGroup({
            message_type: new FormControl('carrier', [Validators.required]),
            subject: new FormControl(''),
            body: new FormControl('', [Validators.required]),
            recipient_email: new FormControl(''),
            recipient_name: new FormControl(''),
        });
    }

    ngAfterViewInit() {
        this.selection.changed.subscribe((x) => {
            this.selectionLength = x.source.selected.length;
        });
    }

    getPolicyTypes() {
        return this.mastersService.getPolicyTypes().pipe(
            tap((policyTypes) => {
                this.policyTypes = policyTypes;
            })
        );
    }

    getSubPolicyTypes(slug: string) {
        console.log(slug);
        this.mastersService
            .getSubPolicyTypes(slug)
            .subscribe((subPolicyTypes) => {
                this.subPolicyTypes = subPolicyTypes;
                // console.log(this.subPolicyTypes);
                this.claim.sub_policy_type = this.subPolicyTypes.find(
                    (policy) => policy.slug === this.claim.sub_policy_type
                )?.name;
            });
    }

    getCoverageTypes() {
        return this.mastersService.getCoverageTypes().pipe(
            tap((coverageTypes) => {
                this.coverageTypes = coverageTypes;
            })
        );
    }

    getCoverageType(slug: string) {
        return this.coverageTypes?.find((coverage) => coverage.slug === slug)
            .name;
    }

    onClientDetail(id: string, name: string) {
        this.tabService.addItem({ id, name, type: 'client' });
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

    logSelection() {
        this.selection.selected.forEach((s) => console.log(s.name));
    }

    addComment() {
        this.commentFormDisabled = true;
        let data: any = {
            text: this.commentForm.get('text').value,
            can_be_removed: true,
            visibility: this.isCommentExternal ? 'external' : 'internal',
        };
        this.claimService.addClaimComments(data, this.claim_id).subscribe(
            (result: any) => {
                if (result?.id != '') {
                    this.commentFormDisabled = false;
                    this.getClaimComments();
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
                console.log(error);
            }
        );
    }

    tabChange(index: number) {
        if (index === 1) {
            if (!this.claimTasks) {
                this.getClaimTasks();
            }
        }
        if (index === 2) {
            this.getClaimFiles();
        }
        if (index === 4) {
            if (!this.claimComments) {
                this.getClaimComments();
            }
        }
        if (index === 5) {
            if (!this.claimTimeline) {
                this.getClaimTimeline();
            }
        }
        if (index === 8) {
            if (!this.claimCommunications) {
                this.getClaimCommunications();
            }
        }
    }

    changePage(event: PageEvent, module: string) {
        if (module == 'comment') {
            this.pageIndexComments = event.pageIndex + 1;

            if (this.pageIndexComments == 0) {
                this.pageIndexComments = 1;
            }
            this.getClaimComments();
        }

        if (module == 'task') {
            this.pageIndexTasks = event.pageIndex + 1;

            if (this.pageIndexTasks == 0) {
                this.pageIndexTasks = 1;
            }
            this.getClaimTasks();
        }

        if (module == 'file') {
            this.pageIndexFiles = event.pageIndex + 1;
            this.pageSizeFiles = event.pageSize;

            if (this.pageIndexFiles == 0) {
                this.pageIndexFiles = 1;
            }
            this.getClaimFiles();
        }
    }

    getClaimTimeline() {
        this.claimTimeline = null;
        this.spinner.show();
        this.claimService
            .getClaimTimeline(this.claim_id)
            .subscribe((claimTimeline) => {
                this.spinner.hide();
                if (claimTimeline !== undefined) {
                    this.claimTimeline = claimTimeline.items;
                }
            });
    }

    get filteredTimeline(): any[] {
        if (!this.claimTimeline) return [];
        if (!this.timelineFilter) return this.claimTimeline;
        return this.claimTimeline.filter(
            (event: any) => event.activity_type === this.timelineFilter
        );
    }

    getClaimComments() {
        this.spinner.show();
        this.claimService
            .getClaimComments(
                this.claim_id,
                this.pageIndexComments,
                this.pageSize
            )
            .subscribe(
                (claimComments) => {
                    this.spinner.hide();
                    if (claimComments !== undefined) {
                        this.claimComments = claimComments.items;
                        this.dataSourceComments = new MatTableDataSource(
                            claimComments.items
                        );
                        this.totalRecordsComments = claimComments.total;
                        this.pageSize = claimComments.size;
                        this.pageIndexComments = claimComments.page;
                    }
                },
                (error) => {
                    this.spinner.hide();
                    console.log(error);
                    this.claimComments = null;
                }
            );
    }

    // --- Communications Hub Methods ---

    getClaimCommunications() {
        this.spinner.show();
        this.claimService
            .getClaimCommunications(this.claim_id, this.commMessageTypeFilter || undefined)
            .subscribe(
                (comms) => {
                    this.spinner.hide();
                    if (comms !== undefined) {
                        this.claimCommunications = comms;
                        this.communicationsFiltered = comms;
                    }
                },
                (error) => {
                    this.spinner.hide();
                    this.claimCommunications = [];
                    this.communicationsFiltered = [];
                }
            );
        this.claimService
            .getClaimCommunicationsSummary(this.claim_id)
            .subscribe((summary) => {
                this.commSummary = summary;
            });
    }

    onCommTypeFilterChange() {
        this.claimCommunications = null;
        this.getClaimCommunications();
    }

    onCommFormTypeChange() {
        this.commFormMessageType = this.commForm.get('message_type').value;
    }

    addCommunication() {
        this.commFormDisabled = true;
        const formVal = this.commForm.value;
        const data: any = {
            message_type: formVal.message_type,
            subject: formVal.subject || null,
            body: formVal.body,
            recipient_email: formVal.recipient_email || null,
            recipient_name: formVal.recipient_name || null,
            direction: 'outbound',
            channel: formVal.message_type === 'internal' ? 'note' : 'portal',
        };
        this.claimService.addClaimCommunication(data, this.claim_id).subscribe(
            (result: any) => {
                this.commFormDisabled = false;
                if (result?.id) {
                    this.claimCommunications = null;
                    this.getClaimCommunications();
                    this.commForm.patchValue({ subject: '', body: '', recipient_email: '', recipient_name: '' });
                    this.snackBar.open('Communication saved', 'Close', { duration: 5000 });
                }
            },
            (error) => {
                this.commFormDisabled = false;
                this.snackBar.open(
                    error?.error?.detail || 'Error sending communication',
                    'Close',
                    { duration: 5000 }
                );
            }
        );
    }

    deleteCommunication(comm: ClaimCommunication) {
        if (!confirm('Delete this communication?')) return;
        this.claimService.deleteClaimCommunication(comm.id).subscribe(
            () => {
                this.claimCommunications = null;
                this.getClaimCommunications();
                this.snackBar.open('Communication deleted', 'Close', { duration: 3000 });
            },
            (error) => {
                this.snackBar.open('Error deleting communication', 'Close', { duration: 5000 });
            }
        );
    }

    getUser() {
        this.userService.currentUser.subscribe((user) => {
            this.user = user;
        });
    }

    getClaimTasks() {
        this.spinner.show();
        this.claimService
            .getClaimTasks(this.claim_id, this.pageIndexTasks, this.pageSize)
            .subscribe(
                (claimTasks) => {
                    this.spinner.hide();

                    if (claimTasks !== undefined) {
                        this.claimTasks = claimTasks.items;

                        // Remove delete followup
                        this.dataSourceTasks = new MatTableDataSource(
                            claimTasks.items
                        );

                        this.totalRecordsTasks = claimTasks.total;
                        this.pageIndexTasks = claimTasks.page;
                        this.pageSize = claimTasks.size;
                    }
                },
                (error) => {
                    this.spinner.hide();
                    console.log(error);
                }
            );
    }

    getClaimFiles() {
        this.spinner.show();
        this.claimService
            .getClaimFiles(
                this.claim_id,
                this.pageIndexFiles,
                this.pageSizeFiles
            )
            .subscribe(
                (claimFiles) => {
                    this.spinner.hide();

                    if (claimFiles !== undefined) {
                        if (claimFiles) {
                            this.claimFiles = claimFiles.items;

                            // Remove delete followup
                            this.dataSourceFile = new MatTableDataSource(
                                claimFiles.items
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
                            this.totalRecordsFiles = claimFiles.total;
                            this.pageIndexFiles = claimFiles.page;
                            this.pageSizeFiles = claimFiles.size;
                        }
                    }
                },
                (error) => {
                    this.spinner.hide();
                }
            );
    }

    backClicked() {
        this.location.back();
    }

    getClient() {
        this.spinner.show();
        this.clientService.getClient(this.client_id).subscribe(
            (client) => {
                this.spinner.hide();
                if (client !== undefined) {
                    this.client = client;
                }
            },
            (error) => {
                this.spinner.hide();
                console.log(error);
            }
        );
    }

    getClaim() {
        this.spinner.show();
        this.claimService.getClaim(this.claim_id).subscribe(
            (claim) => {
                this.spinner.hide();
                if (claim !== undefined) {
                    this.claim = claim;

                    if (this.claim?.policy_type != null) {
                        if (this.claim.policy_type != null) {
                            this.getSubPolicyTypes(this.claim.policy_type);
                        }
                        this.claim.policy_type = this.policyTypes?.find(
                            (policy) => policy.slug === this.claim.policy_type
                        )?.name;
                    }
                    claim.loss_date = this.datepipe.transform(
                        claim?.loss_date,
                        'yyyy-MM-ddThh:mm'
                    );

                    if (!claim?.claim_business_email?.email) {
                        this.showEmailLinkingLink = true;
                    }

                    this.client_id = claim?.client_id;
                    this.getClient();
                    if (claim?.claim_role != null) {
                        this.getClaimRole();
                    }

                    if (this.userService.getUserPermissions('claim_payment', 'read') && !claim?.is_collaborator) {
                        this.getClaimPayments();
                    }
                }
            },
            (error) => {
                this.spinner.hide();
            }
        );
    }

    getClaimRole() {
        this.spinner.show();
        this.claimService.getClaimRoles().subscribe(
            (role) => {
                this.spinner.hide();
                console.log(this.claim.claim_role);
                if (this.claim.claim_role == 'collaborator') {
                    this.claimRole = role.roles_permissions.collaborator;
                } else if (this.claim.claim_role == 'source') {
                    this.claimRole = role.roles_permissions.source;
                } else if (this.claim.claim_role == 'signer') {
                    this.claimRole = role.roles_permissions.signer;
                } else if (this.claim.claim_role == 'adjuster') {
                    this.claimRole = role.roles_permissions.adjuster;
                } else {
                    this.claimRole = null;
                }

                this.checkPermissions();
            },
            (error) => {
                this.spinner.hide();
                console.log(error);
            }
        );
    }

    //calculates claim payments for progress bar
    getClaimPayments() {
        if (!this.permissions.includes('claim_payment:read')) return;

        this.spinner.show();

        let params = {
            page: 1,
            size: 1000,
        };

        this.claimService
            .getClaimPayments(this.claim_id, params)
            .subscribe((claimPayments) => {
                this.spinner.hide();

                if (claimPayments !== undefined) {
                    this.totalPaymentReceived = 0;
                    claimPayments.items.forEach((payment) => {
                        // console.log(payment.check_amount);
                        this.totalPaymentReceived =
                            this.totalPaymentReceived +
                            Number(payment.check_amount);
                    });

                    // console.log(this.totalPaymentReceived, this.claim?.anticipated_amount);

                    if (
                        this.totalPaymentReceived > 0 &&
                        this.claim?.anticipated_amount != ''
                    ) {
                        this.totalPaymentPercentage =
                            (Number(this.totalPaymentReceived) /
                                Number(this.claim?.anticipated_amount)) *
                            100;
                        this.totalPaymentPercentage =
                            this.totalPaymentPercentage.toFixed(0);
                    }

                    this.totalRecordsPayments = claimPayments.total;
                    this.pageSize = claimPayments.size;
                    this.pageIndexPayments = claimPayments.page;
                }
            });
    }

    checkPermissions() {
        this.claimRolepermissions = []; // claimRole permissions have preference over user role permissions
        this.claimRole.forEach((permission) => {
            if (!(permission in this.permissions)) {
                this.claimRolepermissions.push(permission);
            }
        });
        console.log(this.permissions);
        console.log(this.claimRolepermissions);
        return true;
    }

    openFileUploadDialog(claim: Claim) {
        this.dialogService
            .openDialog(ClaimFilesDialogComponent, {
                type: 'add',
                claim: claim,
            })
            .subscribe(() => this.getClaimFiles());
        this.tabGroup.selectedIndex = 2;
    }

    openFileViewDialog(claimFile: ClaimFile) {
        this.dialogService
            .openDialog(ClaimFilesDialogComponent, {
                type: 'view',
                claimFile: claimFile,
            })
            .subscribe(() => this.getClaimFiles());
        this.tabGroup.selectedIndex = 2;
    }

    openFileEditDialog(claimFile: ClaimFile) {
        this.dialogService
            .openDialog(ClaimFilesDialogComponent, {
                type: 'edit',
                claimFile: claimFile,
            })
            .subscribe(() => this.getClaimFiles());
        this.tabGroup.selectedIndex = 2;
    }

    openFileDeleteDialog(claimFile: ClaimFile) {
        this.dialogService
            .openDialog(ClaimFilesDialogComponent, {
                type: 'delete',
                claimFile: claimFile,
            })
            .subscribe(() => this.getClaimFiles());
        this.tabGroup.selectedIndex = 2;
    }

    openTasksViewDialog(claimTask: ClaimTask) {
        this.dialogService
            .openDialog(ClaimTasksDialogComponent, {
                type: 'view',
                claimTask: claimTask,
            })
            .subscribe(() => this.getClaimTasks());
        this.tabGroup.selectedIndex = 1;
    }

    openTasksEditDialog(claimTask: ClaimTask) {
        this.dialogService
            .openDialog(ClaimTasksDialogComponent, {
                type: 'edit',
                claimTask: claimTask,
            })
            .subscribe(() => this.getClaimTasks());
        this.tabGroup.selectedIndex = 1;
    }

    openTasksDeleteDialog(claimTask: ClaimTask) {
        this.dialogService
            .openDialog(ClaimTasksDialogComponent, {
                type: 'delete',
                claimTask: claimTask,
            })
            .subscribe(() => this.getClaimTasks());
        this.tabGroup.selectedIndex = 1;
    }

    openTaskAddDialog(claim: Claim) {
        this.dialogService
            .openDialog(ClaimTasksDialogComponent, {
                type: 'add',
                claim: claim,
            })
            .subscribe(() => this.getClaimTasks());
        this.tabGroup.selectedIndex = 1;
    }

    openCommentsAddDialog(claim: Claim) {
        this.dialogService
            .openDialog(ClaimCommentsDialogComponent, {
                type: 'add',
                claim: claim,
            })
            .subscribe(() => this.getClaimComments());
        this.tabGroup.selectedIndex = 3;
    }

    openCommentEditDialog(claimComment: ClaimComment) {
        this.dialogService
            .openDialog(ClaimCommentsDialogComponent, {
                type: 'edit',
                claimComment: claimComment,
            })
            .subscribe(() => this.getClaimComments());
        this.tabGroup.selectedIndex = 3;
    }

    openCommentDeleteDialog(claimComment: ClaimComment) {
        this.dialogService
            .openDialog(ClaimCommentsDialogComponent, {
                type: 'delete',
                claimComment: claimComment,
            })
            .subscribe(() => this.getClaimComments());
        this.tabGroup.selectedIndex = 3;
    }

    openCommentViewDialog(claimComment: ClaimComment) {
        this.dialogService
            .openDialog(ClaimCommentsDialogComponent, {
                type: 'view',
                claimComment: claimComment,
            })
            .subscribe(() => this.getClaimComments());
        this.tabGroup.selectedIndex = 3;
    }

    openClaimAddDialog(claim: Claim) {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'add',
                claim: claim,
            })
            .subscribe(() => this.getClaim());
    }

    openClaimEditDialog(claim: Claim) {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'edit',
                claim: claim,
            })
            .subscribe(() => this.getClaim());
    }

    openClaimDeleteDialog(claim: Claim) {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'delete',
                claim: claim,
            })
            .subscribe((isDeleted) => {
                if (isDeleted) {
                    this.removeTab();
                }
            });
    }

    openPaymentAddDialog(claim: Claim) {
        this.tabGroup.selectedIndex = 5;
        this.dialogService
            .openDialog(ClaimLedgerDialogComponent, {
                type: 'add',
                claim: claim,
            })
            .subscribe((result) => {
                if (result != '') {
                    this.claimLedgerChildComponent.getPayments();
                }
            });
    }

    openBulkFileUploadDialog(claim: Claim) {
        this.dialogService
            .openDialog(ClaimBulkfilesDialogComponent, {
                type: 'add',
                claim: claim,
            })
            .subscribe(() => this.getClaimFiles());
        this.tabGroup.selectedIndex = 2;
    }

    openFile(file: any, type: any) {
        this.dialogService
            .openDialog(ViewDocumentDialogComponent, { type: type, file: file })
            .subscribe(() => this.getClaimFiles());
        this.tabGroup.selectedIndex = 2;
    }

    openShareClaimFileDialog() {
        this.dialogService
            .openDialog(ClaimFilesShareDialogComponent, {
                type: 'add',
                selectedClaimFiles: this.selection.selected,
            })
            .subscribe(() => this.getClaimTasks());
    }

    openTemplatesDialog(claim: Claim) {
        this.dialogService
            .openDialog(TemplatesDialogComponent, {
                type: 'select',
                claim: claim,
            })
            .subscribe(() => this.getClaimFiles());
    }

    openClaimFilesMultipleDeleteDialog() {
        this.dialogService
            .openDialog(ClaimFilesDialogComponent, {
                type: 'multiple-delete',
                selection: this.selection,
            })
            .subscribe(() => {
                this.selection.clear();
                this.getClaimFiles();
            });
        this.tabGroup.selectedIndex = 2;
    }

    openCollaboratorsDialog(claim: Claim) {
        this.dialogService
            .openDialog(CollaboratorsDialogComponent, {
                claim: claim,
            })
            .subscribe(() => {
                this.getClaim();
            });
    }

    fixBusinessEmail(claim_id: string) {
        this.spinner.show();
        this.claimService
            .fixBusinessEmailIssues(claim_id)
            .subscribe((result: any) => {
                this.showEmailLinkingLink = false;
                // To reload the current page
                this.getClaim();
            });
    }

    onNavigate(side: string) {
        this.tabService.setSideTitle(side);
    }

    removeTab() {
        this.tabService.removeItemById(this.claim_id);
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

    onSidebarClick(data: string) {
        this.tabService.setSideTitle(data);
    }

    get currentEscalation() {
        return ESCALATION_PATHS.find(e => e.slug === this.claim?.escalation_path) || ESCALATION_PATHS[0];
    }

    get currentSubStatusLabel(): string {
        return this.subStatuses.find(s => s.slug === this.claim?.sub_status)?.display_name || 'None';
    }

    get hasEscalation(): boolean {
        return !!this.claim?.escalation_path && this.claim.escalation_path !== 'none';
    }

    get hasSubStatus(): boolean {
        return !!this.claim?.sub_status && this.claim.sub_status !== 'none';
    }

    get currentPhaseIndex(): number {
        const slug = this.claim?.current_phase;
        if (!slug) return 0;
        const idx = this.phaseMilestones.findIndex(m => m.slugs.includes(slug));
        return idx >= 0 ? idx : 0;
    }

    get phaseProgress(): number {
        return Math.round(((this.currentPhaseIndex + 1) / this.phaseMilestones.length) * 100);
    }

    getPhaseStatus(idx: number): string {
        if (idx < this.currentPhaseIndex) return 'completed';
        if (idx === this.currentPhaseIndex) return 'active';
        return 'upcoming';
    }

    togglePhaseOverride() {
        this.showPhaseOverride = !this.showPhaseOverride;
    }

    setPhase(idx: number) {
        if (!this.permissions?.includes('claim:update')) return;
        const slug = this.phaseMilestones[idx].slugs[0];
        this.phaseUpdating = true;
        this.claimService.updateClaim({ id: this.claim_id, current_phase: slug } as any).subscribe(
            () => {
                this.phaseUpdating = false;
                this.showPhaseOverride = false;
                this.getClaim();
            },
            (error) => {
                this.phaseUpdating = false;
                this.snackBar.open(
                    error?.error?.detail || 'Failed to update phase',
                    'Close',
                    { duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom' }
                );
            }
        );
    }

    setEscalation(slug: string) {
        if (!this.permissions?.includes('claim:update')) return;
        this.escalationUpdating = true;
        this.claimService.updateClaim({ id: this.claim_id, escalation_path: slug } as any).subscribe(
            () => {
                this.escalationUpdating = false;
                this.getClaim();
            },
            (error) => {
                this.escalationUpdating = false;
                this.snackBar.open(
                    error?.error?.detail || 'Failed to update escalation',
                    'Close',
                    { duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom' }
                );
            }
        );
    }

    setSubStatus(slug: string) {
        if (!this.permissions?.includes('claim:update')) return;
        this.subStatusUpdating = true;
        this.claimService.updateClaim({ id: this.claim_id, sub_status: slug } as any).subscribe(
            () => {
                this.subStatusUpdating = false;
                this.getClaim();
            },
            (error) => {
                this.subStatusUpdating = false;
                this.snackBar.open(
                    error?.error?.detail || 'Failed to update sub-status',
                    'Close',
                    { duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom' }
                );
            }
        );
    }
}
