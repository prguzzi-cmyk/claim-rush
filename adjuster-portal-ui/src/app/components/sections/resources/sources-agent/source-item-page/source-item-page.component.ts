import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Location } from "@angular/common";
import { SourceService } from "src/app/services/source.service";
import { NpoInitiativeService } from "src/app/services/npo-initiative.service";
import { PartnershipService } from "src/app/services/partnership.service";
import { NetworkService } from "src/app/services/network.service";
import { DialogService } from "src/app/services/dialog.service";
import { Source } from "src/app/models/source.model";
import { NpoInitiative } from "src/app/models/npo-initiative.model";
import { Partnership } from "src/app/models/partnership.model";
import { Network } from "src/app/models/network.model";
import { SourceItemDialogComponent } from "src/app/components/dialogs/source-item-dialog/source-item-dialog.component";

@Component({
    selector: "app-source-item-page",
    templateUrl: "./source-item-page.component.html",
    styleUrls: ["./source-item-page.component.scss"],
    standalone: false
})
export class SourceItemPageComponent implements OnInit {
  source: Source;

  sourceItem;
  sourceItemId: string;

  constructor(
    private activatedRoute: ActivatedRoute,
    private location: Location,
    private sourceService: SourceService,
    private npoInitiativeService: NpoInitiativeService,
    private partnershipService: PartnershipService,
    private networkService: NetworkService,
    private dialogService: DialogService
  ) {}

  getSource() {
    this.sourceService.getSource().subscribe((source: Source) => {
      this.source = source;
    });
  }

  getSourceItemId() {
    this.sourceItemId = this.activatedRoute.snapshot.params.id;
  }

  setSourceItem(sourceItem: NpoInitiative | Partnership | Network) {
    this.sourceItem = sourceItem;
  }

  handleResponse(sourceItem: NpoInitiative | Partnership | Network) {
    this.setSourceItem(sourceItem);
  }

  getNpoInitiative() {
    this.npoInitiativeService
      .getNpoInitiative(this.sourceItemId)
      .subscribe((npoInitiative) => this.handleResponse(npoInitiative));
  }

  getPartnership() {
    this.partnershipService
      .getPartnership(this.sourceItemId)
      .subscribe((partnership) => this.handleResponse(partnership));
  }

  getNetwork() {
    this.networkService
      .getNetwork(this.sourceItemId)
      .subscribe((network) => this.handleResponse(network));
  }

  getSourceItem() {
    if (this.source.name == "npo_initiative") {
      this.getNpoInitiative();
    } else if (this.source.name == "partnership") {
      this.getPartnership();
    } else {
      this.getNetwork();
    }
  }

  isElementDisplayed(sourceNames: string[]) {
    const isElementDisplayed = sourceNames.includes(this.source.name);

    return isElementDisplayed;
  }

  getArrayFromString(string: string) {
    const arr = string?.split("*");

    arr?.shift();

    return arr;
  }

  openLocationSourceItemDialog(
    sourceItem: NpoInitiative | Partnership | Network
  ) {
    this.dialogService.openDialog(SourceItemDialogComponent, {
      type: "location",
      title: "Enter Location",
      sourceItem: sourceItem,
    });
  }

  handleQueryButtonClick(sourceItem: NpoInitiative | Partnership | Network) {
    if (localStorage.getItem("chatgptMessage")) {
      this.dialogService.openDialog(SourceItemDialogComponent, {
        type: "chatgpt",
      });
    } else {
      this.openLocationSourceItemDialog(sourceItem);
    }
  }

  goBack() {
    this.location.back();
  }

  ngOnInit(): void {
    this.getSource();
    this.getSourceItemId();
    this.getSourceItem();
  }
}
