import { Component, OnInit } from "@angular/core";
import { Location } from "@angular/common";
import { UserService } from "src/app/services/user.service";
import { FileService } from "src/app/services/file.service";
import { DialogService } from "src/app/services/dialog.service";
import { FileResource } from "src/app/models/file-resource.model";
import { FileDialogComponent } from "src/app/components/dialogs/file-dialog/file-dialog.component";

@Component({
    selector: "app-business-docs-admin",
    templateUrl: "./business-docs-admin.component.html",
    styleUrls: ["./business-docs-admin.component.scss"],
    standalone: false
})
export class BusinessDocsAdminComponent implements OnInit {
  files: FileResource[] = [];
  _files: FileResource[] = [];

  searchText: string = "";

  view: [
    {
      name: "active";
      displayName: "Active";
    },

    {
      name: "removed";
      displayName: "Removed";
    }
  ];

  sortBy = [
    {
      name: "name",
      displayName: "Name",
    },

    {
      name: "type",
      displayName: "Type",
    },

    {
      name: "created_at",
      displayName: "Created at",
    },

    {
      name: "updated_at",
      displayName: "Updated at",
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
    },

    {
      name: "type",
      displayName: "Type",
    },

    {
      name: "created_by",
      displayName: "Created by",
    },
  ];

  selectValue = {
    view: "active",
    sortBy: "name",
    orderBy: "desc",
    searchField: "name",
  };

  displayedColumns: { name: string; permission: string }[] = [
    {
      name: "sn",
      permission: "read",
    },

    {
      name: "name",
      permission: "read",
    },

    {
      name: "type",
      permission: "read",
    },

    {
      name: "created_by",
      permission: "read",
    },

    {
      name: "created_at",
      permission: "read",
    },

    {
      name: "last_updated",
      permission: "read",
    },

    {
      name: "download",
      permission: "read",
    },

    {
      name: "edit",
      permission: "update",
    },

    {
      name: "delete",
      permission: "remove",
    },
  ];

  constructor(
    private location: Location,
    private userService: UserService,
    private fileService: FileService,
    private dialogService: DialogService
  ) {}

  goBack() {
    this.location.back();
  }

  getUrlParams() {
    return {
      view: this.selectValue.view,
      sortBy: this.selectValue.sortBy,
      orderBy: this.selectValue.orderBy,
      searchField: this.selectValue.searchField,
      searchValue: this.searchText,
    };
  }

  setSelectValue(event: { selectName: string; selectValue: string }) {
    const { selectName, selectValue } = event;

    this.selectValue[selectName] = selectValue;

    this.getFiles();
  }

  getUserPermissions(module: string, operation: string) {
    return this.userService.getUserPermissions(module, operation);
  }

  getDisplayedColumns() {
    let displayedColumns = [];

    if (this.getUserPermissions("file", "read")) {
      this.displayedColumns.forEach((displayedColumn) => {
        if (displayedColumn.permission == "read") {
          displayedColumns.push(displayedColumn.name);
        }
      });

      if (this.getUserPermissions("file", "update")) {
        this.displayedColumns.forEach((displayedColumn) => {
          if (displayedColumn.permission == "update") {
            displayedColumns.push(displayedColumn.name);
          }
        });

        if (this.getUserPermissions("file", "remove")) {
          this.displayedColumns.forEach((displayedColumn) => {
            if (displayedColumn.permission == "remove") {
              displayedColumns.push(displayedColumn.name);
            }
          });
        }
      }
    }

    return displayedColumns;
  }

  isTagAppendedToFile(file: FileResource, tagName: string) {
    let isTagAppendedToFile: boolean;

    file.tags.forEach((tag: { name: string }) => {
      if (tag.name == tagName) {
        isTagAppendedToFile = true;
      }
    });

    if (isTagAppendedToFile) {
      return true;
    } else {
      return false;
    }
  }

  getAgentResourceFiles(files: FileResource[]) {
    const agentResourceFiles = files.filter((file) => {
      if (this.isTagAppendedToFile(file, "Agent Resource")) {
        return file;
      }
    });

    return agentResourceFiles;
  }

  getFiles() {
    this.fileService.getFiles(this.getUrlParams()).subscribe((files) => {
      this.files = this.getAgentResourceFiles(files);
    });
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

  ngOnInit(): void {
    this.getFiles();
  }
}
