import { DatePipe } from '@angular/common';
import { Component, Inject, OnInit, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { NgxSpinnerService } from 'ngx-spinner';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { Claim } from 'src/app/models/claim.model';
import { Client } from 'src/app/models/client.model';
import { User } from 'src/app/models/user.model';
import { ClaimService } from 'src/app/services/claim.service';
import { ClientService } from 'src/app/services/client.service';
import { MastersService } from 'src/app/services/masters.service';
import { UsStatesService } from 'src/app/services/us-states.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-claim-dialog',
    templateUrl: './claim-dialog.component.html',
    styleUrls: ['./claim-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ClaimDialogComponent implements OnInit {
  model: NgbDateStruct;
  phases: any;

  sources: string[] = ['self', 'company', 'other'];
  feeTypes: string[] = ['percentage', 'fixed', 'hourly'];

  action: any;
  showClients: boolean = false;
  closeResult = '';
  claimFormDisabled: boolean = false;

  states: any[] = [];
  stateService: any = inject(UsStatesService);

  claim: Claim;
  claims: any;

  claim_id: string = null;
  client_id: string = null;
  agent: User;
  agents: any[];
  clients: Client[];

  // Client search + inline creation
  clientSearchTerm = '';
  filteredClientList: Client[] = [];
  showClientDropdown = false;
  showNewClientForm = false;
  creatingClient = false;
  newClientForm = new FormGroup({
    full_name: new FormControl('', Validators.required),
    phone_number: new FormControl('', Validators.required),
    email: new FormControl('', Validators.email),
    address: new FormControl('', Validators.required),
    city: new FormControl('', Validators.required),
    state: new FormControl('', Validators.required),
    zip_code: new FormControl('', [Validators.required, Validators.pattern('\\d{5}')]),
  });

  user: User;
  role: string;

  policyTypes: any;
  subPolicyTypes: any;
  coverageTypes: any;
  originTypes: any;
  recoveryModes: any;

  showSourceDropdown: boolean = false;
  showSignedByDropdown: boolean = false;
  showAdjustedByDropdown: boolean = false;
  showAssignedToDropdown: boolean = false;

  sourceByControl = new FormControl('');
  signedByControl = new FormControl('');
  adjustedByControl = new FormControl('');
  assignedToControl = new FormControl('');

  filteredAgents: any[] = [];
  filteredSignedByAgents: any[] = [];
  filteredAdjustedByAgents: any[] = [];
  filteredAssignedtoAgents: any[] = [];

  public claimForm = new FormGroup({
    client: new FormControl(''),
    lossDate: new FormControl(''),
    peril: new FormControl(''),
    insuranceCompany: new FormControl(''),
    policyNumber: new FormControl(''),
    claimNumber: new FormControl(''),
    feeType: new FormControl(''),
    fee: new FormControl(''),
    currentPhase: new FormControl(''),
    source: new FormControl(''),
    sourceInfo: new FormControl(''),
    signedBy: new FormControl(''),
    adjustedBy: new FormControl(''),
    anticipated_amount: new FormControl(''),
    instructionsOrNotes: new FormControl(''),
    assignedTo: new FormControl(''),
    policyType: new FormControl(),
    subPolicyType: new FormControl(),
    dateLodged: new FormControl(),
    lawsuitDeadline: new FormControl(),
    mortgageCompany: new FormControl(),
    addressLoss: new FormControl(''),
    cityLoss: new FormControl(''),
    stateLoss: new FormControl(''),
    zipCodeLoss: new FormControl('', Validators.pattern('\\d{5}')),
    femaClaim: new FormControl(''),
    stateOfEmergency: new FormControl(''),
    inhabitable: new FormControl(''),
    contractSignDate: new FormControl(''),
    coverages: new FormArray([]),
    originType: new FormControl(''),
    dateAciEntered: new FormControl(''),
    priorCarrierPayments: new FormControl(''),
    recoveryMode: new FormControl(''),
  });

  controlLabels = {
    client: 'Client',
    lossDate: 'Date of Loss',
    peril: 'Peril Type',
    insuranceCompany: 'Insurance Company',
    policyNumber: 'Policy #',
    claimNumber: 'Claim #',
    feeType: 'Fee Type',
    fee: 'Fee Amount',
    currentPhase: 'Current Phase',
    source: 'Source',
    sourceInfo: 'Source Information',
    signedBy: 'Signed By',
    adjustedBy: 'Adjusted By',
    anticipated_amount: 'Anticipated Amount',
    instructionsOrNotes: 'Instructions or Notes',
    assignedTo: 'Assigned To',
    policyType: 'Policy Type',
    subPolicyType: 'Sub-Policy Type',
    dateLodged: 'Date Lodged',
    lawsuitDeadline: 'Lawsuit Deadline',
    mortgageCompany: 'Mortgage Company',
    addressLoss: 'Loss Address',
    cityLoss: 'Loss City',
    stateLoss: 'Loss State',
    zipCodeLoss: 'Loss Zip Code',
    femaClaim: 'FEMA Claim',
    stateOfEmergency: 'State of Emergency',
    inhabitable: 'Inhabitable',
    contractSignDate: 'Contract Sign Date',
    coverages: 'Coverage Type, Policy Limit',
    originType: 'Claim Origin Type',
    dateAciEntered: 'Date ACI Entered Claim',
    priorCarrierPayments: 'Prior Carrier Payments',
    recoveryMode: 'Recovery Mode',
  };

  constructor(
    private dialogRef: MatDialogRef<ClaimDialogComponent>,
    private snackBar: MatSnackBar,
    public datepipe: DatePipe,
    private router: Router,
    private route: ActivatedRoute,
    private claimService: ClaimService,
    private clientService: ClientService,
    public userService: UserService,
    private spinner: NgxSpinnerService,
    private mastersService: MastersService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.dialogRef.updateSize('960px');
    this.initialize();
  }

  async initialize() {

    this.getUser();
    this.role = localStorage.getItem('role-name');

    if (this.userService.getUserPermissions('user', 'read')) {
      await this.getUsers();
    }

    this.claimService.getClaimPhases().subscribe((claimPhases) => {
      this.phases = claimPhases;
    });
    this.claimService.getOriginTypes().subscribe((t) => {
      this.originTypes = t;
    });
    this.claimService.getRecoveryModes().subscribe((m) => {
      this.recoveryModes = m;
    });
    this.states = this.stateService.getStatesList();

    if (this.data) {
      this.action = this.data.type;
      await this.getCoverageTypes();
      await this.getPolicyTypes();
    }

    if (
      this.action == 'view' ||
      this.action == 'delete' ||
      this.action == 'edit'
    ) {
      this.claim = this.data?.claim;
      this.claim_id = this.claim.id;
      this.client_id = this.data?.claim?.client_id;

      this.getClaim();
    }

    if (this.action == 'add') {
      if (this.data?.client?.id) {
        this.client_id = this.data?.client?.id;
      } else {
        this.showClients = true;
        this.claimForm.get('client').setValidators([Validators.required]);
        this.claimForm.get('client').updateValueAndValidity();
        await this.getClients();
        this.claimForm
          .get('client')
          .setValidators([Validators.required]);
      }
    }
    this.spinner.hide();
  }

  ngOnInit(): void {
    this.valueChanges();
  }

  private valueChanges() {
    this.claimForm.get('client').valueChanges.subscribe((value) => {
      this.client_id = value;
    });







    // this.filteredAdjustedByAgents =
    //   this.adjustedByControl.valueChanges.pipe(
    //     startWith(''),
    //     map((value) => { 
    //       if (value == '') {
    //         this.claimForm.controls['adjustedBy'].setValue(null);
    //       }
    //       return this._filterAgents(value);
    //     })
    //   );

    // this.filteredAssignedtoAgents =
    //   this.assignedToControl.valueChanges.pipe(
    //     startWith(''),
    //     map((value) => { 
    //       if (value == '') {
    //         this.claimForm.controls['assignedTo'].setValue(null);
    //       }
    //       return this._filterAgents(value);
    //     })
    //   );
  }

  // Handle input in the sourceBy field
  onSourceByInput(event: any): void {
    const inputValue = event.target.value;
    this.filteredAgents = this._filterAgents2(inputValue);
    this.showSourceDropdown = true;
    
    // Handle browser autocomplete
    const selectedAgent = this.agents.find(agent => 
      `${agent.first_name} ${agent.last_name}` === inputValue
    );
    if (selectedAgent) {
      this.selectAgent(selectedAgent);
    }
  }

  onSginedByInput(event: any): void {
    const inputValue = event.target.value;
    this.filteredSignedByAgents = this._filterAgents2(inputValue);
    this.showSignedByDropdown = true;
    
    // Handle browser autocomplete
    const selectedAgent = this.agents.find(agent => 
      `${agent.first_name} ${agent.last_name}` === inputValue
    );
    if (selectedAgent) {
      this.selectSignedBy(selectedAgent);
    }
  }

  onAdjustedByInput(event: any): void {
    const inputValue = event.target.value;
    this.filteredAdjustedByAgents = this._filterAgents2(inputValue);
    this.showAdjustedByDropdown = true;
    
    // Handle browser autocomplete
    const selectedAgent = this.agents.find(agent => 
      `${agent.first_name} ${agent.last_name}` === inputValue
    );
    if (selectedAgent) {
      this.selectAdjustedBy(selectedAgent);
    }
  }

  onAssignedToInput(event: any): void {
    const inputValue = event.target.value;
    this.filteredAssignedtoAgents = this._filterAgents2(inputValue);
    this.showAssignedToDropdown = true;
    
    // Handle browser autocomplete
    const selectedAgent = this.agents.find(agent => 
      `${agent.first_name} ${agent.last_name}` === inputValue
    );
    if (selectedAgent) {
      this.selectAssignedTo(selectedAgent);
    }
  }

  // Add autocomplete event handlers
  onSourceByAutocomplete(event: any): void {
    const inputValue = event.target.value;
    const selectedAgent = this.agents.find(agent => 
      `${agent.first_name} ${agent.last_name}` === inputValue
    );
    if (selectedAgent) {
      this.selectAgent(selectedAgent);
    }
  }

  onSignedByAutocomplete(event: any): void {
    const inputValue = event.target.value;
    const selectedAgent = this.agents.find(agent => 
      `${agent.first_name} ${agent.last_name}` === inputValue
    );
    if (selectedAgent) {
      this.selectSignedBy(selectedAgent);
    }
  }

  onAdjustedByAutocomplete(event: any): void {
    const inputValue = event.target.value;
    const selectedAgent = this.agents.find(agent => 
      `${agent.first_name} ${agent.last_name}` === inputValue
    );
    if (selectedAgent) {
      this.selectAdjustedBy(selectedAgent);
    }
  }

  onAssignedToAutocomplete(event: any): void {
    const inputValue = event.target.value;
    const selectedAgent = this.agents.find(agent => 
      `${agent.first_name} ${agent.last_name}` === inputValue
    );
    if (selectedAgent) {
      this.selectAssignedTo(selectedAgent);
    }
  }

  // Hide the dropdown when the input loses focus
  onSourceByBlur(): void {
    setTimeout(() => {
      this.showSourceDropdown = false;
    }, 200);
  }

  onSignedByBlur(): void {
    setTimeout(() => {
      this.showSignedByDropdown = false;
    }, 200);
  }

  onAdjustedByBlur(): void {
    setTimeout(() => {
      this.showAdjustedByDropdown = false;
    }, 200);
  }

  onAssignedToBlur(): void {
    setTimeout(() => {
      this.showAssignedToDropdown = false;
    }, 200);
  }

  // Filter agents based on input value
  private _filterAgents2(value: string): any[] {
    if (!value) return [];
    const filterValue = value.toLowerCase();
    return this.agents.filter(
      (agent) =>
        agent.first_name.toLowerCase().includes(filterValue) ||
        agent.last_name.toLowerCase().includes(filterValue)
    );
  }

  // Select an agent from the dropdown
  selectAgent(agent: any): void {
    if (!agent) {
      console.log('No agent provided');
      return;
    }
    try {
      this.sourceByControl.setValue(`${agent.first_name} ${agent.last_name}`);
      this.claimForm.get('source')?.setValue(agent.id);
      this.showSourceDropdown = false;
    } catch (error) {
      console.error('Error selecting agent:', error);
    }
  }

  // Select an agent from the dropdown
  selectSignedBy(agent: any): void {
    if (!agent) {
      console.log('No agent provided');
      return;
    }
    try {
      this.signedByControl.setValue(`${agent.first_name} ${agent.last_name}`);
      this.claimForm.get('signedBy')?.setValue(agent.id);
      this.showSignedByDropdown = false;
    } catch (error) {
      console.error('Error selecting signed by agent:', error);
    }
  }

  // Select an agent from the dropdown
  selectAdjustedBy(agent: any): void {
    if (!agent) {
      console.log('No agent provided');
      return;
    }
    try {
      this.adjustedByControl.setValue(`${agent.first_name} ${agent.last_name}`);
      this.claimForm.get('adjustedBy')?.setValue(agent.id);
      this.showAdjustedByDropdown = false;
    } catch (error) {
      console.error('Error selecting adjusted by agent:', error);
    }
  }

  // Select an agent from the dropdown
  selectAssignedTo(agent: any): void {
    if (!agent) {
      console.log('No agent provided');
      return;
    }
    try {
      this.assignedToControl.setValue(`${agent.first_name} ${agent.last_name}`);
      this.claimForm.get('assignedTo')?.setValue(agent.id);
      this.showAssignedToDropdown = false;
      console.log('Assigned to agent selected successfully:', agent);
    } catch (error) {
      console.error('Error selecting assigned to agent:', error);
    }
  }

  get coverages(): FormArray {
    return this.claimForm.get('coverages') as FormArray;
  }

  addCoverage(coverageData?: any) {
    const coverageFormGroup = new FormGroup({
      coverage_type: new FormControl(coverageData?.coverage_type || '', Validators.required),
      policy_limit: new FormControl(coverageData?.policy_limit || '', [Validators.required, Validators.min(0)])
    });

    this.coverages.push(coverageFormGroup);
  }

  removeCoverage(index: number) {
    this.coverages.removeAt(index);
  }


  getPolicyTypes(): Promise<void> {
    this.spinner.show();
    return new Promise((resolve, reject) => {
      this.mastersService.getPolicyTypes().subscribe((policyTypes) => {
        this.policyTypes = policyTypes;
        this.spinner.hide();
        resolve();
      },
        (error) => reject(error)
      );
    });
  }

  getSubPolicyTypes(slug: any): Promise<void> {
    this.spinner.show();
    this.claimForm.get('subPolicyType').setValue(null);

    let policy = this.policyTypes.find((policy) => policy.slug === slug);
    let policy_type_slug = policy?.slug;

    if (!policy?.sub_policy_types) {
      this.claimForm.get('subPolicyType').disable();
      this.spinner.hide();
      return;
    }

    return new Promise((resolve, reject) => {
      this.mastersService.getSubPolicyTypes(policy_type_slug).subscribe((subPolicyTypes) => {
        this.claimForm.get('subPolicyType').enable();
        this.subPolicyTypes = subPolicyTypes;
        this.spinner.hide();
        resolve();
      },
        (error) => {
          this.claimForm.get('subPolicyType').disable();
          reject(error);
        }
      );
    });
  }

  getCoverageTypes(): Promise<void> {
    this.spinner.show();
    return new Promise((resolve, reject) => {
      this.mastersService.getCoverageTypes().subscribe((coverageTypes) => {
        this.coverageTypes = coverageTypes;
        resolve();
      },
        (error) => reject(error)
      );
    });
  }

  getUser() {
    this.spinner.show();
    this.userService.currentUser.subscribe((user) => {
      if (user) {
        this.user = user;
      }
    });
  }

  getClients(): Promise<void> {
    this.spinner.show();
    return new Promise((resolve, reject) => {
      this.clientService.getClients(1, 10000).subscribe(
        (clients) => {
          this.clients = clients.items;
          resolve();
        },
        (error) => reject(error)
      );
    });
  }

  getUsers(): Promise<void> {
    this.spinner.show();
    return new Promise((resolve, reject) => {
      this.userService.getUsers(1, 500).subscribe(
        (agents) => {
          this.agents = agents.items;
          resolve();
        },
        (error) => reject(error)
      );
    });
  }

  saveClaim() {
    this.spinner.show();

    if (this.claimForm.valid && this.client_id) {
      this.claimFormDisabled = true;
      let claimData = new Claim();

      if (this.claimForm.controls['lossDate']?.value != '') {
        // Format the date to ISO string with timezone
        const date = new Date(this.claimForm.controls['lossDate']?.value);
        claimData.loss_date = date.toISOString();
      }

      if (this.claimForm.controls['peril']?.value != '') {
        claimData.peril = this.claimForm.controls['peril'].value;
      }

      if (this.claimForm.controls['insuranceCompany']?.value != '') {
        claimData.insurance_company =
          this.claimForm.controls['insuranceCompany'].value;
      }

      if (this.claimForm.controls['policyNumber']?.value != '') {
        claimData.policy_number =
          this.claimForm.controls['policyNumber'].value;
      }

      if (this.claimForm.controls['claimNumber']?.value != '') {
        claimData.claim_number =
          this.claimForm.controls['claimNumber'].value;
      }

      if (this.claimForm.controls['source'].value != '') {
        claimData.source = this.claimForm.controls['source'].value;
      }

      if (this.claimForm.controls['sourceInfo'].value != '') {
        claimData.source_info =
          this.claimForm.controls['sourceInfo'].value;
      }

      if (this.claimForm.controls['currentPhase'].value != '') {
        claimData.current_phase =
          this.claimForm.controls['currentPhase'].value;
      }

      if (this.claimForm.controls['instructionsOrNotes'].value != '') {
        claimData.instructions_or_notes =
          this.claimForm.controls['instructionsOrNotes'].value;
      }

      claimData.assigned_to =
        this.claimForm.controls['assignedTo'].value || this.user.id;
      claimData.client_id = this.client_id;
      claimData.can_be_removed = true;

      claimData.claim_contact = {
        address_loss: this.claimForm.controls['addressLoss'].value,
        city_loss: this.claimForm.controls['cityLoss'].value,
        state_loss: this.claimForm.controls['stateLoss'].value,
        zip_code_loss: this.claimForm.controls['zipCodeLoss'].value,
      };

      if (this.claimForm.controls['signedBy'].value != '') {
        claimData.signed_by = this.claimForm.controls['signedBy'].value;
      }

      if (this.claimForm.controls['adjustedBy'].value != '') {
        claimData.adjusted_by =
          this.claimForm.controls['adjustedBy'].value;
      }

      if (this.claimForm.controls['anticipated_amount'].value != '') {
        claimData.anticipated_amount =
          this.claimForm.controls['anticipated_amount'].value;
      }

      if (this.claimForm.controls['feeType'].value != '') {
        claimData.fee_type = this.claimForm.controls['feeType'].value;
        claimData.fee = this.claimForm.controls['fee'].value;
      }

      if (this.claimForm.controls['policyType'].value != '') {
        claimData.policy_type =
          this.claimForm.controls['policyType'].value;
      }

      if (this.claimForm.controls['subPolicyType'].enable && this.claimForm.controls['subPolicyType'].value != '') {
        claimData.sub_policy_type =
          this.claimForm.controls['subPolicyType'].value;
      }

      claimData.coverages = this.claimForm.controls["coverages"].value;

      if (this.claimForm.controls['lawsuitDeadline'].value != '') {
        claimData.lawsuit_deadline = this.datepipe.transform(
          this.claimForm.controls['lawsuitDeadline'].value,
          'yyyy-MM-dd'
        );
      }

      if (this.claimForm.controls['contractSignDate'].value != '') {
        claimData.contract_sign_date = this.datepipe.transform(
          this.claimForm.controls['contractSignDate'].value,
          'yyyy-MM-dd'
        );
      }

      if (this.claimForm.controls['mortgageCompany'].value != '') {
        claimData.mortgage_company =
          this.claimForm.controls['mortgageCompany'].value;
      }

      if (this.claimForm.controls['dateLodged']?.value != '') {
        claimData.date_logged = this.datepipe.transform(
          this.claimForm.controls['dateLodged'].value,
          'yyyy-MM-dd'
        );
      }

      if (this.claimForm.controls['femaClaim']?.value != '') {
        claimData.fema_claim =
          this.claimForm.controls['femaClaim'].value;
      }

      if (this.claimForm.controls['stateOfEmergency']?.value != '') {
        claimData.state_of_emergency =
          this.claimForm.controls['stateOfEmergency'].value;
      }

      if (this.claimForm.controls['inhabitable']?.value != '') {
        claimData.inhabitable =
          this.claimForm.controls['inhabitable'].value;
      }

      if (this.claimForm.controls['inhabitable']?.value != '') {
        claimData.inhabitable =
          this.claimForm.controls['inhabitable'].value;
      }

      if (this.claimForm.controls['originType']?.value != '') {
        claimData.origin_type = this.claimForm.controls['originType'].value;
      }

      if (this.claimForm.controls['dateAciEntered']?.value != '') {
        claimData.date_aci_entered = this.datepipe.transform(
          this.claimForm.controls['dateAciEntered'].value,
          'yyyy-MM-dd'
        );
      }

      if (this.claimForm.controls['priorCarrierPayments']?.value != '') {
        claimData.prior_carrier_payments =
          Number(this.claimForm.controls['priorCarrierPayments'].value);
      }

      if (this.claimForm.controls['recoveryMode']?.value != '') {
        claimData.recovery_mode = this.claimForm.controls['recoveryMode'].value;
      }

      if (this.claim_id) {
        claimData.id = this.claim_id;
        this.claimService.updateClaim(claimData).subscribe(
          (data) => {
            this.claimFormDisabled = false;
            this.dialogRef.close();
            this.spinner.hide();
            this.snackBar
              .open('Claim has been updated', 'Close', {
                duration: 2000,
                horizontalPosition: 'end',
                verticalPosition: 'bottom',
              })
              .afterDismissed()
              .subscribe(() => { });
          },
          (error) => {
            this.spinner.hide();
            this.claimFormDisabled = false;
          }
        );
      } else {
        this.claimService.addClaim(claimData).subscribe(
          (data: any) => {
            this.claims = data;
            this.dialogRef.close({ created: true, claim: data });
            this.spinner.hide();
            this.snackBar
              .open('Claim has been created', 'Close', {
                duration: 2000,
                horizontalPosition: 'end',
                verticalPosition: 'bottom',
              })
              .afterDismissed()
              .subscribe(() => { });
          },
          (error) => {
            this.spinner.hide();
            this.claimFormDisabled = false;
          }
        );
      }
    } else {
      this.spinner.hide();

      const invalidControls = this.getInvalidControls(this.claimForm);
      this.snackBar.open(
        `Please complete all required fields. ${invalidControls.join(', ')}`,
        'Close',
        {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
          panelClass: ['snackbar-error'],
        }
      );

    }
  }

  getClaim() {
    this.spinner.show();
    this.claimService.getClaim(this.claim_id).subscribe((claim) => {
      if (claim !== undefined) {
        this.claim = claim;
        console.log(claim?.loss_date);
        this.claimForm.controls['lossDate'].patchValue(
          this.datepipe.transform(
            claim?.loss_date,
            'yyyy-MM-dd'
          )
        );
        this.claimForm.controls['peril'].patchValue(claim?.peril);
        this.claimForm.controls['insuranceCompany'].patchValue(
          claim?.insurance_company
        );
        this.claimForm.controls['policyNumber'].patchValue(
          claim?.policy_number
        );
        this.claimForm.controls['mortgageCompany'].patchValue(
          claim?.mortgage_company
        );
        this.claimForm.controls['claimNumber'].patchValue(
          claim?.claim_number
        );
        this.claimForm.controls['currentPhase'].patchValue(
          claim?.current_phase
        );
        this.claimForm.controls['source'].patchValue(claim?.source);
        this.claimForm.controls['sourceInfo'].patchValue(
          claim?.source_info
        );
        this.claimForm.controls['instructionsOrNotes'].patchValue(
          claim?.instructions_or_notes
        );
        this.claimForm.controls['assignedTo'].patchValue(
          claim?.assigned_to
        );
        this.claimForm.controls['addressLoss'].patchValue(
          claim?.claim_contact?.address_loss
        );
        this.claimForm.controls['cityLoss'].patchValue(
          claim?.claim_contact?.city_loss
        );
        this.claimForm.controls['stateLoss'].patchValue(
          claim?.claim_contact?.state_loss
        );
        this.claimForm.controls['zipCodeLoss'].patchValue(
          claim?.claim_contact?.zip_code_loss
        );
        this.claimForm.controls['adjustedBy'].patchValue(
          claim?.adjusted_by
        );
        this.claimForm.controls['signedBy'].patchValue(
          claim?.signed_by
        );
        this.claimForm.controls['client'].patchValue(claim?.client_id);
        this.claimForm.controls['anticipated_amount'].patchValue(
          claim?.anticipated_amount
        );
        this.claimForm.controls['feeType'].patchValue(claim?.fee_type);
        this.claimForm.controls['policyType'].patchValue(
          claim?.policy_type
        );
        this.getSubPolicyTypes(claim?.policy_type);
        this.claimForm.controls['subPolicyType'].patchValue(
          claim?.sub_policy_type
        );

        claim.coverages.forEach((coverage: any) => {
          this.addCoverage(coverage);
        });

        this.claimForm.controls['dateLodged'].patchValue(
          claim?.date_logged
        );
        this.claimForm.controls['fee'].patchValue(claim?.fee);
        this.claimForm.controls['lawsuitDeadline'].patchValue(
          this.datepipe.transform(
            claim?.lawsuit_deadline,
            'yyyy-MM-dd'
          )
        );
        this.claimForm.controls['contractSignDate'].patchValue(
          this.datepipe.transform(
            claim?.contract_sign_date,
            'yyyy-MM-dd'
          )
        );
        this.claimForm.controls['femaClaim'].patchValue(
          claim?.fema_claim
        );
        this.claimForm.controls['stateOfEmergency'].patchValue(
          claim?.state_of_emergency
        );
        this.claimForm.controls['inhabitable'].patchValue(
          claim?.inhabitable
        );
        this.claimForm.controls['originType'].patchValue(
          claim?.origin_type
        );
        this.claimForm.controls['dateAciEntered'].patchValue(
          claim?.date_aci_entered
        );
        this.claimForm.controls['priorCarrierPayments'].patchValue(
          claim?.prior_carrier_payments != null ? String(claim.prior_carrier_payments) : ''
        );
        this.claimForm.controls['recoveryMode'].patchValue(
          claim?.recovery_mode
        );

        this.selectAgent(
          this.agents.find((agent) => agent.id === claim?.source)
        );
        this.selectSignedBy(
          this.agents.find((agent) => agent.id === claim?.signed_by)
        );
        this.selectAdjustedBy(
          this.agents.find((agent) => agent.id === claim?.adjusted_by)
        );
        this.selectAssignedTo(
          this.agents.find((agent) => agent.id === claim?.assigned_to)
        );


        this.claimForm.markAllAsTouched();
      }
      this.spinner.hide();
    });
  }

  deleteClaim() {
    this.claimFormDisabled = true;

    this.claimService.deleteClaim(this.claim_id).subscribe(
      (result: any) => {
        this.claimFormDisabled = false;
        this.dialogRef.close(true);
        this.snackBar.open('Claim has been deleted', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      },
      (error) => {
        this.snackBar.open('Claim delete failed', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      }
    );
  }

  uuidValidator(control: FormControl) {
    const uuidPattern =
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
    if (!control.value?.id || !uuidPattern.test(control.value.id)) {
      return { invalidUuid: true };
    }
    return null;
  }

   getInvalidControls(form: FormGroup): string[] {
    const invalid = [];
    const controls = form.controls;
    for (const name in controls) {
      if (controls[name].invalid) {
        const label = this.controlLabels[name] || name;
        invalid.push(label);
      }
    }
    return invalid;
  }

  // ── Client search ──

  onClientSearchInput(event: any): void {
    const term = (event.target.value || '').toLowerCase();
    this.clientSearchTerm = event.target.value || '';
    this.filteredClientList = term
      ? (this.clients || []).filter(c => c.full_name?.toLowerCase().includes(term))
      : (this.clients || []);
    this.showClientDropdown = true;
  }

  onClientSearchFocus(): void {
    this.filteredClientList = this.clients || [];
    this.showClientDropdown = true;
  }

  onClientSearchBlur(): void {
    setTimeout(() => { this.showClientDropdown = false; }, 200);
  }

  selectClient(client: Client): void {
    this.client_id = client.id;
    this.clientSearchTerm = client.full_name || '';
    this.claimForm.get('client').setValue(client.id);
    this.showClientDropdown = false;
  }

  // ── Inline client creation ──

  toggleNewClientForm(): void {
    this.showNewClientForm = !this.showNewClientForm;
  }

  createClient(): void {
    if (this.newClientForm.invalid) {
      this.newClientForm.markAllAsTouched();
      return;
    }
    const val = this.newClientForm.value;
    if (!this.user?.id) {
      this.snackBar.open('User session not loaded. Please try again.', 'Close', { duration: 5000 });
      return;
    }

    this.creatingClient = true;
    const clientData: any = {
      full_name: val.full_name,
      belongs_to: this.user.id,
    };
    if (val.phone_number) clientData.phone_number = val.phone_number;
    if (val.email) clientData.email = val.email;
    if (val.address) clientData.address = val.address;
    if (val.city) clientData.city = val.city;
    if (val.state) clientData.state = val.state;
    if (val.zip_code) clientData.zip_code = val.zip_code;

    this.clientService.addClient(clientData).subscribe({
      next: (created: any) => {
        this.clients = this.clients || [];
        this.clients.push(created);
        this.selectClient(created);
        this.showNewClientForm = false;
        this.creatingClient = false;
        this.newClientForm.reset();
        this.snackBar.open('Client created and selected', 'Close', { duration: 3000 });
      },
      error: (err) => {
        this.creatingClient = false;
        const detail = err?.error?.detail || err?.error?.message || 'Unknown error';
        this.snackBar.open('Failed to create client: ' + detail, 'Close', { duration: 5000 });
      },
    });
  }
}
