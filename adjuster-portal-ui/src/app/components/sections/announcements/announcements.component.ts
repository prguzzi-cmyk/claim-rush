import { DialogService } from 'src/app/services/dialog.service';
import { AnnouncementService } from './../../../services/announcement.service';
import { Component, OnInit, ViewChild } from '@angular/core';
import { Announcement } from 'src/app/models/announcement.model';
import { AnnouncementDialogComponent } from '../../dialogs/announcement-dialog/announcement-dialog.component';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { TabService } from '../../../services/tab.service';


@Component({
    selector: 'app-announcements',
    templateUrl: './announcements.component.html',
    styleUrls: ['./announcements.component.scss'],
    standalone: false
})
export class AnnouncementsComponent implements OnInit {

  // Pagination
  dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

  totalRecords = 0;
  pageIndex = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];


  announcements: [Announcement];

  displayedColumns: string[] = [
    "sn",
    "title",
    "announcement_date",
    "expiration_date",
    "edit",
    "delete",
  ];


  constructor(
    private dialogService: DialogService,
    private announcementService: AnnouncementService,
    private tabService: TabService,
  ) {

  }

  ngOnInit(): void {
    this.getAnnouncements();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }


  onPageChange(event) {
    this.pageIndex = event.pageIndex;

    if (this.pageIndex == 0) {
        this.pageIndex = 1;
    }
    
    this.pageSize = event.pageSize;
    this.getAnnouncements();  
  }

  getAnnouncements() {
    this.announcementService.getAnnouncements(this.pageIndex, this.pageSize).subscribe((announcements) => {
      this.announcements = announcements.items;
      this.dataSource = new MatTableDataSource(announcements.items);
      this.dataSource.paginator = this.paginator;
      this.pageIndex = announcements.page;
      this.pageSize = announcements.size;
      this.totalRecords = announcements.total;

    });

  }

  openAddDialog(announcement) {
    this.dialogService
      .openDialog(AnnouncementDialogComponent, { type: "add", announcement: announcement })
      .subscribe(() => this.getAnnouncements());
  }

  openEditDialog(announcement) {
    this.dialogService
      .openDialog(AnnouncementDialogComponent, { type: "edit", announcement: announcement })
      .subscribe(() => this.getAnnouncements());
  }

  openDeleteDialog(announcement) {
    this.dialogService
      .openDialog(AnnouncementDialogComponent, { type: "delete", announcement: announcement })
      .subscribe(() => this.getAnnouncements());
  }

  openViewDialog(announcement) {
    this.dialogService
      .openDialog(AnnouncementDialogComponent, { type: "view", announcement: announcement })
      .subscribe(() => this.getAnnouncements());
  }
  
  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

}
