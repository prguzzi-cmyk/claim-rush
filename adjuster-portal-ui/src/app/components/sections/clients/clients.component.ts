import { ClientService } from 'src/app/services/client.service';
import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { Client } from 'src/app/models/client.model';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { UserService } from 'src/app/services/user.service';
import { DatePipe, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DialogService } from 'src/app/services/dialog.service';
import { ClientDetailsDialogComponent } from '../../dialogs/client-details-dialog/client-details-dialog.component';
import { FormBuilder } from '@angular/forms';
import { NgxSpinnerService } from 'ngx-spinner';
import { ExcelService } from 'src/app/services/excel.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ImportClientsDialogComponent } from '../../dialogs/import-clients-dialog/import-clients-dialog.component';
import { SelectionModel } from '@angular/cdk/collections';
import { TabService } from 'src/app/services/tab.service';
import { ClaimDetailsDialogComponent } from '../../dialogs/claim-details-dialog/claim-details-dialog.component';
import { ClaimDialogComponent } from '../../dialogs/client-claim-dialog/claim-dialog.component';
import { MatSort } from '@angular/material/sort';
import { Subscription } from 'rxjs';


@Component({
    selector: 'app-clients',
    templateUrl: './clients.component.html',
    styleUrls: ['./clients.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ClientsComponent implements OnInit {

    periods: string[] = ["current-year", "current-week", "last-month", "last-week", "last-180-days", "last-90-days", "last-30-days", "last-7-days"];
    displayedColumns: string[] = [
        'select',
        'ref_number',
        'full_name',
        'organization',
        'phone_number',
        'email',
        'address',
        'city',
        'state',
        'zip_code',
        'belonged_user',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
        'edit',
        'delete',
    ];
    displayedColumnsClaims: string[] = [
        'sn',
        'claim_number',
        'policy_number',
        'status',
        'created_at',
        'created_by',
        'edit',
        'delete',
    ];

    clients: Client[];

    searchFormGroup: any;
    period_type: string = 'last-30-days';

    searches: any[] = [
        { id: 'full_name', name: 'Full name' },
        { id: 'phone_number', name: 'Phone number' },
        { id: 'email', name: 'Email address' },
        { id: 'address', name: 'Address' },
        { id: 'city', name: 'City' },
        { id: 'ref_number', name: 'Client #' },
    ];

    clientIds: any[] = [];

    // Pagination
    dataSource: MatTableDataSource<Client>;
    @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
    selection = new SelectionModel<Client>(true, []);
    @ViewChild(MatSort) sort: MatSort;
    private queryParamsSubscription: Subscription;

    totalRecords = 0;
    pageSize = 10;
    pageSizeOptions = [10, 25, 50, 500];
    pageIndex = 1;

    selectionLength = 0;
    client_id: string;
    queryParams: any;

    constructor(
        public userService: UserService,
        private clientService: ClientService,
        private location: Location,
        private router: Router,
        private route: ActivatedRoute,
        private dialogService: DialogService,
        private formBuilder: FormBuilder,
        private spinner: NgxSpinnerService,
        private excelService: ExcelService,
        private snackBar: MatSnackBar,
        private tabService: TabService,
        public datepipe: DatePipe
    ) { }

    ngOnInit(): void {

        if (!this.userService.getUserPermissions('client', 'read')) {
            return;
        }

        this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
            this.queryParams = {
                period_type: params['period_type'] || 'all-time',
            };
            
            this.period_type = this.queryParams['period_type'];
            this.getClients();
        });

        this.searchFormGroup = this.formBuilder.group({
            search_string: null
        });

        this.searchFormGroup.get('search_string').valueChanges.subscribe(value => {
            if (value === '') {
            }
        });
    }

    ngAfterViewInit() {
        this.selection.changed.subscribe((x) => {
          this.selectionLength = x.source.selected.length;
        });
        this.sort?.sortChange.subscribe(() => this.paginator.pageIndex = 0);
        this.sort?.sortChange.subscribe(() => this.getClients());
    }

    /** Whether the number of selected elements matches the total number of rows. */
    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.dataSource.data.length;
        return numSelected === numRows;
    }

    /** Selects all rows if they are not all selected; otherwise clear selection. */
    masterToggle() {
        this.isAllSelected()
            ? this.selection.clear()
            : this.dataSource.data.forEach((row) => this.selection.select(row));
    }

    logSelection() {
        this.selection.selected.forEach((s) => console.log(s.full_name));
    }

    downloadExcel() {
        const flattenedClients = this.clients.map(client => this.flattenClient(client));
        this.excelService.exportAsExcelFile(flattenedClients, 'clients');
    }

    downloadCsv() {
        const flattenedClients = this.clients.map(client => this.flattenClient(client));
        this.excelService.exportAsCsvFile(flattenedClients, 'clients');
    }

    onClientDetail(id: string, name: string) {
        this.tabService.addItem({id, name, type:"client"});
    }

    onNavigate(side: string) {
        this.tabService.setSideTitle(side);
    }

    changePage(event: PageEvent) {
        this.pageIndex = event.pageIndex + 1;
        this.pageSize = event.pageSize;


        if (this.pageIndex == 0) {
            this.pageIndex = 1;
        }
        
        if (!this.searchFormGroup.get('search_string').value) {
            this.getClients();
        } else {
            this.search(event.pageIndex + 1, event.pageSize);
        }
    }

    getClients() {
        this.spinner.show();
        const sortDirection = this.sort?.direction || 'desc';
        const sortActive = this.sort?.active || 'created_at';
        this.queryParams['sort_by'] = sortActive;
        this.queryParams['order_by'] = sortDirection;

        this.clientService.getClients(this.pageIndex, this.pageSize, this.queryParams).subscribe(
            response => {
                if (response !== undefined) {
                    this.clients = response.items;
                    this.dataSource = new MatTableDataSource(
                        response?.items?.filter((row) => row.is_removed === false)
                    );
                    this.totalRecords = response.total;
                    this.pageIndex = response.page;
                    this.pageSize = response.size;
                    this.spinner.hide();
                }
            },
            (error) => {
                this.spinner.hide();
            }
        );
    }

    searchClients() {
        this.pageIndex = 1;
        this.pageSize = 10;
        this.search();
    }

    search(page: number = 1, pageSize: number = this.pageSize) {
        this.spinner.show();

        const sortDirection = this.sort?.direction || 'desc';
        const sortActive = this.sort?.active || 'created_at';
        this.queryParams['sort_by'] = sortActive;
        this.queryParams['order_by'] = sortDirection;

        if (page == 1 ) {
            this.paginator.pageIndex = 0;
        }

        if (this.searchFormGroup.valid) {

            let search_string = this.searchFormGroup.get('search_string').value.trim();

            if (this.isValidUSPhoneNumber(search_string)) {
                search_string = search_string.replace(/-/g, '');
            }
            this.clientService.searchClients(page, pageSize, search_string, this.queryParams).subscribe(
                response => {
                    if (response !== undefined) {
                        this.clients = response.items;
                        this.dataSource = new MatTableDataSource(
                            response?.items?.filter((row) => row.is_removed === false)
                        );
                        this.totalRecords = response.total;
                        this.pageIndex = response.page;
                        this.pageSize = response.size;
                        this.spinner.hide();
                    }
                },
                (error) => {
                    this.spinner.hide();
                }
            );
        }
    }

    filterClients(period_type: string) {

        this.searchFormGroup.controls['search_string'].setValue('');

        localStorage.setItem("period_type", period_type);

        this.route.queryParams.subscribe(params => {
            const newParams = { ...params, period_type: period_type };

            // Navigate with the updated parameters
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: newParams,
                queryParamsHandling: ''  // Do not use 'merge' since we're manually handling it
            });
        });

        this.period_type = period_type;
    }

    clearSearch() {
        this.searchFormGroup.controls['search_string'].setValue('');
        this.paginator.pageIndex = 0;
        this.pageIndex = 1;
        this.pageSize = 10;
        this.period_type = this.queryParams['period_type'];
        this.getClients();
    }

    isValidUSPhoneNumber(search_string: string): boolean {
        const regex = /^(?:\+1)?[ -]?\(?(?:\d{3})\)?[ -.]?(?:\d{3})[ -.]?(?:\d{4})$/;
        return regex.test(search_string);
    }

    applyFilter(filterValue: string) {
        this.dataSource.filter = filterValue.trim().toLowerCase();

        if (this.dataSource.paginator) {
            this.dataSource.paginator.firstPage();
        }
    }

    viewClient(id: string) {
        this.router.navigate(['/app/client/', id]);
    }

    import() {
        this.dialogService
            .openDialog(ImportClientsDialogComponent, { type: 'add' })
            .subscribe(() => this.getClients());
    }

    openCreateClientDialog() {
        this.dialogService
            .openDialog(ClientDetailsDialogComponent, { type: 'add' })
            .subscribe((client) => { 
                if (client) {
                    this.getClients();
                    this.dialogService.openDialog(ClaimDialogComponent, {type: 'add', client: client })

                } else {
                    this.getClients();
                }
                
            });
    }

    openClientEditDialog(client: Client) {
        this.dialogService
            .openDialog(ClientDetailsDialogComponent, {
                type: 'edit',
                client: client,
            })
            .subscribe(() => this.getClients());
    }

    openClientMultipleEditDialog() {
        this.dialogService
            .openDialog(ClientDetailsDialogComponent, {
                type: 'multiple',
                selection: this.selection,
            })
            .subscribe(() => {
                this.getClients();
                this.selection.clear();
            });
    }

    openClientMultipleDeleteDialog() {
        this.dialogService
            .openDialog(ClientDetailsDialogComponent, {
                type: 'multiple-delete',
                selection: this.selection,
            })
            .subscribe(() => {
                this.getClients();
                this.selection.clear();
            });
    }

    openClientDeleteDialog(client: Client) {
        this.dialogService
            .openDialog(ClientDetailsDialogComponent, {
                type: 'delete',
                client: client,
            })
            .subscribe(() => this.getClients());
    }

    searchChange(event: any) {
        if (this.searchFormGroup.get('search').value == '') {
            this.getClients();
        }
    }

    ngOnDestroy(): void {
        this.queryParamsSubscription.unsubscribe();
    }

    private flattenClient(client: Client): any {
        const flattened: any = {
            client_ref_number: client.ref_string,
            full_name: client.full_name,
            full_name_alt: client.full_name_alt,
            email: client.email,
            email_alt: client.email_alt,
            phone_number: client.phone_number,
            phone_number_alt: client.phone_number_alt,
            address: client.address,
            city: client.city,
            state: client.state,
            zip_code: client.zip_code,
            organization: client.organization,
            assigned_to: client.belonged_user?.first_name + ' ' + client.belonged_user?.last_name,
            is_active: client.is_active,
            is_removed: client.is_removed,
            created_by: client.created_by?.first_name + ' ' + client.created_by?.last_name,
            updated_by: client.updated_by ? client.updated_by?.first_name + ' ' + client.updated_by?.last_name : '',
            created_at: this.datepipe.transform(client.created_at, 'yyyy-MM-dd'),
            updated_at: client.updated_at ? this.datepipe.transform(client.updated_at, 'yyyy-MM-dd') : '',
        };
    
        return flattened;
    }
    

    backClicked() {
        this.location.back();
    }
}
