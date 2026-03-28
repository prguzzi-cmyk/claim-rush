import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  ChangeDetectorRef,
  // OnInit,
} from "@angular/core";
import { PortalFeatureService } from "src/app/services/portal-feature.service";
import { PortalFeature } from "src/app/models/portal-feature.model";

@Component({
    selector: "app-home",
    templateUrl: "./home.component.html",
    styleUrls: ["./home.component.scss"],
    standalone: false
})
export class HomeComponent implements AfterViewInit {
  @ViewChild("portalFeatureCard", { static: false })
  portalFeatureCard: ElementRef;
  @ViewChild("portalCircle", { static: false }) portalCircle: ElementRef;

  portalFeatures: PortalFeature[] = [];
  selectedPortalFeature;

  constructor(
    private cd: ChangeDetectorRef,
    private portalFeatureService: PortalFeatureService
  ) {}

  getFilteredPortalFeatures(firstItemIndex: number, lastItemIndex: number) {
    const filteredPortalFeatures = this.portalFeatures.filter(
      (portalFeature, index) => {
        if (index >= firstItemIndex && index <= lastItemIndex) {
          return portalFeature;
        }
      }
    );

    return filteredPortalFeatures;
  }

  getPortalFeatures() {
    this.portalFeatures = this.portalFeatureService.getPortalFeatures();
  }

  showFeatureCard() {
    this.portalFeatureCard.nativeElement.classList.add("fade-in");
  }

  playPortalPulseAnimation() {
    const portalCircle = this.portalCircle.nativeElement;

    if (portalCircle.classList.contains("pulse")) {
      portalCircle.classList.remove("pulse");

      setTimeout(function () {
        portalCircle.classList.add("pulse");
      });
    } else {
      portalCircle.classList.add("pulse");
    }
  }

  getSelectedPortalFeature() {
    this.portalFeatureService
      .getSelectedPortalFeature()
      .subscribe((selectedPortalFeature) => {
        this.selectedPortalFeature = selectedPortalFeature;

        function isSelectedPortalFeatureEmpty(selectedPortalFeature) {
          if (Object.keys(selectedPortalFeature).length > 0) {
            return false;
          } else {
            return true;
          }
        }

        if (!isSelectedPortalFeatureEmpty(this.selectedPortalFeature)) {
          this.playPortalPulseAnimation();
          this.showFeatureCard();
        }
      });
  }

  ngOnInit(): void {
    this.getPortalFeatures();
  }

  ngAfterViewInit(): void {
    this.getSelectedPortalFeature();

    this.cd.detectChanges();
  }
}
