import { NewsletterService } from './../../../services/newsletter.service';
import { Component, OnInit, ViewChild } from '@angular/core';
import { Newsletter } from 'src/app/models/newsletter.model';
import { DialogService } from 'src/app/services/dialog.service';
import { NewsletterDialogComponent } from '../../dialogs/newsletter-dialog/newsletter-dialog.component';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: 'app-newsletters',
    templateUrl: './newsletters.component.html',
    styleUrls: ['./newsletters.component.scss'],
    standalone: false
})
export class NewslettersComponent implements OnInit {

  // Pagination
  dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  
  totalRecords = 0;
  pageIndex = 1;
  pageSize = 10;

  newsletters: [Newsletter];

  displayedColumns: string[] = [
    "sn",
    "title",
    "publication_date",
    "Featured",
    "created_at",
    "edit",
    "delete",
  ];


  constructor(
    private newsletterService: NewsletterService,
    private dialogService: DialogService,
    private tabService: TabService,
  ) {

  }

  ngOnInit(): void {
    this.getNewsletters();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
}

  onPageChange(event) {
    this.pageIndex = event.pageIndex;

    if (this.pageIndex == 0) {
        this.pageIndex = 1;
    }
    
    this.pageSize = event.pageSize;
    this.getNewsletters();  
  }

  getNewsletters() {
    this.newsletterService.getNewsletters(this.pageIndex, this.pageSize).subscribe((newsletters) => {
      this.newsletters = newsletters.items;
      this.dataSource = new MatTableDataSource(newsletters.items);
      this.dataSource.paginator = this.paginator;
      this.totalRecords = newsletters.total;
      this.pageSize = newsletters.size;
      this.pageIndex = newsletters.page;
      

    });

  }

  openAddDialog(newsletter) {
    this.dialogService
      .openDialog(NewsletterDialogComponent, { type: "add", newsletter: newsletter })
      .subscribe(() => this.getNewsletters());
  }

  openEditDialog(newsletter) {
    this.dialogService
      .openDialog(NewsletterDialogComponent, { type: "edit", newsletter: newsletter })
      .subscribe(() => this.getNewsletters());
  }

  openDeleteDialog(newsletter) {
    this.dialogService
      .openDialog(NewsletterDialogComponent, { type: "delete", newsletter: newsletter })
      .subscribe(() => this.getNewsletters());
  }

  openViewDialog(newsletter) {
    this.dialogService
      .openDialog(NewsletterDialogComponent, { type: "view", newsletter: newsletter })
      .subscribe(() => this.getNewsletters());
  }

}
