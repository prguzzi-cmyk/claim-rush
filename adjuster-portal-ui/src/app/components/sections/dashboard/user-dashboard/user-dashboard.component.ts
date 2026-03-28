import { Component, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';
import { Observable } from 'rxjs';
import { delay, map, startWith } from 'rxjs/operators';
import { Claim } from 'src/app/models/claim.model';
import { Client } from 'src/app/models/client.model';
import { Lead } from 'src/app/models/lead.model';
import { User } from 'src/app/models/user.model';
import { ClaimService } from 'src/app/services/claim.service';
import { ClientService } from 'src/app/services/client.service';
import { ExcelService } from 'src/app/services/excel.service';
import { LeadService } from 'src/app/services/leads.service';
import { TabService } from 'src/app/services/tab.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-user-dashboard',
    templateUrl: './user-dashboard.component.html',
    styleUrls: ['./user-dashboard.component.scss'],
    standalone: false
})
export class UserDashboardComponent implements OnInit {
    assignedToControl = new FormControl();
    filteredAssignedToAgents!: Observable<any[]>;
    agents: any[];
    userId: string = null;
    searchField: string = null;
    userEmail: string = null;
    userName: string = null;
    role: string;
    user: User;

    clients: any = [];
    claims: any = [];
    leads: any = [];
    tasks: any = [];

    displayedColumnsClients: string[] = [
        'sn',
        'ref_string',
        'full_name',
        'phone_number',
        'email',
        'created_by',
        'created_at',
    ];

    displayedColumnsClaims: string[] = [
        'sn',
        'ref_string',
        'name',
        'claim_number',
        'policy_number',
        'phase',
        'source',
        'signed_by',
        'adjusted_by',
        'assigned_to',
        'created_by',
        'created_at',
    ];

    displayedColumnsLeads: string[] = [
        'sn',
        'ref_string',
        'full_name',
        'phone_number',
        'email',
        'source',
        'status',
        'created_by',
        'created_at',
    ];

    displayedColumnsTasks: string[] = [
        'sn',
        'title',
        'task_type',
        'status',
        'priority',
        'due_date',
        'created_by',
        'created_at',
    ];

    // Pagination
    dataSourceClients: MatTableDataSource<Client>;
    @ViewChild('paginator', { static: true }) paginatorClients: MatPaginator;

    dataSourceLeads: MatTableDataSource<Lead>;
    @ViewChild('paginatorLeads', { static: false })
    paginatorLeads: MatPaginator;

    dataSourceLeadsSource: MatTableDataSource<Lead>;
    @ViewChild('paginatorLeadsSource', { static: false })
    paginatorLeadsSource: MatPaginator;

    dataSourceClaims: MatTableDataSource<Claim>;
    @ViewChild('paginatorClaims', { static: false })
    paginatorClaims: MatPaginator;

    dataSourceClaimsSigned: MatTableDataSource<Claim>;
    @ViewChild('paginatorClaimsSigned', { static: false })
    paginatorClaimsSigned: MatPaginator;

    dataSourceClaimsSource: MatTableDataSource<Claim>;
    @ViewChild('paginatorClaimsSource', { static: false })
    paginatorClaimsSource: MatPaginator;

    dataSourceClaimsAdjust: MatTableDataSource<Claim>;
    @ViewChild('paginatorClaimsAdjust', { static: false })
    paginatorClaimsAdjust: MatPaginator;

    pageSizeOptions = [5, 10, 25, 50, 100, 500];

    clientPaginationData: any = {
        totalRecords: 0,
        pageIndex: 1,
        pageSize: 5,
    };

    claimPaginationData: any = {
        totalRecords: 0,
        pageIndex: 1,
        pageSize: 5,
    };

    claimSignedPaginationData: any = {
        totalRecords: 0,
        pageIndex: 1,
        pageSize: 5,
    };

    claimSourcePaginationData: any = {
        totalRecords: 0,
        pageIndex: 1,
        pageSize: 5,
    };

    claimAdjustPaginationData: any = {
      totalRecords: 0,
      pageIndex: 1,
      pageSize: 5,
  };

    leadPaginationData: any = {
        totalRecords: 0,
        pageIndex: 1,
        pageSize: 5,
    };

    leadSourcePaginationData: any = {
        totalRecords: 0,
        pageIndex: 1,
        pageSize: 5,
    };

    constructor(
        private tabService: TabService,
        public userService: UserService,
        private clientService: ClientService,
        private leadService: LeadService,
        private claimService: ClaimService,
        private spinner: NgxSpinnerService,
        private excelService: ExcelService
    ) {
        this.role = localStorage.getItem('role-name');

        if (this.userService.getUserPermissions('user', 'read') && this.role == 'super-admin') {
            this.getUsers();
        } 
        if (this.role != 'super-admin') {
          this.getUser();
        }
        
    }

    ngOnInit(): void {
        this.filteredAssignedToAgents =
            this.assignedToControl.valueChanges.pipe(
                startWith(''),
                map((value) => {
                    if (value == '') {
                        this.userId = null;
                    }
                    return this._filterAgents(value);
                })
            );
    }

    private _filterAgents(value: string): any[] {
        const filterValue =
            typeof value === 'string' ? value.toLowerCase() : '';

        // If the input is empty, return an empty array to avoid displaying all agents.
        if (!filterValue) {
            return [];
        }

        return this.agents.filter(
            (agent) =>
                agent.first_name.toLowerCase().startsWith(filterValue) ||
                agent.first_name.startsWith(filterValue) ||
                agent.last_name.toLowerCase().startsWith(filterValue)
        );
    }

    displayAgent(agent: any): string {
        return agent ? `${agent.first_name} ${agent.last_name}` : '';
    }

    onAssignedSelected(event: any) {
        const selectedAgent = event.option.value;
        // console.log(event.option);
        this.userId = selectedAgent.id;
        this.userEmail = event.option.value.email;
        this.userName = event.option.value.first_name;
        // console.log(this.userId);
        this.getUserReport();
    }
    onNavigate(side: string) {
        this.tabService.setSideTitle(side);
    }

    getUserReport() {
        this.clients = [];
        this.leads = [];
        this.claims = [];

        if (this.userService.getUserPermissions('client', 'read')) {
            this.searchClients();
        }

        if (this.userService.getUserPermissions('lead', 'read')) {
            this.searchLeadsByAssignedTo();
            this.searchLeadsBySource();
        }

        if (this.userService.getUserPermissions('claim', 'read')) {
            this.searchClaims();
            this.searchClaimsSigned();
            this.searchClaimsSource();
            this.searchClaimsAdjust();
        }
    }

    getUsers() {
        this.userService.getUsers(1, 500).subscribe((agents) => {
            this.agents = agents?.items;
        });
    }

    getUser() {
        this.userService.currentUser.subscribe((user) => {
            if (user) {
              console.log(user);
                this.user = user;
                this.userId = user.id;
                this.userEmail = user.email;
                this.userName = user.first_name;
                this.getUserReport()
            }
        });
    }

    searchClients() {
        this.spinner.show();

        this.clientService
            .getClientsByUserId(
                this.userEmail,
                this.clientPaginationData.pageIndex,
                this.clientPaginationData.pageSize
            )
            .pipe(delay(500))
            .subscribe(
                (clients) => {
                    this.spinner.hide();

                    if (clients !== undefined) {
                        this.clients = clients.items;

                        // filter deleted clients
                        this.dataSourceClients = new MatTableDataSource(
                            clients.items.filter(
                                (row) => row.is_removed === false
                            )
                        );

                        this.dataSourceClients.filterPredicate = function (
                            data,
                            filter: string
                        ): boolean {
                            return (
                                data.full_name.toLowerCase().includes(filter) ||
                                data.email.toLowerCase().includes(filter) ||
                                data.phone_number
                                    .toLowerCase()
                                    .includes(filter) ||
                                data.address.toLowerCase().includes(filter) ||
                                data.ref_string.toLowerCase().includes(filter)
                            );
                        };

                        this.clientPaginationData = {
                            totalRecords: clients?.total,
                            pageIndex: clients?.page,
                            pageSize: clients?.size,
                        };
                    }
                },
                (error) => {
                    this.spinner.hide();
                }
            );
    }

    searchLeadsByAssignedTo() {
        if (this.userService.getUserPermissions('lead', 'read')) {
            this.spinner.show();

            this.searchField = 'assigned_to';

            this.leadService
                .getLeadsByUserId(
                    this.userId,
                    this.searchField,
                    this.leadPaginationData.pageIndex,
                    this.leadPaginationData.pageSize
                )
                .pipe(delay(500))
                .subscribe((leads) => {
                    this.spinner.hide();
                    if (leads !== undefined) {
                        this.leads = leads;

                        // filter deleted leads
                        this.dataSourceLeads = new MatTableDataSource(
                            leads.items
                        );

                        this.leadPaginationData = {
                            totalRecords: leads?.total,
                            pageIndex: leads?.page,
                            pageSize: leads?.size,
                        };
                    }
                });
        }
    }

    searchLeadsBySource() {
        if (this.userService.getUserPermissions('lead', 'read')) {
            this.spinner.show();

            this.searchField = 'source';

            this.leadService
                .getLeadsByUserId(
                    this.userId,
                    this.searchField,
                    this.leadSourcePaginationData.pageIndex,
                    this.leadSourcePaginationData.pageSize
                )
                .pipe(delay(500))
                .subscribe((leads) => {
                    this.spinner.hide();
                    if (leads !== undefined) {
                        this.dataSourceLeadsSource = new MatTableDataSource(
                            leads.items
                        );

                        this.leadSourcePaginationData = {
                            totalRecords: leads?.total,
                            pageIndex: leads?.page,
                            pageSize: leads?.size,
                        };
                    }
                });
        }
    }

    searchClaims() {
        this.spinner.show();

        this.searchField = 'assigned_to';

        this.claimService
            .getClaimsByUserId(
                this.userId,
                this.searchField,
                this.claimPaginationData.pageIndex,
                this.claimPaginationData.pageSize
            )
            .subscribe((claims) => {
                this.spinner.hide();
                if (claims !== undefined) {
                    this.claims = claims;
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

                    this.claimPaginationData = {
                        totalRecords: claims?.total,
                        pageIndex: claims?.page,
                        pageSize: claims?.size,
                    };
                }
            });
    }

    searchClaimsSigned() {
        this.spinner.show();

        this.searchField = 'signed_by';

        this.claimService
            .getClaimsByUserId(
                this.userId,
                this.searchField,
                this.claimSignedPaginationData.pageIndex,
                this.claimSignedPaginationData.pageSize
            )
            .subscribe((claims) => {
                this.spinner.hide();
                if (claims !== undefined) {
                    this.claims = claims;
                    // filter deleted claims
                    this.dataSourceClaimsSigned = new MatTableDataSource(
                        claims.items.filter((row) => row.is_removed === false)
                    );

                    this.claimSignedPaginationData = {
                        totalRecords: claims?.total,
                        pageIndex: claims?.page,
                        pageSize: claims?.size,
                    };
                }
            });
    }

    searchClaimsSource() {
      this.spinner.show();

      this.searchField = 'source';

      this.claimService
          .getClaimsByUserId(
              this.userId,
              this.searchField,
              this.claimSourcePaginationData.pageIndex,
              this.claimSourcePaginationData.pageSize
          )
          .subscribe((claims) => {
              this.spinner.hide();
              if (claims !== undefined) {
                  this.claims = claims;
                  // filter deleted claims
                  this.dataSourceClaimsSource = new MatTableDataSource(
                      claims.items.filter((row) => row.is_removed === false)
                  );

                  this.claimSourcePaginationData = {
                      totalRecords: claims?.total,
                      pageIndex: claims?.page,
                      pageSize: claims?.size,
                  };
              }
          });
  }

  searchClaimsAdjust() {
    this.spinner.show();

    this.searchField = 'adjusted_by';

    this.claimService
        .getClaimsByUserId(
            this.userId,
            this.searchField,
            this.claimAdjustPaginationData.pageIndex,
            this.claimAdjustPaginationData.pageSize
        )
        .subscribe((claims) => {
            this.spinner.hide();
            if (claims !== undefined) {
                this.claims = claims;
                // filter deleted claims
                this.dataSourceClaimsAdjust = new MatTableDataSource(
                    claims.items.filter((row) => row.is_removed === false)
                );

                this.claimAdjustPaginationData = {
                    totalRecords: claims?.total,
                    pageIndex: claims?.page,
                    pageSize: claims?.size,
                };
            }
        });
}

    changePage(event: PageEvent, module: string) {
        if (module == 'client') {
            this.clientPaginationData.pageIndex = event.pageIndex + 1;
            this.clientPaginationData.pageSize = event.pageSize;

            if (this.clientPaginationData.pageIndex == 0) {
                this.clientPaginationData.pageIndex = 1;
            }
            this.searchClients();
        }

        if (module == 'claim') {
            this.claimPaginationData.pageIndex = event.pageIndex + 1;
            this.claimPaginationData.pageSize = event.pageSize;
            if (this.claimPaginationData.pageIndex == 0) {
                this.claimPaginationData.pageIndex = 1;
            }
            this.searchClaims();
        }

        if (module == 'claimBySigned') {
            this.claimSignedPaginationData.pageIndex = event.pageIndex + 1;
            this.claimSignedPaginationData.pageSize = event.pageSize;
            if (this.claimSignedPaginationData.pageIndex == 0) {
                this.claimSignedPaginationData.pageIndex = 1;
            }
            this.searchClaimsSigned();
        }

        if (module == 'claimBySource') {
            this.claimSourcePaginationData.pageIndex = event.pageIndex + 1;
            this.claimSourcePaginationData.pageSize = event.pageSize;
            if (this.claimSourcePaginationData.pageIndex == 0) {
                this.claimSourcePaginationData.pageIndex = 1;
            }
            this.searchClaimsSource();
        }

        if (module == 'claimByAdjust') {
          this.claimAdjustPaginationData.pageIndex = event.pageIndex + 1;
          this.claimAdjustPaginationData.pageSize = event.pageSize;
          if (this.claimAdjustPaginationData.pageIndex == 0) {
              this.claimAdjustPaginationData.pageIndex = 1;
          }
          this.searchClaimsAdjust();
      }

        if (module == 'leadsByAssignedTo') {
            this.leadPaginationData.pageIndex = event.pageIndex + 1;
            this.leadPaginationData.pageSize = event.pageSize;

            if (this.leadPaginationData.pageIndex == 0) {
                this.leadPaginationData.pageIndex = 1;
            }
            this.searchLeadsByAssignedTo();
        }

        if (module == 'leadsBySource') {
            this.leadSourcePaginationData.pageIndex = event.pageIndex + 1;
            this.leadSourcePaginationData.pageSize = event.pageSize;

            if (this.leadSourcePaginationData.pageIndex == 0) {
                this.leadSourcePaginationData.pageIndex = 1;
            }
            this.searchLeadsBySource();
        }
    }

    downloadExcel(data: any, type: string) {
        this.excelService.exportAsExcelFile(data, type);
    }

    downloadCsv(data: any, type: string) {
        this.excelService.exportAsCsvFile(data, type);
    }

    onClientDetail(id: string, name: string) {
        this.tabService.addItem({ id, name, type: 'client' });
    }

    onClaimDetail(id: string, name: string) {
        this.tabService.addItem({ id, name, type: 'claim' });
    }

    onLeadDetail(id: string, name: string) {
        this.tabService.addItem({ id, name, type: 'lead' });
    }
}
