import { Component, Input, ViewChild, ElementRef, OnInit } from "@angular/core";
import { PortalFeatureService } from "src/app/services/portal-feature.service";
import { PortalFeature } from "src/app/models/portal-feature.model";

@Component({
    selector: "app-portal-feature",
    templateUrl: "./portal-feature.component.html",
    styleUrls: ["./portal-feature.component.scss"],
    standalone: false
})
export class PortalFeatureComponent implements OnInit {
  @Input() portalFeature: any;
  @Input() screenSize: string;

  @ViewChild("circlesContainer", { static: false })
  circlesContainer: ElementRef;

  constructor(private portalFeaturesService: PortalFeatureService) {}

  playPulseAnimation() {
    const circles = [...this.circlesContainer.nativeElement.children];

    circles.forEach((circle) => {
      if (circle.classList.contains("pulse")) {
        circle.classList.remove("pulse");

        setTimeout(function () {
          circle.classList.add("pulse");
        });
      } else {
        circle.classList.add("pulse");
      }
    });
  }

  handleClick(portalFeature: PortalFeature) {
    this.setSelectedPortalFeature(portalFeature);

    this.playPulseAnimation();
  }

  setSelectedPortalFeature(portalFeature: PortalFeature) {
    this.portalFeaturesService.setSelectedPortalFeature(portalFeature);
  }

  ngOnInit(): void {}
}
