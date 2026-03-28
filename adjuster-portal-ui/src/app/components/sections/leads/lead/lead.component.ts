import { LeadTasksDialogComponent } from './../../../dialogs/lead-tasks-dialog/lead-tasks-dialog.component';
import { Component, OnInit, ViewChild, Input } from '@angular/core';
import { ActivatedRoute, Router, RouterStateSnapshot } from '@angular/router';
import { FollowupDialogComponent } from 'src/app/components/dialogs/followup-dialog/followup-dialog.component';
import { Lead } from 'src/app/models/lead.model';
import { User } from 'src/app/models/user.model';
import { DialogService } from 'src/app/services/dialog.service';
import { LeadService } from 'src/app/services/leads.service';
import { UserService } from 'src/app/services/user.service';
import { Followup } from 'src/app/models/followup.model';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Location } from '@angular/common';
import { DatePipe } from '@angular/common';
import { LeadFile } from 'src/app/models/files-lead.model';
import { LeadTask } from 'src/app/models/tasks-lead.model';
import { LeadDocumentsDialogComponent } from 'src/app/components/dialogs/lead-documents-dialog/lead-documents-dialog.component';
import { LeadComment } from 'src/app/models/comment-lead.model';
import { LeadCommentsDialogComponent } from 'src/app/components/dialogs/lead-comments-dialog/lead-comments-dialog.component';
import { RecordResultDialogComponent } from 'src/app/components/dialogs/record-result-dialog/record-result-dialog.component';
import { ClientConversionDialogComponent } from 'src/app/components/dialogs/client-conversion-dialog/client-conversion-dialog.component';
import { LeadOutcome } from 'src/app/models/lead-outcome.model';
import { CommunicationLog } from 'src/app/models/communication-log.model';
import { CommunicationService } from 'src/app/services/communication.service';
import { MatTabGroup } from '@angular/material/tabs';
import { LeadDetailsDialogComponent } from 'src/app/components/dialogs/lead-details-dialog/lead-details-dialog.component';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { ViewDocumentDialogComponent } from 'src/app/components/dialogs/view-document-dialog/view-document-dialog.component';
import { TabService } from 'src/app/services/tab.service';
import { SkipTraceService } from 'src/app/services/skip-trace.service';
import { LeadSkipTrace } from 'src/app/models/lead-skip-trace.model';
import { LeadRescueService, RescueStatusResponse } from 'src/app/services/lead-rescue.service';
import { UpaOutreachService, CONTACT_STATUS_OPTIONS } from 'src/app/services/upa-outreach.service';

@Component({
    selector: 'app-lead',
    templateUrl: './lead.component.html',
    styleUrls: ['./lead.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class LeadComponent implements OnInit {

    displayedColumns: string[] = [
        'sn',
        'type',
        'dated',
        'next_date',
        'created_at',
        'created_by',
        'edit',
        'delete',
    ];
    displayedColumnsFiles: string[] = [
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
        'priority',
        'due_date',
        'created_at',
        'created_by',
        'edit',
        'delete',
    ];
    displayedColumnsComments: string[] = ['description', 'edit', 'delete'];
    displayedColumnsOutcomes: string[] = ['sn', 'outcome_status', 'category', 'notes', 'automation_triggered', 'created_at', 'created_by'];
    displayedColumnsCommunications: string[] = ['sn', 'channel', 'purpose', 'recipient', 'send_status', 'sent_at', 'opened_at', 'clicked_at'];

    fileData: LeadFile[] = null;
    leadTasks: LeadTask[] = null;
    leadComments: LeadComment[] = null;
    leadOutcomes: LeadOutcome[] = null;

    dataSourceOutcomes: MatTableDataSource<LeadOutcome>;
    dataSourceCommunications: MatTableDataSource<CommunicationLog>;
    communicationChannelFilter: string | null = null;

    commentForm: any;
    commentFormDisabled: boolean = false;

    @ViewChild('tabGroup') tabGroup: MatTabGroup;

    // Pagination
    dataSource: MatTableDataSource<Followup>;
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

    dataSourceFile: MatTableDataSource<LeadFile>;
    @ViewChild(MatPaginator, { static: false }) paginatorFile: MatPaginator;

    dataSourceTasks: MatTableDataSource<LeadTask>;
    @ViewChild(MatPaginator, { static: false }) paginatorTasks: MatPaginator;

    dataSourceComments: MatTableDataSource<LeadComment>;
    @ViewChild(MatPaginator, { static: false }) paginatorComments: MatPaginator;

    totalRecordsFiles = 0;
    pageIndexFiles = 1;
    totalRecordsTasks = 0;
    pageIndexTasks = 1;
    totalRecordsComments = 0;
    pageIndexComments = 1;
    pageSize = 10;
    pageSizeOptions = [10, 25, 100, 500];

    @Input() lead_id: string;
    lead: Lead;
    leadTask: LeadTask;
    leadFiles: [LeadFile] = null;
    agent: User;
    user: User;
    role: string;

    followups: [any] = null;

    // Skip Trace / Owner Intelligence
    skipTrace: LeadSkipTrace | null = null;
    skipTraceLoading = false;

    // Rescue
    rescueStatus: RescueStatusResponse | null = null;

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private leadService: LeadService,
        public userService: UserService,
        private dialogService: DialogService,
        private location: Location,
        private snackBar: MatSnackBar,
        public datepipe: DatePipe,
        private spinner: NgxSpinnerService,
        private tabService: TabService,
        private communicationService: CommunicationService,
        private skipTraceService: SkipTraceService,
        public rescueService: LeadRescueService,
        private upaOutreachService: UpaOutreachService,
    ) {

        this.role = localStorage.getItem('role-name');

        if (!this.userService.getUserPermissions('lead', 'read')) {
            return;
        }

        this.spinner.show();

        this.getUser();
    }

    ngOnInit(): void {
        this.commentForm = new FormGroup({
            text: new FormControl('', [Validators.required]),
        });

        if (this.lead_id) {
            this.getLead();
            this.loadSkipTrace();
            this.loadRescueStatus();
        } else {
            this.router.navigate(['/app/leads']);
        }
    }

    addComment() {
        this.commentFormDisabled = true;
        let data = {
            text: this.commentForm.get('text').value,
            can_be_removed: true,
        };
        this.leadService.addLeadComments(data, this.lead_id).subscribe(
            (result: any) => {
                if (result?.id != '') {
                    this.commentFormDisabled = false;
                    this.getLeadComments();
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

    getLeadComments() {
        this.leadService
            .getLeadComments(
                this.lead_id,
                this.pageIndexComments,
                this.pageSize
            )
            .subscribe((leadComments) => {
                setTimeout(() => {
                    this.spinner.hide();
                }, 500);

                if (leadComments !== undefined) {
                    if (leadComments) {
                        this.leadComments = leadComments.items;

                        // Remove delete followup
                        this.dataSourceComments = new MatTableDataSource(
                            leadComments.items
                        );
                        this.dataSourceComments.filterPredicate = function (
                            data,
                            filter: string
                        ): boolean {
                            return (
                                data.text.toLowerCase().includes(filter) ||
                                data.created_by?.first_name
                                    .toLowerCase()
                                    .includes(filter) ||
                                data.created_at.toString().includes(filter)
                            );
                        };

                        this.totalRecordsComments = leadComments.total;
                        this.pageIndexComments = leadComments.page;
                        this.pageSize = leadComments.size;
                    }
                }
            });
    }

    getUser() {
        this.userService.currentUser.subscribe((user) => {
            this.user = user;
        });
    }

    getLeadTasks() {
        this.leadService
            .getLeadTasks(this.lead_id, this.pageIndexTasks, this.pageSize)
            .subscribe((leadTasks) => {
                setTimeout(() => {
                    this.spinner.hide();
                }, 500);
                if (leadTasks !== undefined) {
                    this.leadTasks = leadTasks.items;

                    // Remove delete followup
                    this.dataSourceTasks = new MatTableDataSource(
                        leadTasks.items
                    );

                    this.totalRecordsTasks = leadTasks.total;
                    this.pageIndexTasks = leadTasks.page;
                    this.pageSize = leadTasks.size;
                }
            });
    }

    getLeadFiles() {
        this.leadService
            .getLeadFiles(this.lead_id, this.pageIndexFiles, this.pageSize)
            .subscribe((leadFiles) => {
                setTimeout(() => {
                    this.spinner.hide();
                }, 500);
                if (leadFiles !== undefined) {
                    if (leadFiles) {
                        this.leadFiles = leadFiles.items;

                        // Remove delete followup
                        this.dataSourceFile = new MatTableDataSource(
                            leadFiles.items
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

                        this.totalRecordsFiles = leadFiles.total;
                        this.pageIndexFiles = leadFiles.page;
                        this.pageSize = leadFiles.size;
                    }
                }
            });
    }

    getLead() {
        this.leadService.getLead(this.lead_id).subscribe((lead) => {
            setTimeout(() => {
                this.spinner.hide();
            }, 500);

            if (lead !== undefined) {
                this.lead = lead;

                if (lead.follow_ups) {
                    this.followups = lead?.follow_ups;

                    // Remove delete followup
                    this.dataSource = new MatTableDataSource(
                        this.followups.filter((row) => row.is_removed === false)
                    );
                    this.dataSource.paginator = this.paginator;

                    this.dataSource.filterPredicate = function (
                        data,
                        filter: string
                    ): boolean {
                        return (
                            data.type.toLowerCase().includes(filter) ||
                            data.note.toString().includes(filter)
                        );
                    };
                }
            }
        });
    }

    getFollowups() {
        this.getLead();
    }

    applyFilter(filterValue: string, module: string) {
        filterValue = filterValue.trim(); // Remove whitespace
        filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches

        if (module == 'follow-up') {
            this.dataSource.filter = filterValue;

            if (this.dataSource.paginator) {
                this.dataSource.paginator.firstPage();
            }
        } else if (module == 'files') {
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

    tabChange(index: number) {
        this.spinner.show();

        if (index === 0) {
            this.getLead();
        }

        if (index === 1) {
            this.getLeadFiles();
        }
        if (index === 2) {
            this.getLeadTasks();
        }
        if (index === 3) {
            this.getLeadComments();
        }
        if (index === 4) {
            this.getLeadOutcomes();
        }
        if (index === 5) {
            this.getLeadCommunications();
        }
    }

    openLeadEditDialog(lead: Lead) {
        this.dialogService
            .openDialog(LeadDetailsDialogComponent, {
                type: 'edit',
                lead: lead,
            })
            .subscribe(() => this.getLead());
    }

    openLeadDeleteDialog(lead: Lead) {
        this.dialogService
            .openDialog(LeadDetailsDialogComponent, {
                type: 'delete',
                lead: lead,
            })
            .subscribe((isDeleted) => {
              if (isDeleted) {
                  this.removeTab();
              }
          });
    }

    openFollowupViewDialog(followup: Followup) {
        this.dialogService
            .openDialog(FollowupDialogComponent, {
                type: 'view',
                followup: followup,
            })
            .subscribe(() => this.getFollowups());
    }

    openFollowUpDialog(lead: Lead) {
        this.dialogService
            .openDialog(FollowupDialogComponent, { type: 'add', lead: lead })
            .subscribe(() => this.getFollowups());
    }

    openFollowupEditDialog(followup: Followup) {
        this.dialogService
            .openDialog(FollowupDialogComponent, {
                type: 'edit',
                followup: followup,
            })
            .subscribe(() => this.getFollowups());
    }

    openFollowupDeleteDialog(followup: Followup) {
        this.dialogService
            .openDialog(FollowupDialogComponent, {
                type: 'delete',
                followup: followup,
            })
            .subscribe(() => this.getFollowups());
    }

    openFileUploadDialog(lead: Lead) {
        this.dialogService
            .openDialog(LeadDocumentsDialogComponent, {
                type: 'add',
                lead: lead,
            })
            .subscribe(() => this.getLeadFiles());
        this.tabGroup.selectedIndex = 1;
    }

    openFileViewDialog(leadFile: LeadFile) {
        this.dialogService
            .openDialog(LeadDocumentsDialogComponent, {
                type: 'view',
                leadFile: leadFile,
            })
            .subscribe(() => this.getLeadFiles());
    }

    openFileEditDialog(leadFile: LeadFile) {
        this.dialogService
            .openDialog(LeadDocumentsDialogComponent, {
                type: 'edit',
                leadFile: leadFile,
            })
            .subscribe(() => this.getLeadFiles());
    }

    openFileDeleteDialog(leadFile: LeadFile) {
        this.dialogService
            .openDialog(LeadDocumentsDialogComponent, {
                type: 'delete',
                leadFile: leadFile,
            })
            .subscribe(() => this.getLeadFiles());
    }

    openTasksViewDialog(leadTask: LeadTask) {
        this.dialogService
            .openDialog(LeadTasksDialogComponent, {
                type: 'view',
                leadTask: leadTask,
            })
            .subscribe(() => this.getLeadTasks());
    }

    openTasksEditDialog(leadTask: LeadTask) {
        this.dialogService
            .openDialog(LeadTasksDialogComponent, {
                type: 'edit',
                leadTask: leadTask,
            })
            .subscribe(() => this.getLeadTasks());
    }

    openTasksDeleteDialog(leadTask: LeadTask) {
        this.dialogService
            .openDialog(LeadTasksDialogComponent, {
                type: 'delete',
                leadTask: leadTask,
            })
            .subscribe(() => this.getLeadTasks());
    }

    openTaskAddDialog(lead: Lead) {
        this.dialogService
            .openDialog(LeadTasksDialogComponent, { type: 'add', lead: lead })
            .subscribe(() => this.getLeadTasks());
        this.tabGroup.selectedIndex = 2;
    }

    openCommentsAddDialog(lead: Lead) {
        this.dialogService
            .openDialog(LeadCommentsDialogComponent, {
                type: 'add',
                lead: lead,
            })
            .subscribe(() => this.getLeadComments());
        this.tabGroup.selectedIndex = 3;
    }

    openCommentEditDialog(leadComment: LeadComment) {
        this.dialogService
            .openDialog(LeadCommentsDialogComponent, {
                type: 'edit',
                leadComment: leadComment,
            })
            .subscribe(() => this.getLeadComments());
    }

    openCommentDeleteDialog(leadComment: LeadComment) {
        this.dialogService
            .openDialog(LeadCommentsDialogComponent, {
                type: 'delete',
                leadComment: leadComment,
            })
            .subscribe(() => this.getLeadComments());
    }

    openCommentViewDialog(leadComment: LeadComment) {
        this.dialogService
            .openDialog(LeadCommentsDialogComponent, {
                type: 'view',
                leadComment: leadComment,
            })
            .subscribe(() => this.getLeadComments());
    }

    changePage(event: PageEvent, module: string) {
        if (module == 'comment') {
            this.pageIndexComments = event.pageIndex + 1;

            if (this.pageIndexComments == 0) {
                this.pageIndexComments = 1;
            }
            this.getLeadComments();
        }

        if (module == 'task') {
            this.pageIndexTasks = event.pageIndex + 1;

            if (this.pageIndexTasks == 0) {
                this.pageIndexTasks = 1;
            }
            this.getLeadTasks();
        }

        if (module == 'file') {
            this.pageIndexFiles = event.pageIndex + 1;

            if (this.pageIndexFiles == 0) {
                this.pageIndexFiles = 1;
            }
            this.getLeadFiles();
        }
    }

    backClicked() {
        this.location.back();
    }

    removeTab() {
      this.tabService.removeItemById(this.lead_id);
    }

    onSidebarClick(data: string) {
        this.tabService.setSideTitle(data);
    }

    openFile(file: any, type: any) {
        this.dialogService
            .openDialog(ViewDocumentDialogComponent, { type: type, file: file })
            .subscribe(() => this.getLeadFiles());
        this.tabGroup.selectedIndex = 1;
    }

    openRecordResultDialog(lead: Lead) {
        this.dialogService
            .openDialog(RecordResultDialogComponent, { lead: lead })
            .subscribe((result) => {
                if (result) {
                    this.getLead();
                    this.getLeadOutcomes();
                }
            });
    }

    openConvertDialog(lead: Lead) {
        this.dialogService
            .openDialog(ClientConversionDialogComponent, { lead: lead })
            .subscribe((result) => {
                if (result) {
                    this.getLead();
                }
            });
    }

    getLeadCommunications(channel?: string) {
        this.communicationService
            .getLeadCommunications(this.lead_id, channel || undefined)
            .subscribe((comms) => {
                setTimeout(() => {
                    this.spinner.hide();
                }, 500);
                if (comms !== undefined) {
                    this.dataSourceCommunications = new MatTableDataSource(comms);
                }
            });
    }

    filterCommunications(channel: string | null) {
        this.communicationChannelFilter = channel;
        this.spinner.show();
        this.getLeadCommunications(channel || undefined);
    }

    getLeadOutcomes() {
        this.leadService.getLeadOutcomes(this.lead_id).subscribe({
            next: (outcomes) => {
                setTimeout(() => this.spinner.hide(), 500);
                this.leadOutcomes = outcomes || [];
                this.dataSourceOutcomes = new MatTableDataSource(this.leadOutcomes);
            },
            error: () => {
                this.spinner.hide();
                this.leadOutcomes = [];
                this.dataSourceOutcomes = new MatTableDataSource([]);
            },
        });
    }

    // --- Skip Trace / Owner Intelligence ---

    loadSkipTrace() {
        this.skipTraceService.getSkipTrace(this.lead_id).subscribe({
            next: (result) => {
                this.skipTrace = result;
            },
            error: () => {
                this.skipTrace = null;
            },
        });
    }

    runSkipTrace() {
        this.skipTraceLoading = true;
        this.skipTraceService.runSkipTrace(this.lead_id).subscribe({
            next: (result) => {
                this.skipTrace = result;
                this.skipTraceLoading = false;
                const status = result?.lookup_status;
                if (status === 'success') {
                    this.snackBar.open('Skip trace completed successfully.', 'Close', {
                        duration: 5000,
                        horizontalPosition: 'end',
                        verticalPosition: 'bottom',
                    });
                } else {
                    this.snackBar.open('Skip trace completed — ' + (status || 'no results'), 'Close', {
                        duration: 5000,
                        horizontalPosition: 'end',
                        verticalPosition: 'bottom',
                    });
                }
            },
            error: (err) => {
                this.skipTraceLoading = false;
                const detail = err?.error?.detail || 'Failed to run skip trace.';
                this.snackBar.open(detail, 'Close', {
                    duration: 5000,
                    horizontalPosition: 'end',
                    verticalPosition: 'bottom',
                });
            },
        });
    }

    retrySkipTrace() {
        this.runSkipTrace();
    }

    // --- Rescue ---

    loadRescueStatus() {
        this.rescueService.getStatus(this.lead_id).subscribe({
            next: (result) => {
                this.rescueStatus = result;
            },
            error: () => {
                this.rescueStatus = null;
            },
        });
    }

    // --- UPA Outreach Consent ---

    getContactStatusColor(status: string): string {
        const found = CONTACT_STATUS_OPTIONS.find(s => s.value === status);
        return found ? found.color : '#9e9e9e';
    }

    toggleOptOut(channel: string, checked: boolean) {
        if (!this.lead_id) return;
        if (checked) {
            this.upaOutreachService.optOut(this.lead_id, [channel]).subscribe({
                next: () => {
                    this.snackBar.open(`${channel.toUpperCase()} opt-out enabled`, 'OK', { duration: 2000 });
                    this.getLead();
                },
            });
        } else {
            this.upaOutreachService.optIn(this.lead_id, [channel]).subscribe({
                next: () => {
                    this.snackBar.open(`${channel.toUpperCase()} opt-in restored`, 'OK', { duration: 2000 });
                    this.getLead();
                },
            });
        }
    }
}
