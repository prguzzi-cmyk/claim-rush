import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { Claim } from 'src/app/models/claim.model';
import { User } from 'src/app/models/user.model';
import { ClientService } from 'src/app/services/client.service';
import { DialogService } from 'src/app/services/dialog.service';
import { UserService } from 'src/app/services/user.service';
import { Location } from '@angular/common';
import { DatePipe } from '@angular/common';
import { ClaimDialogComponent } from 'src/app/components/dialogs/client-claim-dialog/claim-dialog.component';
import { FormBuilder } from '@angular/forms';
import { ClaimService } from 'src/app/services/claim.service';
import { Client } from 'src/app/models/client.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { ExcelService } from 'src/app/services/excel.service';
import { ImportClaimsDialogComponent } from 'src/app/components/dialogs/import-claims-dialog/import-claims-dialog.component';
import { SelectionModel } from '@angular/cdk/collections';
import { ClaimDetailsDialogComponent } from 'src/app/components/dialogs/claim-details-dialog/claim-details-dialog.component';
import { Subscription } from 'rxjs';
import { TabService } from 'src/app/services/tab.service';
import { MatSort } from '@angular/material/sort';

@Component({
    selector: 'app-claims',
    templateUrl: './claims.component.html',
    styleUrls: ['./claims.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ClaimsComponent implements OnInit {

    title: string = 'Claims Dashboard';
    private queryParamsSubscription: Subscription;
    periods: string[] = ["current-year", "current-week", "last-month", "last-week", "last-180-days", "last-90-days", "last-30-days", "last-7-days"];

    displayedColumnsClaims: string[] = [
        'select',
        'ref_number',
        'name',
        'phone_number',
        'email',
        'current_phase',
        'origin_type',
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
    searchFormGroup: any;

    dataSourceClaims: MatTableDataSource<Claim>;
    @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
    selection = new SelectionModel<Client>(true, []);
    @ViewChild(MatSort) sort: MatSort;

    claims: Claim[];
    queryParams: any;

    searches: any[] = [
        { id: 'ref_number', name: 'Ref. #' },
        { id: 'claim_number', name: 'Claim #' },
        { id: 'current_phase', name: 'Current phase' },
        { id: 'created_at', name: 'Creation date' },
    ];

    totalRecords: number;
    pageSize = 10;
    pageSizeOptions = [10, 25, 50, 500, 1000];
    pageIndex = 1;
    selectionLength = 0;

    user: User;

    period_type: string = 'current-year';
    null_anticipated_amount: any = null;
    phase: any = null;

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        public userService: UserService,
        private clientService: ClientService,
        private claimService: ClaimService,
        private location: Location,
        private _formBuilder: FormBuilder,
        private dialogService: DialogService,
        private spinner: NgxSpinnerService,
        public datepipe: DatePipe,
        private snackBar: MatSnackBar,
        private excelService: ExcelService,
        private tabService: TabService
    ) { }

    ngOnInit(): void {

        if (!this.userService.getUserPermissions('claim', 'read')) {
            return;
        }

        this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
            this.queryParams = {
                period_type: params['period_type'] || 'current-year',
                null_anticipated_amount: params['null_anticipated_amount'] || null,
                phase: params['phase'] || null,
            };
            this.period_type = this.queryParams['period_type'];
            this.getClaims();
        });

        this.searchFormGroup = this._formBuilder.group({
            search_string: null
        });

        this.getUser();
        
    }

    ngOnDestroy(): void {
        this.queryParamsSubscription.unsubscribe();
    }

    ngAfterViewInit() {
        this.selection.changed.subscribe((x) => {
            this.selectionLength = x.source.selected.length;
        });

        this.sort?.sortChange.subscribe(() => this.paginator.pageIndex = 0);
        this.sort?.sortChange.subscribe(() => this.getClaims());
        // this.paginator.page.subscribe(() => this.getClaims(this.pageIndex, this.pageSize));
    }

    getUser() {
        this.userService.currentUser.subscribe((user) => {
            if (user) {
                this.user = user;
            }
        });
    }

    /** Whether the number of selected elements matches the total number of rows. */
    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.dataSourceClaims.data.length;
        return numSelected === numRows;
    }

    /** Selects all rows if they are not all selected; otherwise clear selection. */
    masterToggle() {
        this.isAllSelected()
            ? this.selection.clear()
            : this.dataSourceClaims.data.forEach((row) =>
                this.selection.select(row)
            );
    }

    logSelection() {
        this.selection.selected.forEach((s) => console.log(s.full_name));
    }

    filterClaimsByAgent(user: User, type: string) {

        this.searchFormGroup.controls['search_string'].setValue('');
        let email =  user?.email;
        let name =  user?.first_name + ' ' + user?.last_name;

        delete this.queryParams['source'];
        delete this.queryParams['signed_by'];
        delete this.queryParams['adjusted_by'];
        delete this.queryParams['assigned_to'];

        if (email == '' || type == '') {
            return;
        }

        this.userService.getUsersReport(1,1, {email: email}).subscribe(
            (user) => {
              this.spinner.hide();
              if (user !== undefined) {
                this.title = "Claims Dashboard";

                if(type == 'source') {
                    this.queryParams['source'] = user?.items[0]?.id;
                    this.title = "Claims Dashboard - (Sourced by: " + name + ')';
                }

                if(type == 'sign') {
                    this.queryParams['signed_by'] = user?.items[0]?.id;
                    this.title = "Claims Dashboard - (Signed by: " + name + ')';
                }

                if(type == 'adjust') {
                    this.queryParams['adjusted_by'] = user?.items[0]?.id;
                    this.title = "Claims Dashboard - (Adjusted by: " + name + ')';
                }

                if(type == 'assign') {
                    this.queryParams['assigned_to'] = user?.items[0]?.id;
                    this.title = "Claims Dashboard - (Assigned to: " + name + ')';
                }


                this.getClaims();

              }
            }
          );

    }

    filterClaims(period_type: string) {
        delete this.queryParams['source'];
        delete this.queryParams['signed_by'];
        delete this.queryParams['adjusted_by'];
        delete this.queryParams['assigned_to'];

        this.searchFormGroup.controls['search_string'].setValue('');
        localStorage.setItem("period_type", period_type);
        const newParams = { ...this.queryParams, period_type: period_type };

        // Navigate with the updated parameters
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: newParams,
            queryParamsHandling: ''  // Do not use 'merge' since we're manually handling it
        });

        this.period_type = period_type;
    }

    getClaims() {
        this.spinner.show();

        const sortDirection = this.sort?.direction || 'desc';
        const sortActive = this.sort?.active || 'created_at';
        this.queryParams['sort_by'] = sortActive;
        this.queryParams['order_by'] = sortDirection;

        this.claimService.getClaimsReport(this.pageIndex, this.pageSize, this.queryParams).subscribe(
            (claims) => {
                this.spinner.hide();
                if (claims !== undefined) {

                    this.claims = claims?.items;
                    this.dataSourceClaims = new MatTableDataSource(
                        claims?.items.filter((row) => row.is_removed === false)
                    );

                    this.dataSourceClaims.filterPredicate = function (
                        data,
                        filter: string
                    ): boolean {
                        return (
                            data.current_phase.toLowerCase().includes(filter) ||
                            data.origin_type?.toLowerCase().includes(filter) ||
                            data.claim_number?.toLowerCase().includes(filter) ||
                            data.ref_string?.toLowerCase().includes(filter) ||
                            data.client?.full_name?.includes(filter) ||
                            data.client?.email?.includes(filter) ||
                            data.claim_contact?.address_loss
                                ?.toLowerCase()
                                .includes(filter) ||
                            data.claim_contact?.city_loss
                                ?.toLowerCase()
                                .includes(filter) ||
                            data.claim_contact?.zip_code_loss
                                ?.toLowerCase()
                                .includes(filter) ||
                            data.claim_contact?.state_loss
                                ?.toLowerCase()
                                .includes(filter) ||
                            data.peril?.toLowerCase().includes(filter) ||
                            data.signed_by_user?.first_name.toLowerCase().includes(filter) ||
                            data.signed_by_user?.last_name.toLowerCase().includes(filter) ||
                            data.source_user?.first_name.toLowerCase().includes(filter) ||
                            data.source_user?.last_name.toLowerCase().includes(filter) ||
                            data.adjusted_by_user?.first_name.toLowerCase().includes(filter) ||
                            data.adjusted_by_user?.last_name.toLowerCase().includes(filter) ||
                            data.policy_number
                                ?.toLowerCase()
                                .includes(filter) ||
                            data.instructions_or_notes
                                ?.toString()
                                .includes(filter)

                        );
                    };
                    this.dataSourceClaims.sort = this.sort;
                    this.totalRecords = claims.total;
                    this.pageIndex = claims.page;
                    this.pageSize = claims.size;
                }
            },
            (error) => {
                this.spinner.hide();
            }
        );
    }

    changePage(event: PageEvent) {
        this.pageIndex = event.pageIndex + 1;
        this.pageSize = event.pageSize;

        if (this.pageIndex == 0) {
            this.pageIndex = 1;
        }
        
        if (!this.searchFormGroup.get('search_string').value) {
            this.getClaims();
        } else {
            this.search();
        }
    }

    onClaimDetail(id: string, name: string) {
        this.tabService.addItem({id, name, type:"claim"});
    }

    onNavigate(side: string) {
        this.tabService.setSideTitle(side);
    }

    downloadExcel() {
        const flattenedClaims = this.claims.map(claim => this.flattenClaim(claim));
        this.excelService.exportAsExcelFile(flattenedClaims, 'claims');
    }

    downloadCsv() {
        const flattenedClaims = this.claims.map(claim => this.flattenClaim(claim));
        this.excelService.exportAsCsvFile(flattenedClaims, 'claims');
    }

    searchClaims() {
        this.title = "Claims Dashboard";
        this.pageIndex = 1;
        this.pageSize = 10;
        this.search();
      }

    search() {
        this.spinner.show();

        if (this.pageIndex == 1 ) {
            this.paginator.pageIndex = 0;
        }
        
        this.claims = [];

        this.searchFormGroup.markAllAsTouched();

        if (this.searchFormGroup.valid) {
            let search_string = this.searchFormGroup.get('search_string').value.trim();

            if (this.isValidUSPhoneNumber(search_string)) {
                search_string = search_string.replace(/-/g, '');
            }

            this.queryParams['search_term'] = search_string;
            this.queryParams['page'] = this.pageIndex;
            this.queryParams['size'] = this.pageSize;

            this.claimService.searchClaims(this.queryParams).subscribe(
                (claims) => {
                    this.spinner.hide();
                    this.claims = claims?.items;
                    if (claims !== undefined) {
                        // filter deleted claims
                        this.dataSourceClaims = new MatTableDataSource(
                            claims?.items?.filter((row) => row.is_removed === false)
                        );

                        this.dataSourceClaims.filterPredicate = function (
                            data,
                            filter: string
                        ): boolean {
                            return (
                                data.client.full_name.includes(filter)
                            );
                        };

                        this.totalRecords = claims.total;
                        this.pageIndex = claims.page;
                        this.pageSize = claims.size;
                    }
                },
                (error) => {
                    this.spinner.hide();
                }
            );
        }
    }

    applyFilter(filterValue: string) {
        this.dataSourceClaims.filter = filterValue.trim().toLowerCase();

        if (this.dataSourceClaims.paginator) {
            this.dataSourceClaims.paginator.firstPage();
        }
    }

    openClaimAddDialog(client: Client = null) {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'add',
                client: client,
            })
            .subscribe((result: any) => {
                this.getClaims();
                if (result?.created && result?.claim) {
                    const claim = result.claim;
                    this.tabService.addItem({
                        id: claim.id,
                        name: `${claim.client?.full_name || 'New'}-${claim.ref_string?.slice(-3) || ''}`,
                        type: 'claim',
                    });
                }
            });
    }

    openClaimEditDialog(claim: Claim) {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'edit',
                claim: claim,
            })
            .subscribe(() => this.getClaims());
    }

    openClaimDeleteDialog(claim: Claim) {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'delete',
                claim: claim,
            })
            .subscribe(() => this.getClaims());
    }

    openClaimViewDialog(claim: Claim) {
        this.router.navigate(['/app/claim/', claim.id]);
    }

    searchClaimChange(event: any) {
        if (this.searchFormGroup.get('search').value == '') {
            this.searchFormGroup.reset();
            this.getClaims();
        }
    }

    import() {
        this.dialogService
            .openDialog(ImportClaimsDialogComponent, { type: 'add' })
            .subscribe(() => this.getClaims());
    }

    openClaimMultipleEditDialog() {
        this.dialogService
            .openDialog(ClaimDetailsDialogComponent, {
                type: 'multiple',
                selection: this.selection,
            })
            .subscribe(() => {
                this.getClaims();
                this.selection.clear();
            });
    }

    openClaimMultipleDeleteDialog() {
        this.dialogService
            .openDialog(ClaimDetailsDialogComponent, {
                type: 'multiple-delete',
                selection: this.selection,
            })
            .subscribe(() => {
                this.getClaims();
                this.selection.clear();
            });
    }

    clearSearch() {
        this.title = 'Claims Dashboard';
        delete this.queryParams['source'];
        delete this.queryParams['signed_by'];
        delete this.queryParams['adjusted_by'];
        delete this.queryParams['assigned_to'];
        this.searchFormGroup.controls['search_string'].setValue('');
        this.paginator.pageIndex = 0;
        this.pageIndex = 1;
        this.pageSize = 10;
        this.period_type = this.queryParams['period_type'];
        this.getClaims();
    }

    isValidUSPhoneNumber(search_string: string): boolean {
        const regex = /^(?:\+1)?[ -]?\(?(?:\d{3})\)?[ -.]?(?:\d{3})[ -.]?(?:\d{4})$/;
        return regex.test(search_string);
    }

    onClientDetail(id: string, name: string) {
        this.clientService.getClient(id).subscribe(
            (client) => {
                if (client !== undefined) {
                    this.tabService.addItem({id, name: `${name}-${client.ref_string.slice(-3)}`, type:"client"});
                }
            },
            (error) => {
                this.spinner.hide();
            }
        );
    }

    private flattenClaim(claim: Claim): any {
        const flattened: any = {
            claim_ref_number: claim.ref_string,
            client_full_name: claim.client?.full_name,
            client_phone_number: claim.client?.phone_number,
            client_email: claim.client?.email,
            claim_business_email: claim.claim_business_email?.email,
            loss_date: this.datepipe.transform(claim.loss_date, 'yyyy-MM-dd'),
            peril: claim.peril,
            insurance_company: claim.insurance_company,
            policy_number: claim.policy_number,
            claim_number: claim.claim_number,
            address_loss: claim.claim_contact?.address_loss,
            city_loss: claim.claim_contact?.city_loss,
            state_loss: claim.claim_contact?.state_loss,
            zip_code_loss: claim.claim_contact?.zip_code_loss,
            is_active: claim.is_active,
            fee: claim.fee,
            fee_type: claim.fee_type,
            fee_amount: claim.anticipated_amount,
            current_phase: claim.current_phase,
            policy_type: claim.policy_type,
            sub_policy_type: claim.sub_policy_type,
            mortgage_company: claim.mortgage_company,
            coverage_type_1: '',
            policy_limit_1: '',
            coverage_type_2: '',
            policy_limit_2: '',
        };
    
        // Create a separate object for coverages
        const coverages: any = {};
        claim.coverages?.forEach((coverage, index) => {
            coverages[`coverage_type_${index + 1}`] = coverage.coverage_type;
            coverages[`policy_limit_${index + 1}`] = coverage.policy_limit;
        });
    
        const remainingFields = {
            fema_claim: (claim.fema_claim == true ? 'Yes' : 'No'),
            state_of_emergency: (claim.state_of_emergency == true ? 'Yes' : 'No'),
            inhabitable: (claim.inhabitable == true ? 'Yes' : 'No'),
            contract_sign_date: claim.contract_sign_date,
            lawsuit_deadline: claim.lawsuit_deadline,
            assigned_to: claim.assigned_user?.first_name + ' ' + claim.assigned_user?.last_name,
            sourced_by: claim.source_user?.first_name + ' ' + claim.source_user?.last_name,
            signed_by: claim.signed_by_user?.first_name + ' ' + claim.signed_by_user?.last_name,
            adjusted_by: claim.adjusted_by_user?.first_name + ' ' + claim.adjusted_by_user?.last_name,
            source_info: claim.source_info,
            notes: claim.instructions_or_notes,
            created_by: claim.created_by?.first_name + ' ' + claim.created_by?.last_name,
            updated_by: claim.updated_by ? claim.updated_by?.first_name + ' ' + claim.updated_by?.last_name : '',
            created_at: this.datepipe.transform(claim.created_at, 'yyyy-MM-dd'),
            updated_at: claim.updated_at ? this.datepipe.transform(claim.updated_at, 'yyyy-MM-dd') : '',
        };
    
        // Merge the objects in the desired order
        return { ...flattened, ...coverages, ...remainingFields };
    }

    backClicked() {
        this.location.back();
    }
}
