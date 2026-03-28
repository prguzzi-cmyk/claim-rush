import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { Lead } from 'src/app/models/lead.model';
import { LeadService } from 'src/app/services/leads.service';
import { DialogService } from 'src/app/services/dialog.service';
import { ExcelService } from 'src/app/services/excel.service';
import { UserService } from 'src/app/services/user.service';
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: 'app-lead-search',
    templateUrl: './lead-search.component.html',
    styleUrls: ['./lead-search.component.scss'],
    standalone: false
})
export class LeadSearchComponent implements OnInit {
    searchFormGroup = this._formBuilder.group({
        search: new FormControl('', [Validators.required]),
    });

    clients: any = [];
    leads: any = [];

    displayedColumns: string[] = [
        // "select",
        "ref_string",
        "full_name",
        "loss_address",
        "phone_number",
        "email",
        "status",
        "insurance_company",
        "policy_number",
        "claim_number",
        "assigned_to",
        "created_at",
        "updated_at"
    ];

    dataSource: MatTableDataSource<Lead>;
    @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;

    totalRecords = 0;
    pageIndex = 1;
    pageSize = 10;
    pageSizeOptions = [10, 25, 50, 100, 500];

    constructor(
        public userService: UserService,
        private leadService: LeadService,
        private _formBuilder: FormBuilder,
        private dialogService: DialogService,
        private spinner: NgxSpinnerService,
        private snackBar: MatSnackBar,
        private router: Router,
        private excelService: ExcelService,
        private tabService: TabService,
    ) { }

    ngOnInit(): void {
        if (!this.userService.getUserPermissions('lead', 'read')) {
            return;
        }
    }

    changePage(event: PageEvent) {
        this.pageIndex = event.pageIndex + 1;

        if (this.pageIndex == 0) {
            this.pageIndex = 1;
        }
        
        this.pageSize = event.pageSize;
        this.search();
    }

    async search() {
        this.spinner.show();
        let search_string = this.searchFormGroup.get('search').value.trim();
        console.log(this.isValidUSPhoneNumber(search_string));

        if (this.isValidUSPhoneNumber(search_string)) {
            search_string = search_string.replace(/-/g, '');
        }

        const promise = new Promise<void>((resolve, reject) => {
            this.leadService.searchLeads(this.pageIndex, this.pageSize, search_string).subscribe({
                next: (leads: any) => {
                    if (leads !== undefined) {
                        this.dataSource = new MatTableDataSource(
                            leads.items.filter((row) => row.is_removed === false)
                        );

                        
                        this.leads = leads;

                        this.spinner.hide();
                        this.totalRecords = leads.total;
                        this.pageIndex = leads.page;
                        this.pageSize = leads.size;
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

    isValidUSPhoneNumber(search_string: string): boolean {
        const regex = /^(?:\+1)?[ -]?\(?(?:\d{3})\)?[ -.]?(?:\d{3})[ -.]?(?:\d{4})$/;
        return regex.test(search_string);
    }

    onLeadDetail(id: string, name: string) {
    this.tabService.addItem({id, name, type:"lead"});
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

}
