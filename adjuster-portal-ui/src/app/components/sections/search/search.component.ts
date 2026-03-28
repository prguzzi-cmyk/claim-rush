import { DatePipe } from "@angular/common";
import { Component, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormControl, Validators } from "@angular/forms";
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTableDataSource } from "@angular/material/table";
import { ActivatedRoute, Router } from "@angular/router";
import { NgxSpinnerService } from "ngx-spinner";
import { Claim } from "src/app/models/claim.model";
import { Client } from "src/app/models/client.model";
import { Lead } from "src/app/models/lead.model";
import { ClaimService } from "src/app/services/claim.service";
import { ClientService } from "src/app/services/client.service";
import { DialogService } from "src/app/services/dialog.service";
import { LeadService } from "src/app/services/leads.service";
import { UserService } from "src/app/services/user.service";
import { ExcelService } from "src/app/services/excel.service";
import { MatTabGroup } from "@angular/material/tabs";
import { TabService } from 'src/app/services/tab.service';
import { Subscription } from "rxjs";
import { MatSort } from "@angular/material/sort";

@Component({
    selector: "app-search",
    templateUrl: "./search.component.html",
    styleUrls: ["./search.component.scss"],
    standalone: false
})
export class SearchComponent implements OnInit {
  searchFormGroup = this._formBuilder.group({
    search: new FormControl("", [Validators.required]),
  });

  clients: any = [];
  claims: any = [];
  leads: any = [];
  queryParams: any;

  displayedColumnsClients: string[] = [
    "sn",
    "ref_string",
    "full_name",
    "email",
    "created_at",
    "created_by",
  ];

  displayedColumnsClaims: string[] = [
    "sn",
    "ref_string",
    "name",
    "loss_address",
    "phase",
    "created_at",
    "created_by",
  ];

  displayedColumnsLeads: string[] = [
    "sn",
    "ref_string",
    "full_name",
    "phone_number",
    "email",
    "source",
    "status",
    "created_by",
    "created_at",
  ];

  // Pagination
  dataSourceClients: MatTableDataSource<Client>;
  @ViewChild("paginator", { static: false }) paginatorClients: MatPaginator;

  dataSourceLeads: MatTableDataSource<Lead>;
  @ViewChild("paginatorLeads", { static: false }) paginatorLeads: MatPaginator;

  dataSourceClaims: MatTableDataSource<Claim>;
  @ViewChild("paginatorClaims", { static: false }) paginatorClaims: MatPaginator;
  private queryParamsSubscription: Subscription;
  @ViewChild(MatSort) sort: MatSort;

  pageIndexClients = 1;
  pageIndexLeads = 1;
  pageIndexClaims = 1;
  pageSizeLeads = 10;
  pageSizeClients = 10;
  pageSizeClaims = 10;
  pageSizeOptions = [10, 25, 50];
  totalClients = 0;
  totalClaims = 0;
  totalLeads = 0;
  period_type: string = 'last-30-days';


  constructor(
    public userService: UserService,
    private clientService: ClientService,
    private leadService: LeadService,
    private claimService: ClaimService,
    private _formBuilder: FormBuilder,
    private dialogService: DialogService,
    private spinner: NgxSpinnerService,
    private snackBar: MatSnackBar,
    private excelService: ExcelService,
    private tabService: TabService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      this.queryParams = {
        period_type: params['period_type'] || '',
      };
      this.period_type = this.queryParams['period_type'];
    });
  }

  ngAfterViewInit() {
    this.sort?.sortChange.subscribe(() => this.paginatorClients.pageIndex = 0);
    this.sort?.sortChange.subscribe(() => this.searchClients(this.searchFormGroup.get('search').value));
  }

  search() {
    this.clients = [];
    this.leads = [];
    this.claims = [];

    if (this.userService.getUserPermissions('client', 'read')) {
      this.searchClients(this.searchFormGroup.get('search').value);
    }

    if (this.userService.getUserPermissions('lead', 'read')) {
      this.searchLeads(this.searchFormGroup.get('search').value);
    }

    if (this.userService.getUserPermissions('claim', 'read')) {
      this.searchClaims(this.searchFormGroup.get('search').value);
    }

  }

  searchClients(search_term: string) {
    this.spinner.show();

    const sortDirection = this.sort?.direction || 'desc';
    const sortActive = this.sort?.active || 'created_at';
    this.queryParams['sort_by'] = sortActive;
    this.queryParams['order_by'] = sortDirection;
    this.queryParams['period_type'] = 'all-time';

    this.clientService.searchClients(this.pageIndexClients, this.pageSizeClients, search_term, this.queryParams).subscribe(
      (clients) => {
        if (clients !== undefined) {
          this.clients = clients.items;

          this.dataSourceClients = new MatTableDataSource(
            this.clients.filter((row) => row.is_removed === false)
          );
          // this.dataSourceClients.paginator = this.paginatorClients;

          this.pageSizeClients = clients.size;
          this.pageIndexClients = clients.page;
          this.totalClients = clients.total;

          this.spinner.hide();
        }
      },
      (error) => {
        this.spinner.hide();
      }
    );
  }

  searchLeads(search_term: string) {
    this.spinner.show();

    this.leadService.searchLeads(this.pageIndexLeads, this.pageSizeLeads, search_term).subscribe(
      (leads) => {
        if (leads !== undefined) {

          this.leads = leads.items;

          this.dataSourceLeads = new MatTableDataSource(
            this.leads.filter((row) => row.is_removed === false)
          );

          // this.dataSourceLeads.paginator = this.paginatorLeads;
          this.pageSizeLeads = leads.size;
          this.pageIndexLeads = leads.page;
          this.totalLeads = leads.total;

        }
        this.spinner.hide();
      },
      (error) => {
        this.spinner.hide();
      }
    );
  }

  onReportSelected(event: any) {
    const selectedValue = event.value;
    // Navigate to the URL with parameters

    if (selectedValue == 'claims-all-time') {
      this.router.navigate(['/app/claims'], { queryParams: { period_type: 'all-time' } });
    }

    if (selectedValue == 'claim-reported') {
      this.router.navigate(['/app/claims'], { queryParams: { phase: 'claim-reported', period_type: 'all-time' } });
    }

    if (selectedValue == 'claim-closed') {
      this.router.navigate(['/app/claims'], { queryParams: { phase: 'claim-closed', period_type: 'all-time' } });
    }

    if (selectedValue == 'lawsuit') {
      this.router.navigate(['/app/claims'], { queryParams: { phase: 'lawsuit', period_type: 'all-time' } });
    }

    if (selectedValue == 'null_anticipated_amount-true') {
      this.router.navigate(['/app/claims'], { queryParams: { null_anticipated_amount: true, period_type: 'all-time' } });
    }

    if (selectedValue == 'null_anticipated_amount-false') {
      this.router.navigate(['/app/claims'], { queryParams: { null_anticipated_amount: false, period_type: 'all-time' } });
    }

    if (selectedValue == 'claim-payments-ready') {
      this.router.navigate(['/app/claim/payments-ready'], { queryParams: { } });
    }

    if (selectedValue == 'clients-all-time') {
      this.router.navigate(['/app/clients'], { queryParams: { period_type: 'all-time' } });
    }

    if (selectedValue == 'leads-all-time') {
      this.router.navigate(['/app/leads'], { queryParams: { period_type: 'all-time' } });
    }

    if (selectedValue == 'user-all-data') {
      this.router.navigate(['/app/user-dashboard'], { queryParams: { period_type: 'all-time' } });
    }

  }


  searchClaims(search_term: string) {
    this.spinner.show();

    this.queryParams['search_term'] = search_term;
    this.queryParams['page'] = this.pageIndexClaims;
    this.queryParams['size'] = this.pageSizeClaims;
    this.queryParams['period_type'] = 'all-time';

    this.claimService.searchClaims(this.queryParams).subscribe(
      (claims) => {
        if (claims !== undefined) {

          this.claims = claims.items;

          // filter deleted claims
          this.dataSourceClaims = new MatTableDataSource(
            this.claims.filter((row) => row.is_removed === false)
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

          // this.dataSourceClaims.paginator = this.paginatorClaims;
          this.pageSizeClaims = claims.size;
          this.pageIndexClaims = claims.page;
          this.totalClaims = claims.total;

          this.spinner.hide();

        }
      },
      (error) => {
        this.spinner.hide();
      }
    );
  }

  onSearchDetail(id: string, name: string, type: string) {
    this.tabService.addItem({ id, name, type });
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

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  changePage(event: PageEvent, module: string) {


    if (this.searchFormGroup.get('search').value) {

      if (module == 'clients') {
        this.pageIndexClients = event.pageIndex + 1;
        this.pageSizeClients = event.pageSize;
        this.searchClients(this.searchFormGroup.get('search').value);
      }

      if (module == 'claims') {
        this.pageIndexClaims = event.pageIndex + 1;
        this.pageSizeClaims = event.pageSize;
        this.searchClaims(this.searchFormGroup.get('search').value);
      }

      if (module == 'leads') {
        this.pageIndexLeads = event.pageIndex + 1;
        this.pageSizeLeads = event.pageSize;
        this.searchLeads(this.searchFormGroup.get('search').value);
      }

      this.pageIndexClients = event.pageIndex + 1;
      this.pageSizeClients = event.pageSize;
      // this.totalClients = event.length;
      this.searchClients(this.searchFormGroup.get('search').value);
    }
  }

  displayError(error: any) {
    this.snackBar.open("Error: " + error, "Close", {
      duration: 10000,
      horizontalPosition: "end",
      verticalPosition: "bottom",
      panelClass: ["snackbar-error"],
    });
  }

}
