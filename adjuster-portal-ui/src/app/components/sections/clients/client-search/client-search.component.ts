import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { DialogService } from 'src/app/services/dialog.service';
import { ExcelService } from 'src/app/services/excel.service';
import { UserService } from 'src/app/services/user.service';
import { TabService } from 'src/app/services/tab.service';
import { ClientService } from 'src/app/services/client.service';
import { Client } from 'src/app/models/client.model';
import { PhoneNumberFormatPipe } from 'src/app/phone-number-format.pipe';

@Component({
    selector: 'app-client-search',
    templateUrl: './client-search.component.html',
    styleUrls: ['./client-search.component.scss'],
    standalone: false
})
export class ClientSearchComponent implements OnInit {
    searchFormGroup = this._formBuilder.group({
        search: new FormControl('', [Validators.required]),
    });

    clients: any = [];

    displayedColumns: string[] = [
      // 'select',
      'ref_string',
      'full_name',
      'phone',
      'email',
      'address',
      'organization',
      'belonged_user',
      'created_at',
      'created_by',
    ];

    dataSource: MatTableDataSource<Client>;
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

    clientIds: any[] = [];

    totalRecords = 0;
    pageIndex = 1;
    pageSize = 10;
    pageSizeOptions = [10, 25, 50, 100, 500];

    constructor(
        public userService: UserService,
        private clientService: ClientService,
        private _formBuilder: FormBuilder,
        private dialogService: DialogService,
        private spinner: NgxSpinnerService,
        private snackBar: MatSnackBar,
        private router: Router,
        private excelService: ExcelService,
        private tabService: TabService,
    ) {}

    ngOnInit(): void {
        if (!this.userService.getUserPermissions('client','read')) {
            return;
        }
    }

    async search() {
        this.spinner.show();

        let search_string = this.searchFormGroup.get('search').value.trim();
        console.log(this.isValidUSPhoneNumber(search_string));

        if (this.isValidUSPhoneNumber(search_string)) {
            search_string = search_string.replace(/-/g, '');
        }
        const promise = new Promise<void>((resolve, reject) => {
            this.clientService.searchClients(this.pageIndex, this.pageSize, search_string).subscribe({
                next: (clients: any) => {
                    if (clients !== undefined) {
                        this.clients = clients.items;

                        this.dataSource = new MatTableDataSource(
                          clients.items.filter((row) => row.is_removed === false)
                        );
                        
                        this.spinner.hide();
                        this.totalRecords = clients.total;
                        this.pageIndex = clients.page;
                        this.pageSize = clients.size;
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

    changePage(event: PageEvent) {
        this.pageIndex = event.pageIndex + 1;
        this.pageSize = event.pageSize;


        if (this.pageIndex == 0) {
            this.pageIndex = 1;
        }
        
        this.search();
    }

    onClientDetail(id: string, name: string) {
        this.tabService.addItem({id, name, type:"client"});
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

}
