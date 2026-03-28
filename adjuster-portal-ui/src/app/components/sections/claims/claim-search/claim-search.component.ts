import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { Claim } from 'src/app/models/claim.model';
import { ClientService } from 'src/app/services/client.service';
import { ClaimService } from 'src/app/services/claim.service';
import { DialogService } from 'src/app/services/dialog.service';
import { ExcelService } from 'src/app/services/excel.service';
import { UserService } from 'src/app/services/user.service';
import { TabService } from 'src/app/services/tab.service';
import { MatSort, Sort } from '@angular/material/sort';
import { Subscription } from 'rxjs';
import { ClaimDialogComponent } from 'src/app/components/dialogs/client-claim-dialog/claim-dialog.component';

@Component({
    selector: 'app-claim-search',
    templateUrl: './claim-search.component.html',
    styleUrls: ['./claim-search.component.scss'],
    standalone: false
})
export class ClaimSearchComponent implements OnInit {
    searchFormGroup = this._formBuilder.group({
        search: new FormControl('', [Validators.required]),
    });

    clients: any = [];
    claims: any = [];
    leads: any = [];

    displayedColumnsClaims: string[] = [
        'ref_number',
        'name',
        'address_loss',
        'phone_number',
        'email',
        'loss_date',
        'peril',
        'anticipated_amount',
        'fee',
        'current_phase',
        'source',
        'signed_by',
        'adjusted_by',
        'assigned_to',
        'insurance_company',
        'policy_number',
        'policy_type',
        'claim_number',
        'created_at',
        'updated_at',
    ];

    dataSourceClaims: MatTableDataSource<Claim>;
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild(MatSort) sort: MatSort;
    private queryParamsSubscription: Subscription;

    pageIndex = 1;
    pageSize = 10;
    pageSizeOptions = [10, 25, 50, 100, 500];
    totalRecords = 0;
    queryParams: any;

    constructor(
        public userService: UserService,
        private claimService: ClaimService,
        private _formBuilder: FormBuilder,
        private dialogService: DialogService,
        private clientService: ClientService,
        private spinner: NgxSpinnerService,
        private snackBar: MatSnackBar,
        private router: Router,
        private excelService: ExcelService,
        private tabService: TabService,
        private route: ActivatedRoute,
    ) {}

    ngOnInit(): void {

        if (localStorage.getItem('role-name')=='customer') {
            this.router.navigate(['/app/customer-cases']);
        }

        if (!this.userService.getUserPermissions('claim','read')) {
            return;
        }
        
        this.getRecentClaims();

        this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
            this.queryParams = {
                period_type: params['period_type'] || 'all-time',
            };

            if (this.searchFormGroup.get('search').value.trim()!=''){
                this.search();
            }
        });
    }

    ngOnDestroy(): void {
        this.queryParamsSubscription.unsubscribe();
    }

    async search() {
        this.spinner.show();

        let search_string = this.searchFormGroup.get('search').value.trim();
        this.queryParams['search_term'] = search_string;
        console.log(this.isValidUSPhoneNumber(search_string));

        if (this.isValidUSPhoneNumber(search_string)) {
            search_string = search_string.replace(/-/g, '');
            this.queryParams['search_term'] = search_string;
        }

        this.queryParams['page'] = this.pageIndex;
        this.queryParams['size'] = this.pageSize;


        const promise = new Promise<void>((resolve, reject) => {
            this.claimService.searchClaims(this.queryParams).subscribe({
                next: (claims: any) => {
                    if (claims !== undefined) {
                        this.dataSourceClaims = new MatTableDataSource(
                            claims.items.filter((row) => row.is_removed === false)
                        );

                        this.dataSourceClaims.filterPredicate = function (
                            data,
                            filter: string
                        ): boolean {
                            return (
                                data.claim_number
                                    .toLowerCase()
                                    .includes(filter) ||
                                data.ref_string.toLowerCase().includes(filter)
                            );
                        };

                        this.claims = claims;
                        this.totalRecords = claims.total;
                        this.pageIndex = claims.page;
                        this.pageSize = claims.size;
                        this.spinner.hide();
                    }
                },
                error: (err: any) => {
                    this.spinner.hide();
                    reject(err);
                },
                complete: () => {
                    this.spinner.hide();
                    resolve();
                },
            });
        });
        return promise;
    }

    getRecentClaims() {
        this.spinner.show();
        let claimData = {
            order_by: 'desc',
            sort_by: 'created_at',
            page: 1,
            size: 5
        };
    
        this.claimService.searchClaims(claimData).subscribe(
          (claims) => {
            this.spinner.hide();
            if (claims !== undefined) {
              this.claims = claims.items;
            }
          },
          (err) => {
            this.spinner.hide();
            let errorMessage = 'An error occurred while searching the claims.';
            if (err.error && err.error.detail && Array.isArray(err.error.detail)) {
              const detail = err.error.detail[0];
              if (detail.msg != '') {
                errorMessage = detail.msg;
              }
            }
          }
        );
      }

    announceSortChange(sortState: Sort) {
        const sortActive = sortState.active ? sortState.active : 'created_at';
        const sortDirection = sortState.direction ? sortState.direction : 'asc';
        this.queryParams['sort_by'] = sortActive;
        this.queryParams['order_by'] = sortDirection;
        this.paginator.pageIndex = 0;
        this.pageIndex = 1;

        this.claims
        this.search();
    }

    changePage(event: PageEvent) {
        this.pageIndex = event.pageIndex + 1;
        this.pageSize = event.pageSize;

        if (this.pageIndex == 0) {
            this.pageIndex = 1;
        }
        
        this.search();
    }

    onClaimDetail(id: string, name: string) {
        this.tabService.addItem({id, name, type:"claim"});
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

    onNavigate(side: string) {
        this.tabService.setSideTitle(side);
    }

    isValidUSPhoneNumber(search_string: string): boolean {
        const regex = /^(?:\+1)?[ -]?\(?(?:\d{3})\)?[ -.]?(?:\d{3})[ -.]?(?:\d{4})$/;
        return regex.test(search_string);
    }

    downloadExcel(data: any, type: string) {
        this.excelService.exportAsExcelFile(data, type);
    }

    downloadCsv(data: any, type: string) {
        this.excelService.exportAsCsvFile(data, type);
    }

    hasNumber(str) {
        return /\d/.test(str);
    }

    openClaimAddDialog() {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'add',
                client: null,
            })
            .subscribe((result: any) => {
                this.getRecentClaims();
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

    openClaimEditDialog(claim: any) {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'edit',
                claim: claim,
            })
            .subscribe(() => {
                if (this.searchFormGroup.get('search').value?.trim()) {
                    this.search();
                } else {
                    this.getRecentClaims();
                }
            });
    }

    openClaimDeleteDialog(claim: any) {
        this.dialogService
            .openDialog(ClaimDialogComponent, {
                type: 'delete',
                claim: claim,
            })
            .subscribe(() => {
                if (this.searchFormGroup.get('search').value?.trim()) {
                    this.search();
                } else {
                    this.getRecentClaims();
                }
            });
    }

}
