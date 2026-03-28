import { Component, OnInit, Inject } from "@angular/core";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { MatSnackBar } from "@angular/material/snack-bar";
import { NgxSpinnerService } from "ngx-spinner";
import { DialogService } from "src/app/services/dialog.service";
import { UserService } from "src/app/services/user.service";
import { SourceService } from "src/app/services/source.service";
import { NpoInitiativeService } from "src/app/services/npo-initiative.service";
import { PartnershipService } from "src/app/services/partnership.service";
import { NetworkService } from "src/app/services/network.service";
import { GoogleMapsService } from "src/app/services/google-maps.service";
import { LeadService } from "src/app/services/leads.service";
import { NotificationService } from "src/app/services/notification.service";
// import { ChatgptService } from "src/app/services/chatgpt.service";
// import { Lead } from "src/app/models/lead.model";
// import { Message } from "src/app/models/message.model";

@Component({
    selector: "app-source-item-dialog",
    templateUrl: "./source-item-dialog.component.html",
    styleUrls: ["./source-item-dialog.component.scss"],
    standalone: false
})
export class SourceItemDialogComponent implements OnInit {
  dialogType: string = "create";
  dialogTitle: string = "";

  source: { name: string; displayName: any };
  sourceItem: {
    title: string;
    target: string;
    mission: string;
    environment: string;
    summary: string;
    key_elements: string;
    search_term: string;
    exploration_type: string;
    exploration_term: string;
    can_be_removed: boolean;
  };
  isActive: boolean = true;
  canBeRemoved: boolean = true;

  leads;
  leadsLocation: string = "";

  user;

  // chatgptMessage = {
  //   content: "",
  //   refusal: null,
  //   role: "assistant",
  // };
  // chatgptMessageContent;

  selectOptions = {
    environment: [
      {
        name: "in-person",
        displayName: "In person",
      },

      {
        name: "online",
        displayName: "Online",
      },

      {
        name: "hybrid",
        displayName: "Hybrid",
      },
    ],

    explorationType: [
      {
        name: "hyperlink",
        displayName: "Hyperlink",
      },

      {
        name: "search-term",
        displayName: "Search term",
      },
    ],
  };

  sourceItemForm = new FormGroup({
    title: new FormControl("", [
      Validators.required,
      Validators.maxLength(255),
    ]),
    target: new FormControl("", [
      Validators.required,
      Validators.maxLength(255),
    ]),
    mission: new FormControl("", [Validators.required]),
    environment: new FormControl("", [Validators.required]),
    summary: new FormControl("", [
      Validators.required,
      Validators.maxLength(500),
    ]),
    keyElements: new FormControl("", [Validators.required]),
    searchTerm: new FormControl("", [
      Validators.required,
      Validators.maxLength(150),
    ]),
    explorationType: new FormControl("", [Validators.required]),
    explorationTerm: new FormControl("", [
      Validators.required,
      Validators.maxLength(150),
    ]),
  });
  sourceItemFormDisabled: boolean = false;

  constructor(
    private snackBar: MatSnackBar,
    private dialogService: DialogService,
    private userService: UserService,
    private sourceService: SourceService,
    private npoInitiativeService: NpoInitiativeService,
    private partnershipService: PartnershipService,
    private networkService: NetworkService,
    // private chatgptService: ChatgptService,
    private googleMapsService: GoogleMapsService,
    private leadService: LeadService,
    private notificationService: NotificationService,
    private dialogRef: MatDialogRef<SourceItemDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private spinner: NgxSpinnerService
  ) {
    if (data) {
      this.dialogType = data.type;
      this.source = data.source;

      if (data.dialogTitle) {
        this.dialogTitle = data.title;
      }

      if (data.sourceItem) {
        this.sourceItem = data.sourceItem;
      }

      if (this.dialogType == "create" || this.dialogType == "edit") {
        if (
          this.source.name == "npo_initiative" ||
          this.source.name == "partnership"
        ) {
          this.sourceItemForm.controls["environment"].removeValidators(
            Validators.required
          );
          this.sourceItemForm.controls["summary"].removeValidators(
            Validators.required
          );
          this.sourceItemForm.controls["explorationType"].removeValidators(
            Validators.required
          );
          this.sourceItemForm.controls["explorationTerm"].removeValidators(
            Validators.required
          );
        } else {
          this.sourceItemForm.controls["target"].removeValidators(
            Validators.required
          );
          this.sourceItemForm.controls["mission"].removeValidators(
            Validators.required
          );
          this.sourceItemForm.controls["searchTerm"].removeValidators(
            Validators.required
          );
        }
      }

      if (this.dialogType == "edit") {
        const setBaseFormControls = () => {
          this.sourceItemForm.controls["title"].setValue(this.sourceItem.title);
          this.sourceItemForm.controls["keyElements"].setValue(
            this.sourceItem.key_elements
          );
          this.canBeRemoved = this.sourceItem.can_be_removed;
        };

        if (
          this.source.name == "npo_initiative" ||
          this.source.name == "partnership"
        ) {
          setBaseFormControls();
          this.sourceItemForm.controls["target"].setValue(
            this.sourceItem.target
          );
          this.sourceItemForm.controls["mission"].setValue(
            this.sourceItem.mission
          );
          this.sourceItemForm.controls["searchTerm"].setValue(
            this.sourceItem.search_term
          );
        } else {
          setBaseFormControls();
          this.sourceItemForm.controls["environment"].setValue(
            this.sourceItem.environment
          );
          this.sourceItemForm.controls["summary"].setValue(
            this.sourceItem.summary
          );
          this.sourceItemForm.controls["explorationType"].setValue(
            this.sourceItem.exploration_type
          );
          this.sourceItemForm.controls["explorationTerm"].setValue(
            this.sourceItem.exploration_term
          );
        }
      }

      if (this.dialogType == "leads") {
        this.spinner.show();

        this.dialogTitle = data.title;

        // let chatgptMessage = JSON.parse(localStorage.getItem("chatgptMessage"));

        // function getChatgptMessageContent(chatgptMessage) {
        //   const chatgptMessageContent = chatgptMessage.content
        //     .replace(/(?:\r\n|\r|\n)/g, "<br>")
        //     .replace("```json", "<pre>")
        //     .replace("```", "</pre>");

        //   return chatgptMessageContent;
        // }

        // if (chatgptMessage) {
        //   this.chatgptMessage = chatgptMessage;

        //   this.chatgptMessageContent = getChatgptMessageContent(chatgptMessage);

        //   this.spinner.hide();
        // } else {

        // const messages: Message[] = [
        //   {
        //     role: "user",
        //     content: data.query,
        //   },
        // ];

        this.googleMapsService.getLeads(data.reqBody).subscribe(
          (leads: any) => {
            this.leads = leads.places;

            this.spinner.hide();
          }
          // (err) => this.handleError(err, "restore")
        );

        // this.googleMapsService.getLeads(messages).then((response) => {
        //   response.subscribe((message) => {
        //     console.log("message", message);
        //     this.chatgptMessage = message;

        //     this.chatgptMessageContent = getChatgptMessageContent(message);

        //     // localStorage.setItem("chatgptMessage", JSON.stringify(message));

        //     this.spinner.hide();
        //   });
        // });
        // }
      }
    }
  }

  // getLeads() {
  //   let lead;
  //   let leads;
  //   let leadKeys;

  //   const chatgptMessageContent = this.chatgptMessage.content;

  //   if (
  //     chatgptMessageContent.startsWith("{") &&
  //     chatgptMessageContent.endsWith("}")
  //   ) {
  //     lead = chatgptMessageContent;
  //   } else {
  //     const chatgptMessageContentArr = chatgptMessageContent.split("```");

  //     chatgptMessageContentArr.forEach((chatgptMessageContentArrItem) => {
  //       if (chatgptMessageContentArrItem.startsWith("json")) {
  //         lead = chatgptMessageContentArrItem.slice(4, -1);
  //       }
  //     });
  //   }

  //   lead = JSON.parse(lead);

  //   leadKeys = Object.keys(lead);

  //   leads = lead[leadKeys[0]];

  //   return leads;
  // }

  // location

  isElementDisplayed(sourceNames: string[]) {
    const isElementDisplayed = sourceNames.includes(this.source.name);

    return isElementDisplayed;
  }

  toggleIsActive(event: MatSlideToggleChange) {
    this.isActive = event.checked;
  }

  toggleCanBeRemoved(event: MatSlideToggleChange) {
    this.canBeRemoved = event.checked;
  }

  getSourceItem() {
    let sourceItem: any;

    const baseSourceItem = {
      title: this.sourceItemForm.controls["title"].value,
      key_elements: this.sourceItemForm.controls["keyElements"].value,
      is_active: this.isActive,
      can_be_removed: this.canBeRemoved,
    };

    if (
      this.source.name == "npo_initiative" ||
      this.source.name == "partnership"
    ) {
      sourceItem = {
        ...baseSourceItem,
        target: this.sourceItemForm.controls["target"].value,
        mission: this.sourceItemForm.controls["mission"].value,
        search_term: this.sourceItemForm.controls["searchTerm"].value,
      };
    } else {
      sourceItem = {
        ...baseSourceItem,
        environment: this.sourceItemForm.controls["environment"].value,
        summary: this.sourceItemForm.controls["summary"].value,
        exploration_type: this.sourceItemForm.controls["explorationType"].value,
        exploration_term: this.sourceItemForm.controls["explorationTerm"].value,
      };
    }

    return sourceItem;
  }

  displayNotificationCard(message: string, requestStatus: string) {
    this.sourceItemFormDisabled = false;

    this.notificationService.displayNotificationCard(
      this.dialogRef,
      message,
      requestStatus
    );
  }

  getNotificationMessage(messageType: string, operation: string) {
    const message = `${this.source.displayName} has ${
      messageType == "unsuccessful" ? "not" : ""
    } been ${
      operation == "create"
        ? "created."
        : operation == "update"
        ? "updated."
        : operation == "delete"
        ? "deleted."
        : "restored"
    } ${messageType == "unsuccessful" ? "please try again." : ""} `;

    return message;
  }

  handleResposnse(operation?: string) {
    this.displayNotificationCard(
      this.getNotificationMessage("successful", operation),
      "successful"
    );
  }

  handleError(err: { err: { detail: any } }, operation: string) {
    this.displayNotificationCard(
      err.err?.detail || this.getNotificationMessage("unsuccessful", operation),
      "unsuccessful"
    );
  }

  getArrayFromString(string: string) {
    const arr = string?.split("*");

    arr?.shift();

    return arr;
  }

  createSourceItem() {
    this.sourceItemFormDisabled = true;

    if (this.source.name == "npo_initiative") {
      this.npoInitiativeService
        .createNpoInitiative(this.getSourceItem())
        .subscribe(
          () => this.handleResposnse("create"),
          (err) => this.handleError(err, "create")
        );
    } else if (this.source.name == "partnership") {
      this.partnershipService.createPartnership(this.getSourceItem()).subscribe(
        () => this.handleResposnse("create"),
        (err) => this.handleError(err, "create")
      );
    } else {
      this.networkService.createNetwork(this.getSourceItem()).subscribe(
        () => this.handleResposnse("create"),
        (err) => this.handleError(err, "create")
      );
    }
  }

  updateSourceItem(sourceItemId: string) {
    this.sourceItemFormDisabled = true;

    if (this.source.name == "npo_initiative") {
      this.npoInitiativeService
        .updateNpoInitiative(sourceItemId, this.getSourceItem())
        .subscribe(
          () => this.handleResposnse("update"),
          (err) => this.handleError(err, "update")
        );
    } else if (this.source.name == "partnership") {
      this.partnershipService
        .updatePartnership(sourceItemId, this.getSourceItem())
        .subscribe(
          () => this.handleResposnse("update"),
          (err) => this.handleError(err, "update")
        );
    } else {
      this.networkService
        .updateNetwork(sourceItemId, this.getSourceItem())
        .subscribe(
          () => this.handleResposnse("update"),
          (err) => this.handleError(err, "update")
        );
    }
  }

  deleteSourceItem(sourceItemId: string) {
    if (this.source.name == "npo_initiative") {
      this.npoInitiativeService.deleteNpoInitiative(sourceItemId).subscribe(
        () => this.handleResposnse("delete"),
        (err) => this.handleError(err, "delete")
      );
    } else if (this.source.name == "partnership") {
      this.partnershipService.deletePartnership(sourceItemId).subscribe(
        () => this.handleResposnse("delete"),
        (err) => this.handleError(err, "delete")
      );
    } else {
      this.networkService.deleteNetwork(sourceItemId).subscribe(
        () => this.handleResposnse("delete"),
        (err) => this.handleError(err, "delete")
      );
    }
  }

  restoreSourceItem(sourceItemId: string) {
    if (this.source.name == "npo_initiative") {
      this.npoInitiativeService.restoreNpoInitiative(sourceItemId).subscribe(
        () => this.handleResposnse("restore"),
        (err) => this.handleError(err, "restore")
      );
    } else if (this.source.name == "partnership") {
      this.partnershipService.restorePartnership(sourceItemId).subscribe(
        () => this.handleResposnse("restore"),
        (err) => this.handleError(err, "restore")
      );
    } else {
      this.networkService.restoreNetwork(sourceItemId).subscribe(
        () => this.handleResposnse("restore"),
        (err) => this.handleError(err, "restore")
      );
    }
  }

  addLeads() {
    const leadsLocation = this.sourceService.leadsLocation;
    const leads = this.leads.map((lead) => {
      let leadData = {
        // loss_date: "2019-08-24T14:15:22Z",
        peril: "",
        ref_string: "",
        insurance_company: "",
        policy_number: "",
        claim_number: "",
        status: "callback",
        // source: "07b8e003-7027-443f-88b0-24a5eb1cc68b",
        source_info: "",
        instructions_or_notes: "",
        assigned_to: "",
        can_be_removed: true,
        id: "",
        is_removed: false,
        contact: {
          full_name: "",
          full_name_alt: "",
          email: "",
          // email_alt: "",
          phone_number: "",
          phone_number_alt: "",
          address: "",
          city: "",
          state: "",
          zip_code: "",
          address_loss: "",
          city_loss: "",
          state_loss: "",
          zip_code_loss: "",
          id: "",
        },
        assigned_user: {
          first_name: "",
          last_name: "",
          email: "",
          user_meta: {
            avatar: "",
            address: "",
            city: "",
            state: "",
            zip_code: "",
            phone_number: "",
            id: "",
          },
        },
        follow_ups: [
          {
            type: "",
            dated: "",
            note: "",
            next_date: "",
            id: "",
            can_be_removed: true,
            is_removed: false,
            created_by: {
              first_name: "",
              last_name: "",
              id: "",
            },
            updated_by: {
              first_name: "",
              last_name: "",
              id: "",
            },
            created_at: "",
            updated_at: "",
          },
        ],
        created_by: {
          first_name: "",
          last_name: "",
        },
        updated_by: {
          first_name: "",
          last_name: "",
        },
        created_at: "",
        updated_at: "",
      };

      leadData.assigned_to = this.user?.id;
      leadData.contact.full_name = lead.displayName.text;
      leadData.contact.email = "email@email.com";
      leadData.contact.phone_number = lead.nationalPhoneNumber;
      leadData.contact.address = lead.formattedAddress;
      leadData.contact.city = leadsLocation.split(",")[0];
      leadData.contact.state = leadsLocation.split(",")[1];
      leadData.contact.zip_code = "";

      lead = leadData;

      return lead;
    });
    let numOfLeadsAdded = 0;

    this.leadService.addLeads(leads, 100).subscribe(
      () => {
        numOfLeadsAdded = numOfLeadsAdded + 1;

        this.snackBar.open("Lead created", "Close", {
          duration: 10000,
          horizontalPosition: "end",
          verticalPosition: "bottom",
        });

        if (numOfLeadsAdded === 10) {
          this.snackBar.open("Leads created", "Close", {
            duration: 10000,
            horizontalPosition: "end",
            verticalPosition: "bottom",
          });
        }
      },

      (error) => {
        console.log(error);

        this.snackBar.open("Lead not created", "Close", {
          duration: 10000,
          horizontalPosition: "end",
          verticalPosition: "bottom",
          panelClass: ["snackbar-error"],
        });
      }
    );

    // let leads = this.getLeads();

    // let leadsNotAdded = [];

    // if (leadsNotAdded.length === 0) {
    //   leads.forEach((lead) => {
    //     this.leadService.addLead(lead).subscribe(
    //       (lead) => {},
    //       (error) => {
    //         leadsNotAdded.push(lead);
    //       }
    //     );
    //   });
    // } else {
    //   leadsNotAdded.forEach((leadNotAdded) => {
    //     this.leadService.addLead(leadNotAdded).subscribe(
    //       (lead: any) => {
    //         leadsNotAdded = leadsNotAdded.filter((leadNotAdded) => {
    //           if (leadNotAdded.contact.full_name !== lead.contact.full_name) {
    //             return leadNotAdded;
    //           }
    //         });
    //       },
    //       (error) => {}
    //     );
    //   });
    // }

    // if (leadsNotAdded.length === 0) {
    //   this.snackBar.open("Leads created", "Close", {
    //     duration: 10000,
    //     horizontalPosition: "end",
    //     verticalPosition: "bottom",
    //   });

    //   // localStorage.removeItem("chatgptMessage");

    //   setTimeout(() => {
    //     this.dialogRef.close();
    //   }, 2000);
    // } else {
    //   this.snackBar.open("Leads not created", "Close", {
    //     duration: 10000,
    //     horizontalPosition: "end",
    //     verticalPosition: "bottom",
    //     panelClass: ["snackbar-error"],
    //   });
    // }

    // for (let i = 0; i < leads.length; i++) {
    //   const lead = leads[i];

    //   let isLeadAdded;

    //   this.leadService.addLead(lead).subscribe(
    //     (lead) => {
    //       console.log("lead created", lead);
    //       isLeadAdded = true;
    //     },
    //     (error) => {
    //       console.log(error);

    //       isLeadAdded = false;
    //     }
    //   );
    // }
  }

  setLeadsLocation() {
    this.sourceService.setLeadsLocation(this.leadsLocation);
  }

  openLeadsDialog(sourceItemTitle: string) {
    this.setLeadsLocation();

    const leadsDialogData = {
      type: "leads",
      title: "",
      reqBody: {
        textQuery: "",
        pageSize: 10,
      },
    };

    if (sourceItemTitle === "Loyal Christian Housing Advantage") {
      leadsDialogData.title = `Churches in ${this.leadsLocation}`;
      leadsDialogData.reqBody.textQuery = `Churches in ${this.leadsLocation}`;
    } else if (sourceItemTitle === "Restaurant Rescue") {
      leadsDialogData.title = `Restaurant in ${this.leadsLocation}`;
      leadsDialogData.reqBody.textQuery = `Restaurants in ${this.leadsLocation}`;
    } else if (sourceItemTitle === "Seller’s Advantage") {
      leadsDialogData.title = `Realtors in ${this.leadsLocation}`;
      leadsDialogData.reqBody.textQuery = `Real estate agents in ${this.leadsLocation}`;
    } else if (sourceItemTitle === "Landlord Advantage") {
      leadsDialogData.title = `Landlords in ${this.leadsLocation}`;
      leadsDialogData.reqBody.textQuery = `Landlords in ${this.leadsLocation}`;
    } else if (sourceItemTitle === "Business Owners Relief") {
      leadsDialogData.title = `Businesses in ${this.leadsLocation}`;
      leadsDialogData.reqBody.textQuery = `Businesses in ${this.leadsLocation}`;
    }

    this.dialogService.openDialog(SourceItemDialogComponent, leadsDialogData);
  }

  // Newtown, Pennsylvania
  // Pittsburgh, Pennsylvania
  // openQuerySourceItemDialog
  // openChatgptDialog(sourceItemTitle: string) {
  //   this.setLeadsLocation();

  //   function getChatgptDialogData() {
  //     const chatgptDialogData = {
  //       type: "chatgpt",
  //       title: "",
  //       query: "",
  //     };

  //     if (sourceItemTitle === "Loyal Christian Housing Advantage") {
  //       chatgptDialogData.title = `Churches in ${this.leadsLocation}`;
  //       chatgptDialogData.query = `Generate a list of churches with their contact information in JSON format; limiting the location to ${this.leadsLocation}`;
  //     } else if (sourceItemTitle === "Restaurant Rescue") {
  //       chatgptDialogData.title = `Resturants in ${this.leadsLocation}`;
  //       chatgptDialogData.query = `Generate a JSON-format list of restaurants from publicly accessible sources; provide the restaurants contact information; limit the location to ${this.leadsLocation}; Do not provide fictional information.`;
  //     } else if (sourceItemTitle === "Seller’s Advantage") {
  //       chatgptDialogData.title = `Realtors in ${this.leadsLocation}`;
  //       chatgptDialogData.query = `Generate a JSON-format list of real estate properties from real estate listing websites; limit the location to ${this.leadsLocation}; Do not provide fictional information.`;
  //     } else if (sourceItemTitle === "Landlord Advantage") {
  //       chatgptDialogData.title = `Landlords in ${this.leadsLocation}`;
  //       chatgptDialogData.query = `Generate a list of Landlords with their contact information in JSON format; limiting the location to ${this.leadsLocation}`;
  //     } else if (sourceItemTitle === "Business Owners Relief") {
  //       chatgptDialogData.title = `Businesses in ${this.leadsLocation}`;
  //       chatgptDialogData.query = `Generate a JSON-format list of businesses from publicly accessible sources; provide the businesses contact information; limit the location to ${this.leadsLocation}; Do not provide fictional information.`;
  //     }

  //     return chatgptDialogData;
  //   }

  //   this.dialogService.openDialog(
  //     SourceItemDialogComponent,
  //     getChatgptDialogData()
  //   );
  // }

  getUser() {
    this.userService.currentUser.subscribe((user) => {
      if (user) {
        this.user = user;
      }
    });
  }

  ngOnInit(): void {
    this.getUser();
  }
}
