import { Component, OnInit, ViewChild } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatPaginator } from "@angular/material/paginator";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTableDataSource } from "@angular/material/table";
import { EstimatingService } from "../../../services/estimating.service";
import { PricingVersion } from "../../../models/estimating.model";
import { PricingImportDialogComponent } from "./pricing-import-dialog/pricing-import-dialog.component";
import { PricingVersionDialogComponent } from "./pricing-version-dialog/pricing-version-dialog.component";

@Component({
  selector: "app-pricing-admin",
  templateUrl: "./pricing-admin.component.html",
  styleUrls: ["./pricing-admin.component.scss"],
  standalone: false,
})
export class PricingAdminComponent implements OnInit {
  dataSource = new MatTableDataSource<PricingVersion>([]);
  displayedColumns = [
    "version_label",
    "source",
    "effective_date",
    "region",
    "status",
    "item_count",
    "created_at",
    "actions",
  ];
  totalRecords = 0;
  pageIndex = 1;
  pageSize = 10;
  loading = false;

  // Filters
  statusFilter = "";
  sourceFilter = "";

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private estimatingService: EstimatingService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadVersions();
  }

  loadVersions(): void {
    this.loading = true;
    this.estimatingService
      .getPricingVersions(
        this.statusFilter || undefined,
        this.sourceFilter || undefined
      )
      .subscribe({
        next: (res: any) => {
          this.dataSource.data = res.items || res;
          this.totalRecords = res.total || res.items?.length || 0;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.snackBar.open("Failed to load pricing versions", "Close", {
            duration: 3000,
          });
        },
      });
  }

  onPageChange(event: any): void {
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadVersions();
  }

  applyFilter(): void {
    this.pageIndex = 1;
    this.loadVersions();
  }

  clearFilters(): void {
    this.statusFilter = "";
    this.sourceFilter = "";
    this.loadVersions();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case "active":
        return "primary";
      case "draft":
        return "accent";
      case "archived":
        return "warn";
      default:
        return "";
    }
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(PricingVersionDialogComponent, {
      width: "500px",
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.loadVersions();
    });
  }

  openImportDialog(version: PricingVersion): void {
    const dialogRef = this.dialog.open(PricingImportDialogComponent, {
      width: "600px",
      data: { version },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.loadVersions();
    });
  }

  activateVersion(version: PricingVersion): void {
    if (
      !confirm(
        `Activate "${version.version_label}"? The current active version for ${version.source}/${version.region} will be archived.`
      )
    ) {
      return;
    }

    this.estimatingService.activatePricingVersion(version.id!).subscribe({
      next: () => {
        this.snackBar.open("Version activated successfully", "Close", {
          duration: 3000,
        });
        this.loadVersions();
      },
      error: () => {
        this.snackBar.open("Failed to activate version", "Close", {
          duration: 3000,
        });
      },
    });
  }

  viewItems(version: PricingVersion): void {
    // Navigate or open dialog to show items — for now just toggle inline
    this.estimatingService
      .getPricingVersionItems(version.id!, 1, 50)
      .subscribe({
        next: (res: any) => {
          (version as any)._items = res.items || [];
          (version as any)._showItems = !(version as any)._showItems;
        },
        error: () => {
          this.snackBar.open("Failed to load items", "Close", {
            duration: 3000,
          });
        },
      });
  }
}
