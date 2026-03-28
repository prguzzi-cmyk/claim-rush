import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { Claim } from 'src/app/models/claim.model';
import { ClaimService } from 'src/app/services/claim.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { TabService } from 'src/app/services/tab.service';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'app-sales-claims',
    templateUrl: './sales-claims.component.html',
    styleUrls: ['./sales-claims.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class SalesClaimsComponent implements OnInit {
    displayedColumns: string[] = [
        'ref_string',
        'client_name',
        'address',
        'insurance_company',
        'claim_number',
        'assigned_to',
        'current_phase',
        'updated_at',
    ];

    dataSource: MatTableDataSource<Claim>;
    @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;

    totalRecords: number = 0;
    pageSize: number = 10;
    pageIndex: number = 1;

    constructor(
        private claimService: ClaimService,
        private router: Router,
        private spinner: NgxSpinnerService,
        private tabService: TabService,
    ) {}

    ngOnInit(): void {
        this.getClaims();
    }

    getClaims(): void {
        this.spinner.show();
        this.claimService.getClaims(this.pageIndex, this.pageSize).subscribe(
            (claims) => {
                this.spinner.hide();
                if (claims?.items) {
                    this.dataSource = new MatTableDataSource(
                        claims.items.filter((row: any) => !row.is_removed)
                    );
                    this.totalRecords = claims.total;
                    this.pageIndex = claims.page;
                    this.pageSize = claims.size;
                }
            },
            () => {
                this.spinner.hide();
            }
        );
    }

    changePage(event: PageEvent): void {
        this.pageIndex = event.pageIndex + 1;
        this.pageSize = event.pageSize;
        if (this.pageIndex === 0) this.pageIndex = 1;
        this.getClaims();
    }

    openClaim(claim: Claim): void {
        this.tabService.addItem({ id: claim.id, name: claim.ref_string, type: 'claim2' });
    }

    applyFilter(filterValue: string): void {
        if (this.dataSource) {
            this.dataSource.filter = filterValue.trim().toLowerCase();
        }
    }
}
