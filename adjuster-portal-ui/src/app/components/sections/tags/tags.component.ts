import { Component, OnInit, ViewChild } from "@angular/core";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
import { TagService } from "src/app/services/tag.service";
import { DialogService } from "src/app/services/dialog.service";
import { Tag } from "src/app/models/tag.model";
import { TagDialogComponent } from "../../dialogs/tag-dialog/tag-dialog.component";
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: "app-tags",
    templateUrl: "./tags.component.html",
    styleUrls: ["./tags.component.scss"],
    standalone: false
})
export class TagsComponent implements OnInit {
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

  tags: Tag[] = [];

  searchText: string = "";

  selectOptions = {
    view: [
      {
        name: "active",
        displayName: "Active",
      },

      {
        name: "removed",
        displayName: "Removed",
      },
    ],

    sortBy: [
      {
        name: "name",
        displayName: "Name",
      },

      {
        name: "slug",
        displayName: "Slug",
      },

      {
        name: "created_at",
        displayName: "Created at",
      },

      {
        name: "updated_at",
        displayName: "Updated at",
      },
    ],

    orderBy: [
      {
        name: "desc",
        displayName: "Desc",
      },

      {
        name: "asc",
        displayName: "Asc",
      },
    ],

    search: [
      {
        name: "name",
        displayName: "Name",
      },

      {
        name: "slug",
        displayName: "Slug",
      },

      {
        name: "created_by",
        displayName: "Created by",
      },
    ],
  };

  selectValues = {
    view: "active",
    sortBy: "name",
    orderBy: "desc",
    search: "name",
  };

  displayedColumns: string[] = [
    "sn",
    "name",
    "slug",
    "is_removed",
    "created_by",
    "created_at",
    "last_updated",
    "edit",
    "delete",
  ];

  dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100];

  constructor(
    private tagService: TagService,
    private dialogService: DialogService,
    private tabService: TabService,
  ) {}

  setSelectValue(event: any, selectName: string) {
    this.selectValues[selectName] = event;

    this.getTags();
  }

  getDisplayedColumns() {
    if (this.selectValues.view == "active") {
      return this.displayedColumns.filter((displayedColumn) => {
        if (displayedColumn != "is_removed") {
          return displayedColumn;
        }
      });
    } else {
      return this.displayedColumns;
    }
  }

  getTags() {
    this.tagService
      .getTags({
        onlyRemoved: this.selectValues.view == "active" ? false : true,
        sortByValue: this.selectValues.sortBy,
        orderByValue: this.selectValues.orderBy,
        searchField: this.selectValues.search,
        searchValue: this.searchText,
      })
      .subscribe((tags) => (this.tags = tags.items));
  }

  openCreateTagDialog() {
    this.dialogService
      .openDialog(TagDialogComponent, {
        type: "create",
      })
      .subscribe(() => this.getTags());
  }

  openViewTagDialog(tag: Tag) {
    this.dialogService.openDialog(TagDialogComponent, {
      type: "view",
      tag,
    });
  }

  openEditTagDialog(tag: Tag) {
    this.dialogService
      .openDialog(TagDialogComponent, {
        type: "edit",
        tag,
      })
      .subscribe(() => this.getTags());
  }

  openDeleteTagDialog(tag: Tag) {
    this.dialogService
      .openDialog(TagDialogComponent, {
        type: "delete",
        tag,
      })
      .subscribe(() => this.getTags());
  }

  openRestoreTagDialog(tag: Tag) {
    this.dialogService
      .openDialog(TagDialogComponent, {
        type: "restore",
        tag,
      })
      .subscribe(() => this.getTags());
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  ngOnInit(): void {
    this.getTags();
  }

  // ngAfterViewInit() {
  //   this.dataSource.paginator = this.paginator;
  // }
}
