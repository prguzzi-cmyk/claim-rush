import { DatePipe } from '@angular/common';
import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Router } from '@angular/router';
import { Claim } from 'src/app/models/claim.model';
import { User } from 'src/app/models/user.model';
import { ClaimService } from 'src/app/services/claim.service';
import { UserService } from 'src/app/services/user.service';
import { DialogService } from 'src/app/services/dialog.service';
import { ClaimFilesDialogComponent } from 'src/app/components/dialogs/claim-files-dialog/claim-files-dialog.component';
import { ViewDocumentDialogComponent } from 'src/app/components/dialogs/view-document-dialog/view-document-dialog.component';
import { ClaimComment } from 'src/app/models/comment-claim.model';
import { ClaimFile } from 'src/app/models/files-claim.model';
import { ClaimPayment } from 'src/app/models/payment-claim.model';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTabGroup } from '@angular/material/tabs';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { PHASE_MILESTONES, getPhaseIndex, getPhaseLabel } from 'src/app/models/claim-phases.model';
import { getActivityIcon, getActivityColor, getActivityLabel } from 'src/app/models/claim-activity.model';

@Component({
    selector: 'app-customer-claim',
    templateUrl: './customer-claim.component.html',
    styleUrls: ['./customer-claim.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class CustomerClaimComponent implements OnInit, AfterViewChecked {
    @ViewChild('tabGroup') tabGroup: MatTabGroup;
    @ViewChild('messagesEnd') messagesEnd: ElementRef;
    @ViewChild('paymentSort') paymentSort: MatSort;

    claim: Claim;
    @Input() claim_id: string;
    user: User;

    phaseMilestones = PHASE_MILESTONES;
    activePhaseIndex = -1;

    // Payments
    claimPayments: ClaimPayment[] = [];
    dataSourcePayments: MatTableDataSource<ClaimPayment>;
    displayedColumnsPayments: string[] = ['payment_date', 'payment_type', 'check_amount', 'deposit_status'];
    totalPaymentsAmount = 0;

    // Documents
    claimFiles: ClaimFile[] = null;
    dataSourceFiles: MatTableDataSource<ClaimFile>;
    displayedColumnsFiles: string[] = ['name', 'description', 'created_at', 'created_by', 'actions'];
    totalRecordsFiles = 0;
    pageIndexFiles = 1;
    pageSizeFiles = 10;

    // Reports (filtered from files)
    reportFiles: ClaimFile[] = [];

    // Messages
    claimComments: ClaimComment[] = [];
    messageForm: FormGroup;
    messageFormDisabled = false;
    totalRecordsComments = 0;
    pageIndexComments = 1;

    // Timeline
    claimTimeline: any[] = null;
    getActivityIcon = getActivityIcon;
    getActivityColor = getActivityColor;
    getActivityLabel = getActivityLabel;

    // Pagination
    pageSizeOptions = [10, 25, 50];

    private shouldScrollMessages = false;

    constructor(
        private claimService: ClaimService,
        private router: Router,
        public datepipe: DatePipe,
        public userService: UserService,
        private snackBar: MatSnackBar,
        private spinner: NgxSpinnerService,
        private dialogService: DialogService
    ) {}

    ngOnInit(): void {
        if (this.claim_id) {
            this.getClaim();
        } else {
            this.router.navigate(['/app/customer-dashboard']);
        }

        this.messageForm = new FormGroup({
            text: new FormControl('', [Validators.required]),
        });

        this.userService.currentUser.subscribe((user) => {
            this.user = user;
        });
    }

    ngAfterViewChecked(): void {
        if (this.shouldScrollMessages) {
            this.scrollToBottom();
            this.shouldScrollMessages = false;
        }
    }

    getClaim(): void {
        this.spinner.show();
        this.claimService.getClaim(this.claim_id).subscribe(
            (claim) => {
                this.spinner.hide();
                if (claim) {
                    this.claim = claim;
                    this.activePhaseIndex = getPhaseIndex(claim.current_phase);
                }
            },
            () => {
                this.spinner.hide();
            }
        );
    }

    getPhaseStatus(index: number): string {
        if (this.activePhaseIndex < 0) return 'upcoming';
        if (index < this.activePhaseIndex) return 'completed';
        if (index === this.activePhaseIndex) return 'active';
        return 'upcoming';
    }

    getPhaseDisplayLabel(): string {
        return getPhaseLabel(this.claim?.current_phase, true);
    }

    // ── Payments Tab ──
    loadPayments(): void {
        this.spinner.show();
        this.claimService.getClaimPayments(this.claim_id, { page: 1, size: 1000 }).subscribe(
            (response) => {
                this.spinner.hide();
                if (response?.items) {
                    this.claimPayments = response.items;
                    this.dataSourcePayments = new MatTableDataSource(this.claimPayments);
                    if (this.paymentSort) {
                        this.dataSourcePayments.sort = this.paymentSort;
                    }
                    this.totalPaymentsAmount = this.claimPayments.reduce(
                        (sum, p) => sum + Number(p.check_amount || 0), 0
                    );
                }
            },
            () => this.spinner.hide()
        );
    }

    // ── Documents Tab ──
    loadFiles(): void {
        this.spinner.show();
        this.claimService.getClaimFiles(this.claim_id, this.pageIndexFiles, this.pageSizeFiles).subscribe(
            (response) => {
                this.spinner.hide();
                if (response?.items) {
                    this.claimFiles = response.items;
                    this.dataSourceFiles = new MatTableDataSource(this.claimFiles);
                    this.totalRecordsFiles = response.total;
                    this.pageIndexFiles = response.page;
                    this.pageSizeFiles = response.size;
                }
            },
            () => this.spinner.hide()
        );
    }

    changeFilesPage(event: PageEvent): void {
        this.pageIndexFiles = event.pageIndex + 1;
        this.pageSizeFiles = event.pageSize;
        this.loadFiles();
    }

    openFileUploadDialog(): void {
        this.dialogService
            .openDialog(ClaimFilesDialogComponent, {
                type: 'add',
                claim: this.claim,
            })
            .subscribe(() => this.loadFiles());
    }

    openFile(path: string, type: string): void {
        this.dialogService
            .openDialog(ViewDocumentDialogComponent, { type: type, file: path })
            .subscribe();
    }

    downloadFile(file: ClaimFile): void {
        if (file.path) {
            window.open(file.path, '_blank');
        }
    }

    // ── Reports Tab ──
    loadReports(): void {
        this.claimService.getClaimFiles(this.claim_id, 1, 100).subscribe(
            (response) => {
                if (response?.items) {
                    this.reportFiles = response.items.filter(
                        (f: ClaimFile) =>
                            f.type === 'application/pdf' ||
                            f.name?.toLowerCase().includes('report') ||
                            f.name?.toLowerCase().includes('estimate')
                    );
                }
            }
        );
    }

    getFileIcon(file: ClaimFile): string {
        if (file.type === 'application/pdf') return 'picture_as_pdf';
        if (file.type?.startsWith('image/')) return 'image';
        return 'insert_drive_file';
    }

    getFileIconColor(file: ClaimFile): string {
        if (file.type === 'application/pdf') return '#e53935';
        if (file.type?.startsWith('image/')) return '#1e88e5';
        return '#757575';
    }

    // ── Messages Tab ──
    loadMessages(): void {
        this.spinner.show();
        this.claimService.getClaimComments(this.claim_id, 1, 100).subscribe(
            (response) => {
                this.spinner.hide();
                if (response?.items) {
                    // Reverse to show oldest first (chronological)
                    this.claimComments = response.items.reverse();
                    this.totalRecordsComments = response.total;
                    this.shouldScrollMessages = true;
                }
            },
            () => this.spinner.hide()
        );
    }

    sendMessage(): void {
        if (!this.messageForm.valid) return;
        this.messageFormDisabled = true;
        const data = {
            text: this.messageForm.get('text').value,
            can_be_removed: true,
            visibility: 'shared',
        };
        this.claimService.addClaimComments(data, this.claim_id).subscribe(
            (result: any) => {
                this.messageFormDisabled = false;
                if (result?.id) {
                    this.messageForm.get('text').setValue('');
                    this.messageForm.markAsPristine();
                    this.messageForm.markAsUntouched();
                    this.loadMessages();
                    this.snackBar.open('Message sent', 'Close', {
                        duration: 3000,
                        horizontalPosition: 'end',
                        verticalPosition: 'bottom',
                    });
                }
            },
            () => {
                this.messageFormDisabled = false;
            }
        );
    }

    isOwnMessage(comment: ClaimComment): boolean {
        return comment?.created_by?.id === this.user?.id;
    }

    // ── Timeline Tab ──
    loadTimeline(): void {
        this.spinner.show();
        this.claimService.getClaimTimeline(this.claim_id).subscribe(
            (response) => {
                this.spinner.hide();
                if (response?.items) {
                    this.claimTimeline = response.items;
                }
            },
            () => this.spinner.hide()
        );
    }

    // ── Tab Change Handler ──
    tabChange(index: number): void {
        switch (index) {
            case 1:
                if (!this.claimPayments.length) this.loadPayments();
                break;
            case 2:
                if (!this.claimFiles) this.loadFiles();
                break;
            case 3:
                if (!this.claimComments.length) this.loadMessages();
                break;
            case 4:
                if (!this.reportFiles.length) this.loadReports();
                break;
            case 5:
                if (!this.claimTimeline) this.loadTimeline();
                break;
        }
    }

    private scrollToBottom(): void {
        try {
            if (this.messagesEnd) {
                this.messagesEnd.nativeElement.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (err) {}
    }

    goBack(): void {
        this.router.navigate(['/app/customer-dashboard']);
    }
}
