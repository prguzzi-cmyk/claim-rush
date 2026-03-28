import { DatePipe } from "@angular/common";
import { Component, OnInit, ViewChild, inject } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTableDataSource } from "@angular/material/table";
import { ActivatedRoute, Router } from "@angular/router";
import { NgxSpinnerService } from "ngx-spinner";
import { Claim } from "src/app/models/claim.model";
import { Client } from "src/app/models/client.model";
import { Lead } from "src/app/models/lead.model";
import { ClaimService } from "src/app/services/claim.service";
import { ClientService } from "src/app/services/client.service";
import { DialogService } from "src/app/services/dialog.service";
import { LeadService } from "src/app/services/leads.service";
import { UserService } from "src/app/services/user.service";
import { UsStatesService } from 'src/app/services/us-states.service';
import { User } from "src/app/models/user.model";
import { ExcelService } from "src/app/services/excel.service";
import { delay } from "rxjs/operators";
import { LeadComment } from "src/app/models/comment-lead.model";
import { ClientComment } from "src/app/models/comment-client.model";
import { ClaimComment } from "src/app/models/comment-claim.model";
import { ClientFile } from "src/app/models/files-client.model";
import { LeadCommentsDialogComponent } from "../../dialogs/lead-comments-dialog/lead-comments-dialog.component";
import { ClientCommentsDialogComponent } from "../../dialogs/client-comments-dialog/client-comments-dialog.component";
import { ClaimCommentsDialogComponent } from "../../dialogs/claim-comments-dialog/claim-comments-dialog.component";
import { ClaimTasksDialogComponent } from "../../dialogs/claim-tasks-dialog/claim-tasks-dialog.component";
import { ClientTasksDialogComponent } from "../../dialogs/client-tasks-dialog/client-tasks-dialog.component";
import { LeadTasksDialogComponent } from "../../dialogs/lead-tasks-dialog/lead-tasks-dialog.component";
import { TabService } from '../../../services/tab.service';
import { Observable } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { uuidValidator } from "src/app/validators/uuidValidator";

@Component({
    selector: 'app-advanced-search',
    templateUrl: './advanced-search.component.html',
    styleUrls: ['./advanced-search.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class AdvancedSearchComponent implements OnInit {

  sources: string[] = ['self', 'company', 'other'];
  periods: string[] = ["current-year", "current-week", "last-month", "last-week", "last-180-days", "last-90-days", "last-30-days", "last-7-days", "all-time", "custom-range"];
  statuses: string[] = ["callback", "not-interested", "signed", "transfer", "not-qualified", "interested", "pending-sign", 'signed-approved'];
  priorities: string[] = ["low", "medium", "high"];
  taskTypes: string[] = ["phone-call", "email", "meeting", "reminder", "follow-up", "other"];
  taskStatuses: string[] = ["to-do", "in-progress", "on-hold", "done"];
  phases: any;
  module: any;

  agent: User;
  user: User;
  agents: any[];
  states: any[] = [];
  stateService: any = inject(UsStatesService);
  role: string;

  public clientForm = new FormGroup({
    period: new FormControl(this.periods[8]),
    fullName: new FormControl(''),
    startDate: new FormControl(''),
    endDate: new FormControl(''),
    email: new FormControl(''),
    phoneNumber: new FormControl(''),
    address: new FormControl(''),
    city: new FormControl(''),
    state: new FormControl(''),
    zipCode: new FormControl(''),
    belongsTo: new FormControl(''),
    refString: new FormControl(''),
    text: new FormControl(''),
    client: new FormControl(''),
    fileName: new FormControl(''),
    description: new FormControl(''),
    title: new FormControl(''),
    dueDate: new FormControl(''),
    priority: new FormControl(''),
    taskType: new FormControl(''),
    status: new FormControl(''),
    taskStartDate: new FormControl(''),
    completionDate: new FormControl(''),
    assignedTo: new FormControl(''),
  });

  public claimForm = new FormGroup({
    client: new FormControl(''),
    period: new FormControl(this.periods[8]),
    lossDate: new FormControl(''),
    startDate: new FormControl(''),
    endDate: new FormControl(''),
    currentPhase: new FormControl(''),
    source: new FormControl(''),
    signed_by: new FormControl(''),
    adjusted_by	: new FormControl(''),
    assignedTo: new FormControl(''),
    city: new FormControl(''),
    state: new FormControl(''),
    zipCodeStart: new FormControl('', Validators.pattern('\\d{5}')),
    zipCodeEnd: new FormControl('', Validators.pattern('\\d{5}')),
    refString: new FormControl(''),
    text: new FormControl(''),
    fileName: new FormControl(''),
    description: new FormControl(''),
    title: new FormControl(''),
    dueDate: new FormControl(''),
    priority: new FormControl(''),
    taskType: new FormControl(''),
    status: new FormControl(''),
    taskStartDate: new FormControl(''),
    completionDate: new FormControl(''),
  });

  public leadForm = new FormGroup({
    client: new FormControl(''),
    period: new FormControl(this.periods[8]),
    lossDate: new FormControl(''),
    startDate: new FormControl(''),
    endDate: new FormControl(''),
    status: new FormControl(''),
    source: new FormControl(''),
    assignedTo: new FormControl(''),
    city: new FormControl(''),
    state: new FormControl(''),
    peril: new FormControl(''),
    insuranceCompany: new FormControl(''),
    policyNumber: new FormControl(''),
    claimNumber: new FormControl(''),
    refString: new FormControl(''),
    text: new FormControl(''),
    fileName: new FormControl(''),
    description: new FormControl(''),
    title: new FormControl(''),
    dueDate: new FormControl(''),
    priority: new FormControl(''),
    taskType: new FormControl(''),
    taskStartDate: new FormControl(''),
    completionDate: new FormControl(''),
  });

  clients: any = [];
  clientsComments: any = [];
  claims: any = [];
  claimsComments: any = [];
  leads: any = [];
  leadsComments: any = [];
  files: any = [];
  tasks: any = [];

  displayedColumnsClients: string[] = [
    "sn",
    "ref_string",
    "full_name",
    "email",
    "created_at",
    "created_by",
  ];

  displayedColumnsComments: string[] = ["sn", "description"];

  displayedColumnsClientsComments: string[] = [
    "sn",
    "ref_string",
    "full_name",
    "email",
    "created_at",
    "created_by",
  ];

  displayedColumnsClaims: string[] = [
    "sn",
    "ref_string",
    "name",
    "claim_number",
    "policy_number",
    "phase",
    "created_at",
    "created_by",
  ];

  displayedColumnsLeads: string[] = [
    "sn",
    "ref_string",
    "full_name",
    "phone_number",
    "email",
    "source",
    "status",
    "created_by",
    "created_at",
  ];

  displayedColumnsFiles: string[] = [
    "sn",
    "name",
    "description",
    "type",
    "created_at",
    "created_by",
    "download",
  ];

  displayedColumnsTasks: string[] = [
    "sn",
    "title",
    "task_type",
    "status",
    "priority",
    "due_date",
    "created_at",
    "created_by",
  ];

  // Pagination
  dataSourceClients: MatTableDataSource<Client>;
  @ViewChild("paginator", { static: true }) paginatorClients: MatPaginator;

  dataSourceClientComments: MatTableDataSource<ClientComment>;
  @ViewChild("paginator", { static: true }) paginatorClientsComments: MatPaginator;

  dataSourceLeads: MatTableDataSource<Lead>;
  @ViewChild("paginatorLeads", { static: false }) paginatorLeads: MatPaginator;

  dataSourceLeadComments: MatTableDataSource<LeadComment>;
  @ViewChild("paginator", { static: false }) paginatorLeadsComments: MatPaginator;

  dataSourceClaims: MatTableDataSource<Claim>;
  @ViewChild("paginatorClaims", { static: false }) paginatorClaims: MatPaginator;

  dataSourceClaimComments: MatTableDataSource<ClaimComment>;
  @ViewChild("paginatorClaimsComments", { static: false }) paginatorClaimsComments: MatPaginator;

  dataSourceFiles: MatTableDataSource<ClientFile>;
  @ViewChild("paginatorFiles", { static: false }) paginatorFiles: MatPaginator;

  dataSourceTasks: MatTableDataSource<ClientFile>;
  @ViewChild("paginatorTasks", { static: false }) paginatorTasks: MatPaginator;


  pageSizeOptions = [10, 25, 50];

  clientPaginationData: any = {
    totalRecords: 0,
    pageIndex: 1,
    pageSize: 10,
  };

  claimPaginationData: any = {
    totalRecords: 0,
    pageIndex: 1,
    pageSize: 10,
  };

  leadPaginationData: any = {
    totalRecords: 0,
    pageIndex: 1,
    pageSize: 10,
  };

  sourceControl = new FormControl();
  signedByControl = new FormControl();
  adjustedByControl = new FormControl();
  assignedToControl = new FormControl();

  filteredAgents!: Observable<any[]>;
  filteredSignedByAgents!: Observable<any[]>;
  filteredAdjustedByAgents!: Observable<any[]>;
  filteredAssignedToAgents!: Observable<any[]>;

  constructor(
    public userService: UserService,
    private clientService: ClientService,
    private leadService: LeadService,
    private claimService: ClaimService,
    private _formBuilder: FormBuilder,
    private dialogService: DialogService,
    private spinner: NgxSpinnerService,
    private snackBar: MatSnackBar,
    private router: Router,
    public datepipe: DatePipe,
    private excelService: ExcelService,
    private tabService: TabService,
  ) { }

  ngOnInit(): void {

    this.role = localStorage.getItem('role-name');

    if (this.userService.getUserPermissions('client', 'read')) {
      this.getClients();
    }

    if (this.userService.getUserPermissions('user', 'read')) {
      this.getUsers();
    }

    if (this.userService.getUserPermissions('claim', 'read')) {
      this.claimService.getClaimPhases().subscribe(claimPhases => { this.phases = claimPhases });
    }

    this.states = this.stateService.getStatesList();

    this.clientForm.get('period').valueChanges.subscribe(val => {
      if (val == 'custom-range') { // for setting validations
        this.clientForm.get('startDate').setValidators(Validators.required);
        this.clientForm.get('endDate').setValidators(Validators.required);
      } else {
        this.clientForm.get('startDate').clearValidators();
        this.clientForm.get('endDate').clearValidators();
      }
      this.clientForm.get('startDate').updateValueAndValidity();
      this.clientForm.get('endDate').updateValueAndValidity();
    });

    this.leadForm.get('period').valueChanges.subscribe(val => {
      if (val == 'custom-range') { // for setting validations
        this.leadForm.get('startDate').setValidators(Validators.required);
        this.leadForm.get('endDate').setValidators(Validators.required);
      } else {
        this.leadForm.get('startDate').clearValidators();
        this.leadForm.get('endDate').clearValidators();
      }
      this.leadForm.get('startDate').updateValueAndValidity();
      this.leadForm.get('endDate').updateValueAndValidity();
    });

    this.claimForm.get('period').valueChanges.subscribe(val => {
      if (val == 'custom-range') { // for setting validations
        this.claimForm.get('startDate').setValidators(Validators.required);
        this.claimForm.get('endDate').setValidators(Validators.required);
      } else {
        this.claimForm.get('startDate').clearValidators();
        this.leadForm.get('endDate').clearValidators();
      }
      this.claimForm.get('startDate').updateValueAndValidity();
      this.claimForm.get('endDate').updateValueAndValidity();
    });

    this.filteredAgents = this.sourceControl.valueChanges.pipe(
      startWith(''),
      map(value => { 
        if (value == '') {
          this.claimForm.controls['source'].setValue(null);
        }
        return this._filterAgents(value);
      })
    );

    this.filteredSignedByAgents = this.signedByControl.valueChanges.pipe(
      startWith(''),
      map(value => { 
        if (value == '') {
          this.claimForm.controls['signed_by'].setValue(null);
        }
        return this._filterAgents(value);
      })
    );

    this.filteredAdjustedByAgents = this.adjustedByControl.valueChanges.pipe(
      startWith(''),
      map(value => { 
        if (value == '') {
          this.claimForm.controls['adjusted_by'].setValue(null);
        }
        return this._filterAgents(value);
      })
    );

    this.filteredAssignedToAgents = this.assignedToControl.valueChanges.pipe(
      startWith(''),
      map(value => { 
        if (value == '') {
          this.claimForm.controls['assignedTo'].setValue(null);
        }
        return this._filterAgents(value);
      })
    );
  }

  private _filterAgents(value: string): any[] {
    const filterValue = (typeof value === 'string') ? value.toLowerCase() : '';

    // If the input is empty, return an empty array to avoid displaying all agents.
    if (!filterValue) {
      return [];
    }

    return this.agents.filter(agent => 
      agent.first_name.toLowerCase().startsWith(filterValue) || agent.first_name.startsWith(filterValue) || 
      agent.last_name.toLowerCase().startsWith(filterValue)
    );
  }

  displayAgent(agent: any): string {
    return agent ? `${agent.first_name} ${agent.last_name}` : '';
  }

  onLeadAssignedSelected(event: any) {
    const selectedAgent = event.option.value;
    this.leadForm.get('assignedTo')?.setValue(selectedAgent.id);
  }

  onLeadSourceSelected(event: any) {
    const selectedAgent = event.option.value;
    this.leadForm.get('source')?.setValue(selectedAgent.id);
  }

  onClaimSourceSelected(event: any) {
    const selectedAgent = event.option.value;
    this.claimForm.get('source')?.setValue(selectedAgent.id);
  }

  onClaimSignedSelected(event: any) {
    const selectedAgent = event.option.value;
    this.claimForm.get('signed_by').setValue(selectedAgent.id);
  }

  onClaimAdjustedSelected(event: any) {
    const selectedAgent = event.option.value;
    this.claimForm.get('adjusted_by').setValue(selectedAgent.id);
  }

  searchModule(value: string) {
    this.module = value;
    this.dataSourceClaims = null;
    this.dataSourceLeads = null;
    this.dataSourceClients = null;
    this.dataSourceLeadComments = null;
    this.dataSourceClientComments = null;
    this.dataSourceClaimComments = null;
    this.dataSourceFiles = null;
    this.dataSourceTasks = null;
  }

  search() {

    if (this.module == 'Clients' && this.clientForm.valid) {
      this.searchClients();
    }

    if (this.module == 'Leads' && this.leadForm.valid) {
      this.leadPaginationData.pageIndex = 1;
      this.searchLeads();
    }

    if (this.module == 'Claims' && this.claimForm.valid) {

      if (this.claimForm.get('zipCodeStart').value != "") {
        this.searchClaimsByZipcode();
      } else {
        this.searchClaims();
      }
    }

    if (this.module == 'Claims comments' && this.claimForm.valid) {
      this.searchClaimsComments();
    }

    if (this.module == 'Leads comments' && this.leadForm.valid) {
      this.searchLeadsComments();
    }

    if (this.module == 'Clients comments' && this.clientForm.valid) {
      this.searchClientsComments();
    }

    // Search client, claim, lead files
    if (this.module == 'Leads files' && this.leadForm.valid) {
      this.searchLeadsFiles();
    }

    if (this.module == 'Clients files' && this.clientForm.valid) {
      this.searchClientsFiles();
    }

    if (this.module == 'Claims files' && this.clientForm.valid) {
      this.searchClaimsFiles();
    }

    // Search client, claim, lead tasks

    if (this.module == 'Clients tasks' && this.clientForm.valid) {
      this.searchClientsTasks();
    }

    if (this.module == 'Claims tasks' && this.claimForm.valid) {
      this.searchClaimsTasks();
    }

    if (this.module == 'Leads tasks' && this.leadForm.valid) {
      this.searchLeadsTasks();
    }

  }

  searchClients() {
    this.spinner.show();

    let clientData = {
      full_name: this.clientForm.controls['fullName'].value,
      full_name_alt: this.clientForm.controls['fullName'].value,
      email: this.clientForm.controls['email']?.value,
      // email_alt: this.clientForm.controls['email']?.value,
      phone_number: this.clientForm.controls['phoneNumber'].value,
      // phone_numbe_alt: this.clientForm.controls['phoneNumber'].value,
      start_date: this.datepipe.transform(this.clientForm.controls['startDate'].value, 'yyyy-MM-dd'),
      end_date: this.datepipe.transform(this.clientForm.controls['endDate'].value, 'yyyy-MM-dd'),
      address: this.clientForm.controls['address'].value,
      city: this.clientForm.controls['city'].value,
      state: this.clientForm.controls['state'].value,
      zip_code: this.clientForm.controls['zipCode'].value,
      belongs_to: this.clientForm.controls['belongsTo'].value,
      ref_string: this.clientForm.controls['refString'].value.trim(),
      period_type: this.clientForm.controls['period'].value,
    };

    this.clientService.getClientsReport(this.clientPaginationData.pageIndex, this.clientPaginationData.pageSize, clientData).pipe(delay(500)).subscribe(
      (clients) => {

        this.spinner.hide();

        if (clients !== undefined) {

          this.clients = clients.items;

          // filter deleted clients
          this.dataSourceClients = new MatTableDataSource(
            clients.items.filter((row) => row.is_removed === false)
          );

          this.dataSourceClients.filterPredicate = function (
            data,
            filter: string
          ): boolean {
            return (
              data.full_name.toLowerCase().includes(filter) ||
              data.email.toLowerCase().includes(filter) ||
              data.phone_number.toLowerCase().includes(filter) ||
              data.address.toLowerCase().includes(filter) ||
              data.ref_string.toLowerCase().includes(filter)
            );
          };

          this.clientPaginationData = {
            totalRecords: clients?.total,
            pageIndex: clients?.page,
            pageSize: clients?.size,
          };


        }
      },
      (error) => {
        this.spinner.hide();
      }
    );
  }

  changePage(event: PageEvent, module: string) {

    if (module == 'client') {
      this.clientPaginationData.pageIndex = event.pageIndex + 1;
      this.clientPaginationData.pageSize = event.pageSize;

      if (this.clientPaginationData.pageIndex == 0) {
        this.clientPaginationData.pageIndex = 1;
      }
      this.searchClients();
    }

    if (module == 'claim') {
      this.claimPaginationData.pageIndex = event.pageIndex + 1;
      this.claimPaginationData.pageSize = event.pageSize;


      if (this.claimPaginationData.pageIndex == 0) {
        this.claimPaginationData.pageIndex = 1;
      }
      this.searchClaims();
    }

    if (module == 'lead') {
      this.leadPaginationData.pageIndex = event.pageIndex + 1;
      this.leadPaginationData.pageSize = event.pageSize;

      if (this.leadPaginationData.pageIndex == 0) {
        this.leadPaginationData.pageIndex = 1;
      }
      this.searchLeads();
    }

  }

  searchClientsComments() {

    if (this.userService.getUserPermissions('client_comment', 'read')) {
      this.spinner.show();

      let clientData = {
        text: this.clientForm.controls['fullName'].value,
        start_date: this.datepipe.transform(this.clientForm.controls['startDate'].value, 'yyyy-MM-dd'),
        end_date: this.datepipe.transform(this.clientForm.controls['endDate'].value, 'yyyy-MM-dd'),
        period_type: this.clientForm.controls['period'].value,
      };

      this.clientService.getClientsComments(clientData).pipe(delay(500)).subscribe(
        (clientsComments) => {

          this.spinner.hide();

          if (clientsComments !== undefined) {

            // filter deleted clients
            this.dataSourceClientComments = new MatTableDataSource(
              clientsComments.items.filter((row) => row.is_removed === false)
            );

            this.dataSourceClientComments.paginator = this.paginatorClients;
            this.clientsComments = clientsComments;
          }
        },
        (error) => {
          this.spinner.hide();
        }
      );
    } else {
      this.permissionDeniedMessage();
    }
  }

  searchClientsFiles() {

    if (this.userService.getUserPermissions('client_file', 'read')) {

      this.spinner.show();

      let clientData = {
        name: this.clientForm.controls['fileName'].value,
        description: this.clientForm.controls['description'].value,
        start_date: this.datepipe.transform(this.clientForm.controls['startDate'].value, 'yyyy-MM-dd'),
        end_date: this.datepipe.transform(this.clientForm.controls['endDate'].value, 'yyyy-MM-dd'),
        period_type: this.clientForm.controls['period'].value,
      };

      this.clientService.getClientsFiles(clientData).pipe(delay(500)).subscribe(
        (files) => {

          this.spinner.hide();

          if (files !== undefined) {

            this.dataSourceFiles = new MatTableDataSource(
              files.items
            );

            this.dataSourceFiles.paginator = this.paginatorFiles;
            this.files = files.items;
          }
        },
        (error) => {
          this.spinner.hide();
        }
      );
    } else {
      this.permissionDeniedMessage();
    }
  }

  searchClientsTasks() {

    if (this.userService.getUserPermissions('client_task', 'read')) {

      this.spinner.show();

      let clientData = {
        title: this.clientForm.controls['title'].value,
        description: this.clientForm.controls['description'].value,
        due_date: this.datepipe.transform(this.clientForm.controls['dueDate'].value, 'yyyy-MM-dd'),
        priority: this.clientForm.controls['priority']?.value,
        task_type: this.clientForm.controls['taskType'].value,
        status: this.clientForm.controls['status'].value,
        start_date: this.datepipe.transform(this.clientForm.controls['startDate'].value, 'yyyy-MM-dd'),
        end_date: this.datepipe.transform(this.clientForm.controls['endDate'].value, 'yyyy-MM-dd'),
        task_start_date: this.clientForm.controls['taskStartDate'].value,
        completion_date: this.clientForm.controls['completionDate'].value,
        zip_code: this.clientForm.controls['zipCode'].value,
        assignee_id: this.clientForm.controls['assignedTo'].value,
        client_id: this.clientForm.controls['client'].value.trim(),
        period_type: this.clientForm.controls['period'].value,
      };

      this.clientService.getClientsTasks(clientData).pipe(delay(500)).subscribe(
        (tasks) => {

          this.spinner.hide();

          if (tasks !== undefined) {

            // filter deleted clients
            this.dataSourceTasks = new MatTableDataSource(
              tasks.items
            );

            this.dataSourceTasks.paginator = this.paginatorTasks;
            this.tasks = tasks.items;
          }
        },
        (error) => {
          this.spinner.hide();
        }
      );
    } else {

      this.permissionDeniedMessage();

    }
  }

  searchClaimsTasks() {

    if (this.userService.getUserPermissions('claim_task', 'read')) {
      this.spinner.show();

      let taskData = {
        title: this.claimForm.controls['title'].value,
        description: this.claimForm.controls['description'].value,
        due_date: this.datepipe.transform(this.claimForm.controls['dueDate'].value, 'yyyy-MM-dd'),
        priority: this.claimForm.controls['priority']?.value,
        task_type: this.claimForm.controls['taskType'].value,
        status: this.claimForm.controls['status'].value,
        start_date: this.datepipe.transform(this.claimForm.controls['startDate'].value, 'yyyy-MM-dd'),
        end_date: this.datepipe.transform(this.claimForm.controls['endDate'].value, 'yyyy-MM-dd'),
        task_start_date: this.claimForm.controls['taskStartDate'].value,
        completion_date: this.claimForm.controls['completionDate'].value,
        assignee_id: this.claimForm.controls['assignedTo'].value,
        client_id: this.claimForm.controls['client'].value.trim(),
        period_type: this.claimForm.controls['period'].value,
      };

      this.claimService.getClaimsTasks(taskData).pipe(delay(500)).subscribe(
        (tasks) => {

          this.spinner.hide();

          if (tasks !== undefined) {

            // filter deleted clients
            this.dataSourceTasks = new MatTableDataSource(
              tasks.items
            );

            this.dataSourceTasks.paginator = this.paginatorTasks;
            this.tasks = tasks.items;
          }
        },
        (error) => {
          this.spinner.hide();
        }
      );
    } else {
      this.permissionDeniedMessage();
    }
  }

  searchLeadsTasks() {

    if (this.userService.getUserPermissions('claim_task', 'read')) {
      this.spinner.show();

      let taskData = {
        title: this.leadForm.controls['title'].value,
        description: this.leadForm.controls['description'].value,
        due_date: this.datepipe.transform(this.leadForm.controls['dueDate'].value, 'yyyy-MM-dd'),
        priority: this.leadForm.controls['priority']?.value,
        task_type: this.leadForm.controls['taskType'].value,
        status: this.leadForm.controls['status'].value,
        start_date: this.datepipe.transform(this.leadForm.controls['startDate'].value, 'yyyy-MM-dd'),
        end_date: this.datepipe.transform(this.leadForm.controls['endDate'].value, 'yyyy-MM-dd'),
        task_start_date: this.leadForm.controls['taskStartDate'].value,
        completion_date: this.leadForm.controls['completionDate'].value,
        assignee_id: this.leadForm.controls['assignedTo'].value,
        // client_id: this.leadForm.controls['client'].value.trim(),
        period_type: this.leadForm.controls['period'].value,
      };

      this.leadService.getLeadsTasks(taskData).pipe(delay(500)).subscribe(
        (tasks) => {

          this.spinner.hide();

          if (tasks !== undefined) {

            // filter deleted clients
            this.dataSourceTasks = new MatTableDataSource(
              tasks.items
            );

            this.dataSourceTasks.paginator = this.paginatorTasks;
            this.tasks = tasks.items;
          }
        },
        (error) => {
          this.spinner.hide();
        }
      );
    } else {
      this.permissionDeniedMessage();
    }
  }

  searchClaimsFiles() {

    if (this.userService.getUserPermissions('claim_file', 'read')) {
      this.spinner.show();

      let fileData = {
        name: this.claimForm.controls['fileName'].value,
        description: this.claimForm.controls['description'].value,
        start_date: this.datepipe.transform(this.claimForm.controls['startDate'].value, 'yyyy-MM-dd'),
        end_date: this.datepipe.transform(this.claimForm.controls['endDate'].value, 'yyyy-MM-dd'),
        period_type: this.claimForm.controls['period'].value,
      };

      this.claimService.getClaimsFiles(fileData).pipe(delay(500)).subscribe(
        (files) => {

          this.spinner.hide();

          if (files !== undefined) {

            this.dataSourceFiles = new MatTableDataSource(
              files.items
            );

            this.dataSourceFiles.paginator = this.paginatorFiles;
            this.files = files.items;
          }
        },
        (error) => {
          this.spinner.hide();
        }
      );
    } else {
      this.permissionDeniedMessage();
    }
  }

  searchLeadsFiles() {

    if (this.userService.getUserPermissions('lead_file', 'read')) {

      this.spinner.show();

      let fileData = {
        name: this.leadForm.controls['fileName'].value,
        description: this.leadForm.controls['description'].value,
        start_date: this.datepipe.transform(this.leadForm.controls['startDate'].value, 'yyyy-MM-dd'),
        end_date: this.datepipe.transform(this.leadForm.controls['endDate'].value, 'yyyy-MM-dd'),
        period_type: this.leadForm.controls['period'].value,
      };

      this.leadService.getLeadsFiles(fileData).pipe(delay(500)).subscribe(
        (files) => {

          this.spinner.hide();

          if (files !== undefined) {

            this.dataSourceFiles = new MatTableDataSource(
              files
            );

            this.dataSourceFiles.paginator = this.paginatorFiles;
            this.files = files.items;
          }
        },
        (error) => {
          this.spinner.hide();
        }
      );
    } else {
      this.permissionDeniedMessage();
    }
  }

  searchLeads() {

    if (this.userService.getUserPermissions('lead', 'read')) {

      this.spinner.show();

      let leadData = {
        client: this.leadForm.controls['client'].value,
        contact_city: this.leadForm.controls['city']?.value,
        contact_state: this.leadForm.controls['state'].value,
        start_date: this.datepipe.transform(this.leadForm.controls['startDate'].value, 'yyyy-MM-dd'),
        end_date: this.datepipe.transform(this.leadForm.controls['endDate'].value, 'yyyy-MM-dd'),
        source: this.leadForm.controls['source'].value,
        status: this.leadForm.controls['status'].value,
        period_type: this.leadForm.controls['period'].value,
        assigned_to: this.leadForm.controls['assignedTo'].value,
        ref_string: this.leadForm.controls['refString'].value.trim(),
      };

      this.leadService.getLeadsReport(this.leadPaginationData.pageIndex, this.leadPaginationData.pageSize, leadData).pipe(delay(500)).subscribe(
        (leads) => {
          this.spinner.hide();
          if (leads !== undefined) {

            this.leads = leads;

            // filter deleted leads
            this.dataSourceLeads = new MatTableDataSource(
              leads.items.filter((row) => row.is_removed === false)
            );

            this.dataSourceLeads.filterPredicate = function (
              data,
              filter: string
            ): boolean {
              return (
                data.contact?.full_name.toLowerCase().includes(filter) ||
                data.ref_string.toLowerCase().includes(filter)
              );
            };

            this.leadPaginationData = {
              totalRecords: leads?.total,
              pageIndex: leads?.page,
              pageSize: leads?.size,
            };

          }
        },
        (err) => {
          this.spinner.hide();
          let errorMessage = 'An error occurred while searching the leads.';
          if (err.error && err.error.detail && Array.isArray(err.error.detail)) {
            const detail = err.error.detail[0];
            if (detail.msg != '') {
              errorMessage = detail.msg;
            }
          }
          this.displayError(errorMessage);
        }
      );
    } else {
      this.permissionDeniedMessage();
    }
  }

  searchLeadsComments() {
    this.spinner.show();

    let leadData = {
      text: this.leadForm.controls['text'].value,
      start_date: this.datepipe.transform(this.leadForm.controls['startDate'].value, 'yyyy-MM-dd'),
      end_date: this.datepipe.transform(this.leadForm.controls['endDate'].value, 'yyyy-MM-dd'),
      period_type: this.leadForm.controls['period'].value,
    };

    this.leadService.getLeadsComments(leadData).pipe(delay(500)).subscribe(
      (leadsComments) => {

        this.spinner.hide();

        if (leadsComments !== undefined) {

          // filter deleted clients
          this.dataSourceLeadComments = new MatTableDataSource(
            leadsComments.filter((row) => row.is_removed === false)
          );

          this.dataSourceLeadComments.paginator = this.paginatorLeadsComments;
          this.leadsComments = leadsComments;
        }
      },
      (err) => {
        this.spinner.hide();
        console.log(err);
      }
    );
  }

  searchClaims() {
    this.spinner.show();
    let claimData = {
      client: this.claimForm.controls['client'].value,
      contact_city: this.claimForm.controls['city']?.value,
      contact_state: this.claimForm.controls['state'].value,
      start_date: this.datepipe.transform(this.claimForm.controls['startDate'].value, 'yyyy-MM-dd'),
      end_date: this.datepipe.transform(this.claimForm.controls['endDate'].value, 'yyyy-MM-dd'),
      source: this.claimForm.controls['source'].value,
      signed_by: this.claimForm.controls['signed_by'].value,
      adjusted_by: this.claimForm.controls['adjusted_by'].value,
      phase: this.claimForm.controls['currentPhase'].value,
      period_type: this.claimForm.controls['period'].value,
      assigned_to: this.claimForm.controls['assignedTo'].value,
      ref_string: this.claimForm.controls['refString'].value.trim(),
      cache_id: this.user
    };

    this.claimService.getClaimsReport(this.claimPaginationData.pageIndex, this.claimPaginationData.pageSize, claimData).subscribe(
      (claims) => {
        this.spinner.hide();
        if (claims !== undefined) {
          this.claims = claims;
          // filter deleted claims
          this.dataSourceClaims = new MatTableDataSource(
            claims.items.filter((row) => row.is_removed === false)
          );

          this.dataSourceClaims.filterPredicate = function (
            data,
            filter: string
          ): boolean {
            return (
              data.claim_number.toLowerCase().includes(filter) ||
              data.ref_string.toLowerCase().includes(filter)
            );
          };

          this.claimPaginationData = {
            totalRecords: claims?.total,
            pageIndex: claims?.page,
            pageSize: claims?.size,
          };

        }
      },
      (err) => {
        this.spinner.hide();
        let errorMessage = 'An error occurred while searching the claims.';
        if (err.error && err.error.detail && Array.isArray(err.error.detail)) {
          const detail = err.error.detail[0];
          if (detail.msg != '') {
            errorMessage = detail.msg;
          }
        }
        this.displayError(errorMessage);
      }
    );
  }

  searchClaimsByZipcode() {

    if (this.userService.getUserPermissions('claim', 'read')) {
      this.spinner.show();

      let startZip: any = this.claimForm.controls['zipCodeStart'].value;
      let endZip: any = this.claimForm.controls['zipCodeEnd'].value;
      let diff = endZip - startZip;

      if (diff > 200) {
        this.spinner.hide();
        this.snackBar.open("Error: Records filtration for more than 200 zip codes is not allowed", "Close", {
          duration: 10000,
          horizontalPosition: "end",
          verticalPosition: "bottom",
          panelClass: ["snackbar-error"],
        });
        return;
      }

      let claimData = {
        zip_code_start: this.claimForm.controls['zipCodeStart'].value,
        zip_code_end: this.claimForm.controls['zipCodeEnd']?.value,
        start_date: this.datepipe.transform(this.claimForm.controls['startDate'].value, 'yyyy-MM-dd'),
        end_date: this.datepipe.transform(this.claimForm.controls['endDate'].value, 'yyyy-MM-dd'),
        period_type: this.claimForm.controls['period'].value,
      };

      this.claimService.getClaimsReportByZipcode(claimData).subscribe(
        (claims) => {
          this.spinner.hide();
          if (claims !== undefined) {

            //remove duplicate
            claims = claims.filter(
              (newClaim) =>
                !this.claims.find(
                  (existingClaim) => newClaim.id === existingClaim.id
                )
            );

            claims.forEach((claim) => {
              this.claims.push(claim);
            });

            // filter deleted claims
            this.dataSourceClaims = new MatTableDataSource(
              this.claims.filter((row) => row.is_removed === false)
            );

            this.dataSourceClaims.paginator = this.paginatorClaims;
          }
        },
        (error) => {
          this.spinner.hide();
          console.log(error);
        }
      );
    } else {
      this.permissionDeniedMessage();
    }
  }

  searchClaimsComments() {

    if (this.userService.getUserPermissions('claim_comment', 'read')) {
      this.spinner.show();

      let claimData = {
        text: this.claimForm.controls['text'].value,
        start_date: this.datepipe.transform(this.claimForm.controls['startDate'].value, 'yyyy-MM-dd'),
        end_date: this.datepipe.transform(this.claimForm.controls['endDate'].value, 'yyyy-MM-dd'),
        period_type: this.claimForm.controls['period'].value,
      };

      this.claimService.getClaimsComments(claimData).pipe(delay(500)).subscribe(
        (claimsComments) => {

          this.spinner.hide();

          if (claimsComments !== undefined) {

            // filter deleted clients
            this.dataSourceClaimComments = new MatTableDataSource(
              claimsComments.items.filter((row) => row.is_removed === false)
            );

            this.dataSourceClaimComments.paginator = this.paginatorClaimsComments;
            this.claimsComments = claimsComments.items;
          }
        },
        (err) => {
          this.spinner.hide();
          let errorMessage = 'An error occurred while searching the claim comments.';
          if (err.error && err.error.detail && Array.isArray(err.error.detail)) {
            const detail = err.error.detail[0];
            if (detail.msg != '') {
              errorMessage = detail.msg;
            }
          }
          this.displayError(errorMessage);
        }
      );
    } else {
      this.permissionDeniedMessage();
    }
  }

  getClients() {
    if (this.userService.getUserPermissions('client', 'read')) {
      this.spinner.show();
      this.clientService.getClients(1, 1000).subscribe(
        (clients) => {
          this.spinner.hide();
          if (clients !== undefined) {
            this.clients = clients?.items;
          }
        },
        (error) => {
          this.spinner.hide();
        }
      );
    } else {
      this.permissionDeniedMessage();
    }
  }

  getUsers() {
    this.userService.getUsers(1, 500)
      .subscribe((agents) => {
        this.agents = agents?.items;
      });

  }

  getUser() {
    this.userService.currentUser.subscribe((user) => {
      if (user) {
        this.user = user;
      }
    });
  }

  downloadExcel(data: any, type: string) {
    this.excelService.exportAsExcelFile(data, type);
  }

  downloadCsv(data: any, type: string) {
    this.excelService.exportAsCsvFile(data, type);
  }

  viewClaim(claim: Claim) {
    this.router.navigate(["/app/claim/" + claim.id]);
  }

  viewClient(client: Client) {
    this.router.navigate(["/app/client/" + client.id]);
  }

  openTasksViewDialog(task: any) {
    if (this.module == 'Leads tasks') {
      this.dialogService.openDialog(LeadTasksDialogComponent, { type: 'view', leadTask: task })
        .subscribe();
    }

    if (this.module == 'Clients tasks') {
      this.dialogService.openDialog(ClientTasksDialogComponent, { type: 'view', clientTask: task })
        .subscribe();
    }

    if (this.module == 'Claims tasks') {
      this.dialogService.openDialog(ClaimTasksDialogComponent, { type: 'view', claimTask: task })
        .subscribe();
    }
  }

  openCommentViewDialog(comment: any) {

    if (this.module == 'Leads comments') {
      this.dialogService.openDialog(LeadCommentsDialogComponent, { type: 'view', leadComment: comment })
        .subscribe();
    }

    if (this.module == 'Clients comments') {
      this.dialogService.openDialog(ClientCommentsDialogComponent, { type: 'view', clientComment: comment })
        .subscribe();
    }

    if (this.module == 'Claims comments') {
      this.dialogService.openDialog(ClaimCommentsDialogComponent, { type: 'view', claimComment: comment })
        .subscribe();
    }
  }

  permissionDeniedMessage() {
    this.snackBar.open("permission denied.", "Close", {
      duration: 10000,
      horizontalPosition: "end",
      verticalPosition: "bottom",
      panelClass: ["snackbar-error"],
    });
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  onClientDetail(id: string, name: string) {
    this.tabService.addItem({id, name, type:"client"});
  }

  onClaimDetail(id: string, name: string) {
    this.tabService.addItem({id, name, type:"claim"});
  }

  onLeadDetail(id: string, name: string) {
    this.tabService.addItem({id, name, type:"lead"});
  }

  displayError(error: any) {
    this.snackBar.open("Error: " + error, "Close", {
      duration: 10000,
      horizontalPosition: "end",
      verticalPosition: "bottom",
      panelClass: ["snackbar-error"],
    });
  }

}
