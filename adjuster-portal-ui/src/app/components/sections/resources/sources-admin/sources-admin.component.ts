import { Component, OnInit, ViewChild } from "@angular/core";
import { Location } from "@angular/common";
import { Router } from "@angular/router";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
import { NpoInitiativeService } from "src/app/services/npo-initiative.service";
import { PartnershipService } from "src/app/services/partnership.service";
import { NetworkService } from "src/app/services/network.service";
import { DialogService } from "src/app/services/dialog.service";
import { NpoInitiative } from "src/app/models/npo-initiative.model";
import { Partnership } from "src/app/models/partnership.model";
import { Network } from "src/app/models/network.model";
import { SourceItemDialogComponent } from "src/app/components/dialogs/source-item-dialog/source-item-dialog.component";
import { TabService } from "src/app/services/tab.service";

@Component({
    selector: "app-sources-admin",
    templateUrl: "./sources-admin.component.html",
    styleUrls: ["./sources-admin.component.scss"],
    standalone: false
})
export class SourcesAdminComponent implements OnInit {
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

  source: any = {};

  searchText: string = "";

  views = [
    {
      name: "active",
      displayName: "Active",
    },

    {
      name: "removed",
      displayName: "Removed",
    },
  ];

  sources = [
    {
      name: "npo_initiative",
      displayName: "NPO Initiative",
      path: "npo-initiatives",
    },

    {
      name: "partnership",
      displayName: "Partnership",
      path: "partnerships",
    },

    {
      name: "network",
      displayName: "Network",
      path: "networks",
    },
  ];

  sortBy = [
    {
      name: "title",
      displayName: "Title",
      sourceNames: ["npo_initiative", "partnership", "network"],
    },

    {
      name: "environment",
      displayName: "Environment",
      sourceNames: ["network"],
    },

    {
      name: "created_at",
      displayName: "Created at",
      sourceNames: ["npo_initiative", "partnership", "network"],
    },

    {
      name: "updated_at",
      displayName: "Updated at",
      sourceNames: ["npo_initiative", "partnership", "network"],
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
      name: "title",
      displayName: "Title",
      sourceNames: ["npo_initiative", "partnership", "network"],
    },

    {
      name: "target",
      displayName: "Target",
      sourceNames: ["npo_initiative", "partnership"],
    },

    {
      name: "mission",
      displayName: "Mission",
      sourceNames: ["npo_initiative", "partnership"],
    },

    {
      name: "environment",
      displayName: "Environment",
      sourceNames: ["network"],
    },

    {
      name: "search_term",
      displayName: "Search term",
      sourceNames: ["npo_initiative", "partnership"],
    },

    {
      name: "exploration_term",
      displayName: "Exploration term",
      sourceNames: ["network"],
    },

    {
      name: "created_by",
      displayName: "Created by",
      sourceNames: ["npo_initiative", "partnership", "network"],
    },
  ];

  selectValue = {
    view: "active",
    sortBy: "created_at",
    orderBy: "desc",
    searchField: "title",
  };

  displayedColumns = [
    {
      name: "sn",
      tableNames: ["npo_initiative", "partnership", "network"],
    },

    {
      name: "title",
      tableNames: ["npo_initiative", "partnership", "network"],
    },

    {
      name: "target",
      tableNames: ["npo_initiative", "partnership"],
    },

    {
      name: "mission",
      tableNames: ["npo_initiative", "partnership"],
    },

    {
      name: "environment",
      tableNames: ["network"],
    },

    {
      name: "summary",
      tableNames: ["network"],
    },

    {
      name: "created_by",
      tableNames: ["npo_initiative", "partnership", "network"],
    },

    {
      name: "created_at",
      tableNames: ["npo_initiative", "partnership", "network"],
    },

    {
      name: "last_updated",
      tableNames: ["npo_initiative", "partnership", "network"],
    },

    {
      name: "is_removed",
      tableNames: ["npo_initiative", "partnership", "network"],
    },

    {
      name: "edit",
      tableNames: ["npo_initiative", "partnership", "network"],
    },

    {
      name: "delete",
      tableNames: ["npo_initiative", "partnership", "network"],
    },
  ];

  dataSource: MatTableDataSource<NpoInitiative | Partnership | Network>;
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50];

  constructor(
    private location: Location,
    private router: Router,
    private npoInitiativeService: NpoInitiativeService,
    private partnershipService: PartnershipService,
    private networkService: NetworkService,
    private dialogService: DialogService,
    private tabService: TabService
  ) {}

  assignSource() {
    this.source = this.sources.filter((source) => {
      if (this.router.url.includes(source.path)) {
        return source;
      }
    })[0];
  }

  getUrlParams() {
    return {
      onlyRemoved: this.selectValue.view == "active" ? false : true,
      sortBy: this.selectValue.sortBy,
      orderBy: this.selectValue.orderBy,
      searchField: this.selectValue.searchField,
      searchValue: this.searchText,
    };
  }

  handleResponse(sourceItems: any) {
    this.dataSource = new MatTableDataSource(sourceItems);

    this.dataSource.paginator = this.paginator;
  }

  getNpoInitiatives() {
    this.npoInitiativeService
      .getNpoInitiatives(this.getUrlParams())
      .subscribe((npoInitiatives) => this.handleResponse(npoInitiatives.items));
  }

  getPartnerships() {
    this.partnershipService
      .getPartnerships(this.getUrlParams())
      .subscribe((partnerships) => this.handleResponse(partnerships.items));
  }

  getNetworks() {
    this.networkService
      .getNetworks(this.getUrlParams())
      .subscribe((networks) => this.handleResponse(networks.items));
  }

  getSourceItems() {
    if (this.source.name == "npo_initiative") {
      this.getNpoInitiatives();
    } else if (this.source.name == "partnership") {
      this.getPartnerships();
    } else {
      this.getNetworks();
    }
  }

  getDisplayedColumns() {
    let displayedColumns = [];

    const appendToDisplayedColumns = (displayedColumn: {
      name: string;
      tableNames: string[];
    }) => {
      if (displayedColumn.tableNames.includes(this.source.name)) {
        displayedColumns.push(displayedColumn.name);
      }
    };

    this.displayedColumns.forEach((displayedColumn) => {
      if (this.selectValue.view == "active") {
        if (displayedColumn.name != "is_removed") {
          appendToDisplayedColumns(displayedColumn);
        }
      } else {
        appendToDisplayedColumns(displayedColumn);
      }
    });

    return displayedColumns;
  }

  getSelectOptions(selectName: string) {
    const selectOptions = this[selectName].filter(
      (selectOption: { sourceNames: string[] }) => {
        if (selectOption.sourceNames.includes(this.source.name)) {
          return selectOption;
        }
      }
    );

    return selectOptions;
  }

  isStrGreaterThanTwentyFiveChars(str: string) {
    if (str?.length > 25) {
      return true;
    } else {
      return false;
    }
  }

  truncateString(string: string, length: number = 25) {
    return string.slice(0, length);
  }

  getDialogData(
    dialogType: string,
    sourceItem?: NpoInitiative | Partnership | Network
  ) {
    const baseDialogData = {
      type: dialogType,
      source: this.source,
    };

    if (dialogType == "create") {
      return baseDialogData;
    } else {
      return {
        ...baseDialogData,
        sourceItem,
      };
    }
  }

  openCreateSourceItemDialog() {
    this.dialogService
      .openDialog(SourceItemDialogComponent, this.getDialogData("create"))
      .subscribe(() => this.getSourceItems());
  }

  openViewSourceItemDialog(sourceItem: NpoInitiative | Partnership | Network) {
    this.dialogService.openDialog(
      SourceItemDialogComponent,
      this.getDialogData("view", sourceItem)
    );
  }

  openEditSourceItemDialog(sourceItem: NpoInitiative | Partnership | Network) {
    this.dialogService
      .openDialog(
        SourceItemDialogComponent,
        this.getDialogData("edit", sourceItem)
      )
      .subscribe(() => this.getSourceItems());
  }

  openDeleteSourceItemDialog(
    sourceItem: NpoInitiative | Partnership | Network
  ) {
    this.dialogService
      .openDialog(
        SourceItemDialogComponent,
        this.getDialogData("delete", sourceItem)
      )
      .subscribe(() => this.getSourceItems());
  }

  openRestoreSourceItemDialog(
    sourceItem: NpoInitiative | Partnership | Network
  ) {
    this.dialogService
      .openDialog(
        SourceItemDialogComponent,
        this.getDialogData("restore", sourceItem)
      )
      .subscribe(() => this.getSourceItems());
  }

  setSelectValue(event: { selectName: string; selectValue: string }) {
    const { selectName, selectValue } = event;

    this.selectValue[selectName] = selectValue;

    this.getSourceItems();
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  goBack() {
    this.location.back();
  }

  ngOnInit(): void {
    this.assignSource();
    this.getSourceItems();
  }
}
