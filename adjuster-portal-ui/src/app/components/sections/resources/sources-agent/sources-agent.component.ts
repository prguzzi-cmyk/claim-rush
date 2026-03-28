import { Component, OnInit } from "@angular/core";
import { Location } from "@angular/common";
import { MatTabChangeEvent } from "@angular/material/tabs";
import { SourceService } from "src/app/services/source.service";
import { NpoInitiativeService } from "src/app/services/npo-initiative.service";
import { PartnershipService } from "src/app/services/partnership.service";
import { NetworkService } from "src/app/services/network.service";
import { Source } from "src/app/models/source.model";
import { TabService } from "src/app/services/tab.service";
import { UserService } from "src/app/services/user.service";

@Component({
    selector: "app-sources-agent",
    templateUrl: "./sources-agent.component.html",
    styleUrls: ["./sources-agent.component.scss"],
    standalone: false
})
export class SourcesAgentComponent implements OnInit {
  source: Source;

  selectedTabIndex: Number = 0;

  sourceItems;

  constructor(
    private location: Location,
    private sourceService: SourceService,
    private npoInitiativeService: NpoInitiativeService,
    private partnershipService: PartnershipService,
    private networkService: NetworkService,
    private tabService: TabService,
    public userService: UserService
  ) {}

  getSource() {
    this.sourceService.getSource().subscribe((source: Source) => {
      if (source) {
        this.source = source;
      } else {
        this.source = {
          name: "npo_initiative",
          displayName: "NPO Initiative",
        };
      }
    });
  }

  setSourceItems(sourceItems: any) {
    this.sourceItems = sourceItems;
  }

  handleResponse(sourceItems: any) {
    this.setSourceItems(sourceItems);
  }

  getNpoInitiatives() {
    this.npoInitiativeService
      .getNpoInitiatives()
      .subscribe((npoInitiatives) => this.handleResponse(npoInitiatives.items));
  }

  getPartnerships() {
    this.partnershipService
      .getPartnerships()
      .subscribe((partnerships) => this.handleResponse(partnerships.items));
  }

  getNetworks() {
    this.networkService
      .getNetworks()
      .subscribe((networks) => this.handleResponse(networks.items));
  }

  getSourceItems() {
    if (
      this.source.name == "npo_initiative" &&
      this.userService.getUserPermissions("npo_initiative", "read")
    ) {
      this.getNpoInitiatives();
    } else if (
      this.source.name == "partnership" &&
      this.userService.getUserPermissions("partnership", "read")
    ) {
      this.getPartnerships();
    } else if (this.userService.getUserPermissions("network", "read")) {
      this.getNetworks();
    }
  }

  setSource(sourceName: string) {
    this.sourceService.setSource(sourceName).subscribe((source) => {
      this.source = source;

      this.getSourceItems();
    });
  }

  onTabChange(event: MatTabChangeEvent) {
    const sourceName = event.tab.textLabel;

    this.setSource(sourceName);

    this.selectedTabIndex = event.index;

    localStorage.setItem(
      "sourcesSelectedTabIndex",
      JSON.stringify(this.selectedTabIndex)
    );
  }

  goBack() {
    this.location.back();
  }

  ngOnInit(): void {
    this.getSource();

    this.getSourceItems();

    if (localStorage.getItem("sourcesSelectedTabIndex")) {
      this.selectedTabIndex = JSON.parse(
        localStorage.getItem("sourcesSelectedTabIndex")
      );
    }
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }
}
