import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { EstimatingService } from "src/app/services/estimating.service";
import { TabService } from "src/app/services/tab.service";
import { EstimateMode } from "src/app/models/estimating.model";
import { ESTIMATE_MODE_MAP } from "src/app/constants/estimate-mode.config";

@Component({
  selector: "app-estimating-list",
  templateUrl: "./estimating-list.component.html",
  styleUrls: ["./estimating-list.component.scss"],
  standalone: false,
})
export class EstimatingListComponent implements OnInit {
  estimates: any[] = [];
  loading = false;

  constructor(
    private router: Router,
    private estimatingService: EstimatingService,
    private tabService: TabService
  ) {}

  ngOnInit() {
    this.tabService.setSideTitle("Estimating");
    this.loadEstimates();
  }

  loadEstimates() {
    this.loading = true;
    this.estimatingService.getEstimates(1, 50).subscribe({
      next: (response: any) => {
        console.log('[EstimatingList] API response:', response);
        this.estimates = response?.items || [];
        console.log('[EstimatingList] estimates.length:', this.estimates.length);
        this.loading = false;
      },
      error: (err: any) => {
        console.error('[EstimatingList] API error:', err);
        this.estimates = [];
        this.loading = false;
      },
    });
  }

  createNewEstimate() {
    this.router.navigate(["/app/estimating/create"]);
  }

  openEstimate(id: string) {
    this.router.navigate(["/app/estimating", id]);
  }

  deleteEstimate(id: string, event: Event) {
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this estimate?")) {
      this.estimatingService.deleteEstimate(id).subscribe({
        next: () => {
          this.loadEstimates();
        },
      });
    }
  }

  getModeBadgeLabel(mode?: string): string {
    const key = (mode || 'residential') as EstimateMode;
    return ESTIMATE_MODE_MAP[key]?.label || 'Residential';
  }
}
