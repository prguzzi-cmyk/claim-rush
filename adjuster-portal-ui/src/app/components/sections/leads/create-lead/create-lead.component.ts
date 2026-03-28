import { Lead } from 'src/app/models/lead.model';
import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LeadService } from 'src/app/services/leads.service';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from 'src/app/services/user.service';
import { User } from 'src/app/models/user.model';
import { DatePipe } from '@angular/common';
import { NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { UsStatesService } from 'src/app/services/us-states.service';

@Component({
    selector: 'app-create-lead',
    templateUrl: './create-lead.component.html',
    styleUrls: ['./create-lead.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class CreateLeadComponent implements OnInit {
  model: NgbDateStruct;
  statuses: string[] = ['callback', 'not-interested', 'signed'];
  sources: string[] = ['self', 'company', 'other'];
  closeResult = '';
  leadFormDisabled: boolean = false;

  states: any[] = [];
  stateService: any = inject(UsStatesService);

  lead: Lead;
  leads: any;

  lead_id: string = null;
  agent: User;
  agents: any[];

  user: User;
  role: string;

  public leadForm = new FormGroup({
    lossDate: new FormControl(''),
    peril: new FormControl(''),
    insuranceCompany: new FormControl(''),
    policyNumber: new FormControl(''),
    claimNumber: new FormControl(''),
    status: new FormControl('', [Validators.required]),
    source: new FormControl('', [Validators.required]),
    sourceInfo: new FormControl(''),
    instructionsOrNotes: new FormControl(''),
    assignedTo: new FormControl('', [Validators.required]),
    canBeRemoved: new FormControl(true),

    fullName: new FormControl('', [Validators.required]),
    fullNameAlt: new FormControl(''),
    email: new FormControl(''),
    emailAlt: new FormControl(''),
    phoneNumber: new FormControl('', [Validators.required]),
    phoneNumberAlt: new FormControl(''),
    city: new FormControl(''),
    address: new FormControl(''),
    state: new FormControl(''),
    zipCode: new FormControl('', [Validators.pattern('\\d{5}')]),

    addressLoss: new FormControl(''),
    cityLoss: new FormControl(''),
    stateLoss: new FormControl(''),
    zipCodeLoss: new FormControl('', Validators.pattern('\\d{5}')),
  });

  constructor(
    public datepipe: DatePipe,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute,
    private leadService: LeadService,
    public userService: UserService) {

    if (!this.userService.getUserPermissions('lead', 'create')) {
      return;
    }

    this.getUser();

    this.states = this.stateService.getStatesList();
  }

  ngOnInit(): void {
    this.getUser();

    this.role = localStorage.getItem('role-name');

    if (this.role == 'super-admin' || this.role == 'admin') {
      this.statuses.push('signed-approved');
    }

    this.getUsers();
  }

  getUser() {
    this.userService.currentUser.subscribe((user) => {
      if (user) {
        this.user = user;
        if (this.route.snapshot.paramMap.get("id")) {
          this.lead_id = this.route.snapshot.paramMap.get("id");

          if (this.lead_id) {

            this.getLead();
          }
        }
      }
    });
  }

  getUsers() {

    this.userService.getUsers(1,100)
      .subscribe((agents) => {
        this.agents = agents.items;
      });

  }

  saveLead() {

    this.leadForm.markAllAsTouched();

    if (this.leadForm.valid) {

      this.leadFormDisabled = true;
      let leadData = new Lead;

      if (this.leadForm.controls['lossDate']?.value != '')
        leadData.loss_date = this.leadForm.controls['lossDate']?.value;

      leadData.peril = this.leadForm.controls['peril'].value;
      leadData.insurance_company = this.leadForm.controls['insuranceCompany'].value;
      leadData.policy_number = this.leadForm.controls['policyNumber'].value;
      leadData.claim_number = this.leadForm.controls['claimNumber'].value;
      leadData.source = this.leadForm.controls['source'].value;
      leadData.source_info = this.leadForm.controls['sourceInfo'].value;
      leadData.status = this.leadForm.controls['status'].value;
      leadData.instructions_or_notes = this.leadForm.controls['instructionsOrNotes'].value;
      leadData.assigned_to = (this.role == 'agent' ? this.user.id : this.leadForm.controls['assignedTo'].value);
      leadData.can_be_removed = this.leadForm.controls['canBeRemoved'].value;
      leadData.instructions_or_notes = this.leadForm.controls['instructionsOrNotes'].value;

      leadData.contact = {
        full_name: this.leadForm.controls['fullName'].value,
        full_name_alt: this.leadForm.controls['fullNameAlt'].value,
        phone_number: this.leadForm.controls['phoneNumber'].value,
        phone_number_alt: this.leadForm.controls['phoneNumberAlt'].value,
        address: this.leadForm.controls['address'].value,
        city: this.leadForm.controls['city'].value,
        state: this.leadForm.controls['state'].value,
        zip_code: this.leadForm.controls['zipCode'].value,
        address_loss: this.leadForm.controls['addressLoss'].value,
        city_loss: this.leadForm.controls['cityLoss'].value,
        state_loss: this.leadForm.controls['stateLoss'].value,
        zip_code_loss: this.leadForm.controls['zipCodeLoss'].value,
      };

      if (this.leadForm.controls['email'].value != '')
        leadData.contact.email = this.leadForm.controls['email'].value;

      if (this.leadForm.controls['emailAlt'].value != '')
        leadData.contact.email_alt = this.leadForm.controls['emailAlt'].value;


      if (this.lead_id) {
        leadData.id = this.lead_id;
        this.leadService.updateLead(leadData)
          .subscribe((data) => {
            // console.log(data);
            this.leadFormDisabled = false;
            this.snackBar.open('Lead has been updated', 'Close', {
              duration: 2000,
              horizontalPosition: 'end',
              verticalPosition: 'bottom',
            }).afterDismissed().subscribe(() => {
              this.router.navigateByUrl('/app/leads/' + this.lead_id)
            });
          },
            error => {
              console.log(error);
            });
      } else {
        this.leadService.addLead(leadData)
          .subscribe(data => {
            this.leads = data;

            this.snackBar.open('Lead has been created', 'Close', {
              duration: 2000,
              horizontalPosition: 'end',
              verticalPosition: 'bottom',
            }).afterDismissed().subscribe(() => {
              this.router.navigateByUrl('/app/leads/' + this.leads?.id)
            });
          },
            error => {
              console.log(error);
              this.leadFormDisabled = false;
            });
      }
    }
  }

  getLead() {
    this.leadService.getLead(this.lead_id)
      .subscribe(lead => {
        if (lead !== undefined) {

          this.lead = lead;
          this.leadForm.controls["lossDate"].patchValue(this.datepipe.transform(lead?.loss_date, 'yyyy-MM-ddThh:mm'));
          this.leadForm.controls["peril"].patchValue(lead?.peril);
          this.leadForm.controls["insuranceCompany"].patchValue(lead?.insurance_company);
          this.leadForm.controls["policyNumber"].patchValue(lead?.policy_number);
          this.leadForm.controls["claimNumber"].patchValue(lead?.claim_number);
          this.leadForm.controls["status"].patchValue(lead?.status);
          this.leadForm.controls["source"].patchValue(lead?.source);
          this.leadForm.controls["sourceInfo"].patchValue(lead?.source_info);
          this.leadForm.controls["instructionsOrNotes"].patchValue(lead?.instructions_or_notes);
          this.leadForm.controls["assignedTo"].patchValue(lead?.assigned_to);
          this.leadForm.controls["fullName"].patchValue(lead?.contact?.full_name);
          this.leadForm.controls["fullNameAlt"].patchValue(lead?.contact?.full_name_alt);
          this.leadForm.controls["email"].patchValue(lead?.contact?.email);
          this.leadForm.controls["emailAlt"].patchValue(lead?.contact?.email_alt);
          this.leadForm.controls["phoneNumber"].patchValue(lead?.contact?.phone_number);
          this.leadForm.controls["phoneNumberAlt"].patchValue(lead?.contact?.phone_number_alt);
          this.leadForm.controls["address"].patchValue(lead?.contact?.address);
          this.leadForm.controls["city"].patchValue(lead?.contact?.city);
          this.leadForm.controls["state"].patchValue(lead?.contact?.state);
          this.leadForm.controls["zipCode"].patchValue(lead?.contact?.zip_code);
          this.leadForm.controls["addressLoss"].patchValue(lead?.contact?.address_loss);
          this.leadForm.controls["cityLoss"].patchValue(lead?.contact?.city_loss);
          this.leadForm.controls["stateLoss"].patchValue(lead?.contact?.state_loss);
          this.leadForm.controls["zipCodeLoss"].patchValue(lead?.contact?.zip_code_loss);
          this.leadForm.controls["assignedTo"].patchValue(lead?.assigned_to);

          if (lead.status == 'signed-approved') {
            this.leadForm.disable();
          }

        }
      });
  }

}
