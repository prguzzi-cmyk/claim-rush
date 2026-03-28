import { Component, OnInit } from "@angular/core";
import { Location } from "@angular/common";
import { Router } from "@angular/router";
import { UserService } from "src/app/services/user.service";
import { FileService } from "src/app/services/file.service";
import { DialogService } from "src/app/services/dialog.service";
import { User } from "src/app/models/user.model";
import { FileResource } from "src/app/models/file-resource.model";
import { FileDialogComponent } from "src/app/components/dialogs/file-dialog/file-dialog.component";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: "app-business-docs",
    templateUrl: "./business-docs.component.html",
    styleUrls: ["./business-docs.component.scss"],
    standalone: false
})
export class BusinessDocsComponent implements OnInit {
  files: FileResource[] = [];

  user: User;

  searchText: string = "";

  sortBy = [
    {
      name: "name",
      displayName: "Name",
      viewers: ["all"],
    },

    {
      name: "type",
      displayName: "Type",
      viewers: ["all"],
    },

    {
      name: "created_at",
      displayName: "Created at",
      viewers: ["super-admin", "admin"],
    },

    {
      name: "updated_at",
      displayName: "Updated at",
      viewers: ["super-admin", "admin"],
    },
  ];

  orderBy = [
    {
      name: "desc",
      displayName: "Desc",
    },

    {
      name: "asc",
      displayName: "Asc",
    },
  ];

  searchFields = [
    {
      name: "name",
      displayName: "Name",
      viewers: ["all"],
    },

    {
      name: "type",
      displayName: "Type",
      viewers: ["all"],
    },

    // {
    //   name: "created_by",
    //   displayName: "Created by",
    //   viewers: ["super-admin", "admin"],
    // },
  ];

  selectValue = {
    // view: "active",
    sortBy: "name",
    orderBy: "desc",
    searchField: "name",
  };

  displayedColumns: { name: string; viewers: string[]; permission: string }[] =
    [
      {
        name: "sn",
        viewers: ["all"],
        permission: "read",
      },

      {
        name: "name",
        viewers: ["all"],
        permission: "read",
      },

      {
        name: "type",
        viewers: ["all"],
        permission: "read",
      },

      {
        name: "created_by",
        viewers: ["super-admin", "admin"],
        permission: "read",
      },

      {
        name: "created_at",
        viewers: ["super-admin", "admin"],
        permission: "read",
      },

      {
        name: "last_updated",
        viewers: ["super-admin", "admin"],
        permission: "read",
      },

      {
        name: "download",
        viewers: ["all"],
        permission: "read",
      },

      {
        name: "edit",
        viewers: ["super-admin", "admin"],
        permission: "update",
      },

      {
        name: "delete",
        viewers: ["super-admin", "admin"],
        permission: "remove",
      },
    ];

  constructor(
    private location: Location,
    public router: Router,
    private userService: UserService,
    private fileService: FileService,
    private dialogService: DialogService,
    private snackBar: MatSnackBar,
    private tabService: TabService,
  ) {}

  getUrlParams() {
    return {
      // onlyRemoved: this.selectValue.view == "active" ? false : true,
      sortBy: this.selectValue.sortBy,
      orderBy: this.selectValue.orderBy,
      searchField: this.selectValue.searchField,
      searchValue: this.searchText,
    };
  }

  getFiles() {
    this.fileService.getFiles(this.getUrlParams()).subscribe((files) => {
      this.files = files.items;
    },
    (error) => {

    });
  }

  getUser() {
    this.userService.getUser().subscribe((user) => {
      this.user = user;

      this.getFiles();
    });
  }

  getSelectOptions(selectName: string) {
    let selectOptions = [];

    this[selectName].forEach((selectOption: { viewers: any[] }) => {
      if (this.router.url.includes("administration")) {
        if (
          selectOption.viewers.includes("all") ||
          selectOption.viewers.includes("super-admin") ||
          selectOption.viewers.includes("admin")
        ) {
          selectOptions.push(selectOption);
        }
      } else {
        if (
          selectOption.viewers.includes("all") ||
          selectOption.viewers.includes("agent")
        ) {
          selectOptions.push(selectOption);
        }
      }
    });

    return selectOptions;
  }

  getUserPermissions(module: string, operation: string) {
    return this.userService.getUserPermissions(module, operation);
  }

  getDisplayedColumns() {
    let displayedColumns = [];

    const pushToDisplayedColumns = (displayedColumn: {
      name: string;
      viewers: string[];
      permission: string;
    }) => {
      if (this.getUserPermissions("file", "read")) {
        if (displayedColumn.permission == "read") {
          displayedColumns.push(displayedColumn.name);
        }
      }

      if (this.getUserPermissions("file", "update")) {
        if (displayedColumn.permission == "update") {
          displayedColumns.push(displayedColumn.name);
        }
      }

      if (this.getUserPermissions("file", "remove")) {
        if (displayedColumn.permission == "remove") {
          displayedColumns.push(displayedColumn.name);
        }
      }
    };

    this.displayedColumns.forEach((displayedColumn) => {
      if (this.router.url.includes("administration")) {
        if (
          displayedColumn.viewers.includes("all") ||
          displayedColumn.viewers.includes("super-admin") ||
          displayedColumn.viewers.includes("admin")
        ) {
          pushToDisplayedColumns(displayedColumn);
        }
      } else {
        if (
          displayedColumn.viewers.includes("all") ||
          displayedColumn.viewers.includes("agent")
        ) {
          pushToDisplayedColumns(displayedColumn);
        }
      }
    });

    return displayedColumns;
  }

  setSelectValue(event: { selectName: string; selectValue: string }) {
    const { selectName, selectValue } = event;

    this.selectValue[selectName] = selectValue;

    this.getFiles();
  }

  openUploadFileDialog() {
    this.dialogService
      .openDialog(FileDialogComponent, {
        type: "upload",
      })
      .subscribe(() => this.getFiles());
  }

  openViewFileDialog(file: FileResource) {
    this.dialogService.openDialog(FileDialogComponent, {
      type: "view",
      file,
    });
  }

  openEditFileDialog(file: FileResource) {
    this.dialogService
      .openDialog(FileDialogComponent, {
        type: "edit",
        file,
      })
      .subscribe(() => this.getFiles());
  }

  openDeleteFileDialog(file: FileResource) {
    this.dialogService
      .openDialog(FileDialogComponent, {
        type: "delete",
        file,
      })
      .subscribe(() => this.getFiles());
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  ngOnInit(): void {
    this.getUser();
  }
}
