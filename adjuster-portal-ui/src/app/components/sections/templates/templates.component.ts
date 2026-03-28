import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { Template } from 'src/app/models/template.model';
import { ViewDocumentDialogComponent } from '../../dialogs/view-document-dialog/view-document-dialog.component';
import { DialogService } from 'src/app/services/dialog.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { TemplateService } from 'src/app/services/template.service';
import { TemplatesDialogComponent } from '../../dialogs/templates-dialog/templates-dialog.component';
import { TabService } from 'src/app/services/tab.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-templates',
    templateUrl: './templates.component.html',
    styleUrls: ['./templates.component.scss'],
    standalone: false
})

export class TemplatesComponent implements OnInit {

  totalRecords = 0;
  pageIndex = 1;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100, 500];

  templates: [Template];
  displayedColumns: string[] = [
    "sn",
    "name",
    "description",
    "state",
    "created_at",
    "edit",
  ];

  // Pagination
  dataSource = new MatTableDataSource<Template>();
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

  constructor(
    private dialogService: DialogService,
    private spinner: NgxSpinnerService,
    private templateService: TemplateService,
    private tabService: TabService,
    public userService: UserService,
  ) { 

    this.getTemplates();

  }

  ngOnInit(): void {
  }

  openFile(file: any, type: any) {
    this.dialogService.openDialog(ViewDocumentDialogComponent, { type: type, file: file })
      .subscribe(() => this.getTemplates());
  }

  getTemplates() {
    return this.templateService.getTemplates().subscribe(
      templates => {
        this.templates = templates.items;
        this.dataSource = new MatTableDataSource(templates.items);

        this.totalRecords = templates.total;
        this.pageIndex = templates.page;
        this.pageSize = templates.size;

      }
    );
  }

  openAddTemplateDialog(template : Template) {
    this.dialogService.openDialog(TemplatesDialogComponent, { type: 'add', template: template })
    .subscribe(() => this.getTemplates());
  }

  openEditTemplateDialog(template : Template) {
    this.dialogService.openDialog(TemplatesDialogComponent, { type: 'edit', template: template })
    .subscribe(() => this.getTemplates());
  }

  openDeleteTemplateDialog(template : Template) {
    this.dialogService.openDialog(TemplatesDialogComponent, { type: 'delete', template: template })
    .subscribe(() => this.getTemplates());
  }

  openViewTemplateDialog(template : Template): void {
    this.dialogService.openDialog(TemplatesDialogComponent, { type: 'view', template: template })
    .subscribe(() => this.getTemplates());
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

}
