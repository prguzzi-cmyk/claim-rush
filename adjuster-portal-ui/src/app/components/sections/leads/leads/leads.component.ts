import { Component, OnInit, ViewChild } from "@angular/core";
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTableDataSource } from "@angular/material/table";
import { ActivatedRoute, Router } from "@angular/router";
import { Lead } from "src/app/models/lead.model";
import { LeadService } from "src/app/services/leads.service";
import { LeadDetailsDialogComponent } from "src/app/components/dialogs/lead-details-dialog/lead-details-dialog.component";
import { DialogService } from "src/app/services/dialog.service";
import { UserService } from "src/app/services/user.service";
import { Location } from "@angular/common";
import { FormBuilder } from "@angular/forms";
import { DatePipe } from "@angular/common";
import { ImportLeadsDialogComponent } from "src/app/components/dialogs/import-leads-dialog/import-leads-dialog.component";
import { NgxSpinnerService } from "ngx-spinner";
import { MatTableExporterDirective } from "mat-table-exporter";
import { ExcelService } from "src/app/services/excel.service";
import { SelectionModel } from "@angular/cdk/collections";
import { LeadsEditDialogComponent } from "src/app/components/dialogs/leads-edit-dialog/leads-edit-dialog.component";
import { RecordResultDialogComponent } from "src/app/components/dialogs/record-result-dialog/record-result-dialog.component";
import { User } from "src/app/models/user.model";
import { TabService } from 'src/app/services/tab.service';
import { Subscription } from "rxjs";
import { MatTabGroup } from "@angular/material/tabs";
import { MatSort } from '@angular/material/sort';
import { LeadIntelligenceService } from 'src/app/shared/services/lead-intelligence.service';
import { MatDialog } from "@angular/material/dialog";

const EXCEL_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8";
const EXCEL_EXTENSION = ".xlsx";

@Component({
    selector: "app-leads-dashboard",
    templateUrl: "./leads.component.html",
    styleUrls: ["./leads.component.scss"],
    providers: [DatePipe],
    standalone: false
})
export class Leads implements OnInit {
  @ViewChild(MatTableExporterDirective, { static: true })
  exporter: MatTableExporterDirective;
  selection = new SelectionModel<Lead>(true, []);
  selectionPending = new SelectionModel<Lead>(true, []);
  @ViewChild('tabGroup') tabGroup: MatTabGroup;
  @ViewChild('sort1') sort1: MatSort;
  @ViewChild('sort2') sort2: MatSort;

  leads: Lead[] = [];
  agentId: any;
  searchField: any;

  // AI Outreach tracking (keyed by lead id)
  outreachStatusMap = new Map<string, 'pending' | 'in-progress' | 'completed'>();
  aiResultMap = new Map<string, { outcome: string; summary: string; nextAction: string }>();

  // Compliance tracking (keyed by lead id)
  consentMap = new Map<string, 'yes' | 'no' | 'unknown'>();
  dncCheckedMap = new Map<string, boolean>();
  dncStatusMap = new Map<string, 'clear' | 'listed' | 'unknown'>();

  searchFormGroup: any;
  displayedColumns: string[] = [
    "select",
    "ref_string",
    "full_name",
    "phone_number",
    "peril",
    "status",
    "assigned_agent",
    "distributed",
    "consent",
    "dnc",
    "compliance",
    "ai_outreach",
    "address_loss",
    "state_loss",
    "edit"
  ];

  statuses: string[] = [
    "callback",
    "not-interested",
    "signed",
    "signed-approved",
  ];
  searches: any[] = [
    { id: "ref_number", name: "Ref. #" },
    { id: "name", name: "Name" },
    { id: "phone", name: "Phone" },
    { id: "email", name: "Email" },
    { id: "address", name: "Address" },
    { id: "status", name: "Status" },
    { id: "created_at", name: "Creation date" },
    { id: "assigned_to", name: "Assigned to" },
  ];

  role: string;
  agents: any[];

  // Pagination
  dataSource = new MatTableDataSource<Lead>([]);
  dataSourcePending = new MatTableDataSource<Lead>([]);
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatPaginator, { static: true }) paginatorPendingLeads: MatPaginator;
  private queryParamsSubscription: Subscription;

  totalRecords = 0;
  pageSize = 10;
  pageSizeOptions = [2, 10, 25, 50, 500];
  pageIndex = 1;
  selectionLength = 0;
  selectionLengthPending = 0;
  user: User;
  showPendingLeads: boolean = false;
  leadsLoaded = false;
  queryParams: any = {};

  totalRecordsPendingLeads = 0;
  pageSizePendingLeads = 10;
  pageIndexPendingLeads = 1;

  // ── CRM Dashboard KPIs + Pipeline ──
  kpiNew = 0;
  kpiContacted = 0;
  kpiAppointments = 0;
  kpiSigned = 0;
  pipelineStages = [
    { key: 'callback', label: 'New', count: 0, color: '#3b82f6' },
    { key: 'interested', label: 'Contacted', count: 0, color: '#8b5cf6' },
    { key: 'pending-sign', label: 'Appointment', count: 0, color: '#f59e0b' },
    { key: 'signed', label: 'Signed', count: 0, color: '#10b981' },
    { key: 'not-interested', label: 'Lost', count: 0, color: '#6b7280' },
  ];
  activePipelineFilter = '';

  constructor(
    private snackBar: MatSnackBar,
    public datepipe: DatePipe,
    private leadService: LeadService,
    private dialogService: DialogService,
    private router: Router,
    public userService: UserService,
    private _formBuilder: FormBuilder,
    private location: Location,
    private excelService: ExcelService,
    private spinner: NgxSpinnerService,
    private route: ActivatedRoute,
    private tabService: TabService,
    private dialog: MatDialog,
    private leadIntelService: LeadIntelligenceService,
  ) { }

  initialized = false;

  ngOnInit(): void {
    this.searchFormGroup = this._formBuilder.group({
      search_string: null
    });

    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      this.queryParams = {
        type: params['type'] || '',
      };
      this.showPendingLeads = (this.queryParams['type'] == 'pending' ? true : false);
    });

    // If permissions are already loaded, initialize and fetch immediately
    if (this.userService.getUserPermissions('lead', 'read')) {
      this.initializeLeads();
      this.getLeads();
    }

    // Also listen for user changes (handles async permission loading)
    this.getUser();

    // Refresh when leads are created from Lead Intelligence / fire outreach
    this.leadIntelService.leadCreatedInBackend$.subscribe((backendId) => {
      console.log('[Leads] leadCreatedInBackend$ fired — refreshing (backendId=%s)', backendId);
      this.getLeads();
    });

    // Fallback: if nothing has loaded after 3s, force-initialize (dev mode)
    setTimeout(() => {
      if (!this.leadsLoaded) {
        console.warn('[Leads] Force-initializing after timeout (no data loaded yet)');
        this.initializeLeads();
        this.getLeads();
      }
    }, 3000);
  }

  private initializeLeads(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.spinner.show();
    this.role = localStorage.getItem("role-name");

    if (this.role == "super-admin" || this.role == "admin") {
      this.getUsersByRole("agent");
    } else {
      this.searches = this.searches.filter((row) => row.id !== "assigned_to");
    }
  }

  getUser() {
    this.userService.currentUser.subscribe((user) => {
      if (user) {
        this.user = user;
        this.initializeLeads();
        this.getLeads();
        this.getPendingForApprovalLeads();
      }
    });
  }

  getUsersByRole(rolename: string) {
    this.userService.getUsersByRole(rolename).subscribe((agents) => {
      this.agents = agents.items;
    });
  }

  getLeads() {
    this.spinner.show();
    const sortDirection = this.sort1?.direction || 'desc';
    const sortActive = this.sort1?.active || 'created_at';

    const apiParams: any = {
      sort_by: sortActive,
      order_by: sortDirection,
    };
    if (this.queryParams['search_field']) {
      apiParams['search_field'] = this.queryParams['search_field'];
      apiParams['search_value'] = this.queryParams['search_value'];
    }

    console.log('[Leads] getLeads() called → page=%d size=%d params=%o', this.pageIndex, this.pageSize, apiParams);

    this.leadService.getLeads(this.pageIndex, this.pageSize, apiParams).subscribe(
      (response) => {
        console.log('[Leads] raw API response:', response);

        const items: Lead[] = response?.items || [];

        console.log('Leads loaded:', items.length);
        console.log('[Leads] total=%d, items=%d', response?.total, items.length);

        // Log each item's status for diagnosis
        if (items.length > 0) {
          const statusCounts: Record<string, number> = {};
          items.forEach((item: any) => {
            const s = item.status || '(null)';
            statusCounts[s] = (statusCounts[s] || 0) + 1;
          });
          console.log('[Leads] status breakdown:', statusCounts);
          console.log('[Leads] first item sample:', JSON.stringify(items[0]).substring(0, 300));
        }

        // Bind ALL items directly — no filtering
        this.leads = items;
        this.dataSource.data = items;
        this.leadsLoaded = true;

        console.log('[Leads] dataSource.data.length after set:', this.dataSource.data.length);

        this.totalRecords = response?.total ?? items.length;
        this.pageIndex = response?.page ?? this.pageIndex;
        this.pageSize = response?.size ?? this.pageSize;
        this.computeCrmKpis(items);
        this.spinner.hide();
      },
      (error) => {
        console.error('[Leads] GET /leads FAILED:', error);
        this.leadsLoaded = true;
        this.spinner.hide();
      }
    );
  }

  getPendingForApprovalLeads() {
    this.spinner.show();
    const sortDirection = this.sort2?.direction || 'desc';
    const sortActive = this.sort2?.active || 'created_at';

    let params = {
      'sort_by' : sortActive,
      'order_by' : sortDirection,
      'search_field' : 'status',
      'search_value' : 'signed'
    }

    this.leadService.getLeads(this.pageIndexPendingLeads, this.pageSizePendingLeads, params).subscribe(
      (leads) => {
        setTimeout(() => {
          this.spinner.hide();
        }, 500);
        if (leads !== undefined) {

          this.dataSourcePending.data = leads.items.filter((row) => row.status === "signed");

          this.dataSourcePending.filterPredicate = function (
            data,
            filter: string
          ): boolean {
            return (
              data.contact.full_name?.toLowerCase().includes(filter) ||
              data.source?.toLowerCase().includes(filter) ||
              data.peril?.toLowerCase().includes(filter) ||
              data.insurance_company?.toLowerCase().includes(filter) ||
              data.policy_number?.toLowerCase().includes(filter) ||
              data.claim_number?.toLowerCase().includes(filter) ||
              data.loss_date?.toLowerCase().includes(filter) ||
              data.ref_string?.toLowerCase().includes(filter) ||
              data?.contact?.phone_number?.toLowerCase().includes(filter) ||
              data?.contact?.email?.toLowerCase().includes(filter) ||
              data?.status?.toString().includes(filter)
            );
          };

          this.totalRecordsPendingLeads = leads.total;
          this.pageIndexPendingLeads = leads.page;
          this.pageSizePendingLeads = leads.size;
          this.spinner.hide();

        }
      },
      (error) => {
        this.spinner.hide();
      }
    );
  }

  ngAfterViewInit() {
    this.selection.changed.subscribe((x) => {
      this.selectionLength = x.source.selected.length;
    });

    this.selectionPending.changed.subscribe((x) => {
      this.selectionLengthPending = x.source.selected.length;
    });
    this.tabGroup.selectedIndex = (this.showPendingLeads == true ? 1 : 0);
    this.sort1?.sortChange.subscribe(() => this.paginator.pageIndex = 0);
    this.sort1?.sortChange.subscribe(() => this.getLeads());
    this.sort2?.sortChange.subscribe(() => this.paginatorPendingLeads.pageIndex = 0);
    this.sort2?.sortChange.subscribe(() => this.getPendingForApprovalLeads());
  }

  changePage(event: PageEvent) {
    this.spinner.show();
    this.pageIndex = event.pageIndex + 1;

    if (this.pageIndex == 0) {
      this.pageIndex = 1;
    }

    this.pageSize = event.pageSize;
    if (!this.searchFormGroup.get('search_string').value) {
      this.getLeads();
    } else {
      this.search();
    }
  }

  changePagePendingLeads(event: PageEvent) {
    this.spinner.show();
    this.pageIndexPendingLeads = event.pageIndex + 1;

    if (this.pageIndexPendingLeads == 0) {
      this.pageIndexPendingLeads = 1;
    }

    this.pageSizePendingLeads = event.pageSize;
    this.getPendingForApprovalLeads();

  }

  private autoAssignIndex = 0;

  approvePendingLeads() {
    const selected = this.selectionPending.selected;
    if (!selected.length) return;

    this.spinner.show();
    let completed = 0;
    let failed = 0;

    const onDone = () => {
      completed++;
      if (completed === selected.length) {
        this.spinner.hide();
        this.selectionPending.clear();
        // Refresh both tables and counts
        this.getLeads();
        this.getPendingForApprovalLeads();

        if (failed > 0) {
          this.snackBar.open(`${completed - failed} approved, ${failed} failed.`, 'Close', {
            duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom',
            panelClass: ['snackbar-error'],
          });
        } else {
          this.snackBar.open('Leads signed and approved.', 'Close', {
            duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom',
          });
        }
      }
    };

    for (const lead of selected) {
      this.approveSingleLead(lead).then(() => onDone()).catch(() => { failed++; onDone(); });
    }
  }

  private async approveSingleLead(lead: any): Promise<void> {
    const updateFields: Record<string, any> = { status: 'signed-approved' };

    // Backend requires assigned_to for signed-approved. Auto-assign if missing.
    const hasAssignment = lead.assigned_to || lead.assigned_user;
    if (!hasAssignment && this.agents?.length) {
      const agent = this.agents[this.autoAssignIndex % this.agents.length];
      this.autoAssignIndex++;
      updateFields['assigned_to'] = agent.id;
      console.log('[Leads] Auto-assigning lead %s to agent %s (%s %s)',
        lead.id, agent.id, agent.first_name, agent.last_name);
    }

    console.log('[Leads] Approving lead %s with fields:', lead.id, updateFields);

    return new Promise<void>((resolve, reject) => {
      this.leadService.patchLead(lead.id, updateFields).subscribe({
        next: () => {
          console.log('[Leads] Lead %s approved successfully', lead.id);
          resolve();
        },
        error: (err: any) => {
          // Log full backend error for diagnosis
          console.error('[Leads] Approve lead %s FAILED:', lead.id, err);
          console.error('[Leads] Backend error body:', err?.error);
          console.error('[Leads] HTTP status:', err?.status);

          let errorMessage = 'Failed to approve lead.';
          if (err?.error?.detail) {
            errorMessage = typeof err.error.detail === 'string'
              ? err.error.detail
              : JSON.stringify(err.error.detail);
          } else if (err?.error?.message) {
            errorMessage = err.error.message;
          } else if (err?.message) {
            errorMessage = err.message;
          }

          this.snackBar.open(errorMessage, 'Close', {
            duration: 8000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
            panelClass: ['snackbar-error'],
          });
          reject(err);
        },
      });
    });
  }

  tabChange(index: number) {
    // console.log(index);
  }

  filterLeads(field: string, value: string) {
    this.searchField = field;

    if (field == "assigned_to") {
      this.searchFormGroup.controls["assignedTo"].setValue(value);
    }

    if (field == "status") {
      this.searchFormGroup.controls["status"].setValue(value);
    }

    this.agentId = value;
    this.search();
  }

  clearSearch() {
    this.searchFormGroup.controls['search_string'].setValue('');
    this.paginator.pageIndex = 0;
    this.pageIndex = 1;
    this.pageSize = 10;
    this.getLeads();
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  isAllSelectedPending() {
    const numSelected = this.selectionPending.selected.length;
    const numRows = this.dataSourcePending.data.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.dataSource.data.forEach((row) => this.selection.select(row));
  }

  masterTogglePending() {
    this.isAllSelectedPending()
      ? this.selectionPending.clear()
      : this.dataSourcePending.data.forEach((row) =>
        this.selectionPending.select(row)
      );
  }

  openMultipleEditDialog() {
    this.dialogService
      .openDialog(LeadsEditDialogComponent, {
        type: "multiple",
        selection: this.selection,
      })
      .subscribe(() => {
        this.getLeads();
        this.getPendingForApprovalLeads();
        this.selection.clear();
      });
  }

  logSelection() {
    this.selection.selected.forEach((s) => console.log(s));
  }

  downloadExcel(): void {
    const flattenedLeads = this.leads.map(lead => this.flattenLead(lead));
    this.excelService.exportAsExcelFile(flattenedLeads, "leads");
  }

  onLeadDetail(id: string, name: string) {
    this.tabService.addItem({ id, name, type: "lead" });
  }

  downloadCsv() {
    const flattenedLeads = this.leads.map(lead => this.flattenLead(lead));
    this.excelService.exportAsCsvFile(flattenedLeads, "leads");
  }

  searchChange(event: any) {
    if (this.searchFormGroup.get("search").value == "") {
      this.getLeads();
    }
  }

  searchLeads() {
    this.pageIndex = 1;
    this.pageSize = 10;
    this.search();
  }

  search() {
    this.searchFormGroup.markAllAsTouched();

    if (this.searchFormGroup.valid) {
      this.spinner.show();
      this.leadService.searchLeads(this.pageIndex, this.pageSize, this.searchFormGroup.get("search_string").value).subscribe(
        (response) => {
          this.spinner.hide();
          const items = response?.items || [];
          console.log('Leads search loaded:', items.length);

          this.leads = items;
          this.dataSource.data = items;
          this.leadsLoaded = true;

          this.totalRecords = response?.total ?? items.length;
          this.pageIndex = response?.page ?? this.pageIndex;
          this.pageSize = response?.size ?? this.pageSize;
        },
        (error) => {
          console.error('[Leads] search FAILED:', error);
          this.spinner.hide();
        }
      );
    }
  }

  import() {
    this.dialogService
      .openDialog(ImportLeadsDialogComponent, { type: "add" })
      .subscribe(() => this.getLeads());
  }

  viewLead(id: string) {
    this.router.navigate(["/app/leads/", id]);
  }

  openLeadEditDialog(lead: Lead) {
    this.dialogService
      .openDialog(LeadDetailsDialogComponent, { type: "edit", lead: lead })
      .subscribe();
  }

  openLeadAddDialog() {
    this.dialogService
      .openDialog(LeadDetailsDialogComponent, { type: "add" })
      .subscribe(() => this.getLeads());
  }

  openLeadDeleteDialog(lead: Lead) {
    this.dialogService
      .openDialog(LeadDetailsDialogComponent, { type: "delete", lead: lead })
      .subscribe(() => this.getLeads());
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  applyFilter(filterValue: string) {
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private flattenLead(lead: Lead): any {
    const flattened = {
      lead_ref_number: lead.ref_string,
      loss_date: lead.loss_date,
      peril: lead.peril,
      insurance_company: lead.insurance_company,
      policy_number: lead.policy_number,
      claim_number: lead.claim_number,
      status: lead.status,
      source_by: lead?.source_user?.first_name  + ' ' + lead?.source_user?.last_name ,
      source_info: lead.source_info,
      is_removed: lead.is_removed,
      contact_full_name: lead.contact?.full_name,
      contact_full_name_alt: lead.contact?.full_name_alt,
      contact_email: lead.contact?.email,
      contact_email_alt: lead.contact?.email_alt,
      contact_phone_number: lead.contact?.phone_number,
      contact_phone_number_alt: lead.contact?.phone_number_alt,
      contact_address: lead.contact?.address,
      contact_city: lead.contact?.city,
      contact_state: lead.contact?.state,
      contact_zip_code: lead.contact?.zip_code,
      address_loss: lead.contact?.address_loss,
      city_loss: lead.contact?.city_loss,
      state_loss: lead.contact?.state_loss,
      zip_code_loss: lead.contact?.zip_code_loss,
      assigned_to: lead.assigned_user?.first_name + ' ' + lead.assigned_user?.last_name,
      instructions_or_notes: lead.instructions_or_notes,
      created_by: lead.created_by?.first_name + ' ' + lead.created_by?.last_name,
      updated_by: lead.updated_by ? lead.updated_by?.first_name + ' ' + lead.updated_by?.last_name : '',
      created_at: this.datepipe.transform(lead.created_at, 'yyyy-MM-dd'),
      updated_at: lead.updated_at ? this.datepipe.transform(lead.updated_at, 'yyyy-MM-dd') : ''
    };

    return flattened;
  }


  openRecordOutcome(lead: Lead) {
    const ref = this.dialog.open(RecordResultDialogComponent, {
      width: '550px',
      data: { lead },
    });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.getLeads();
      }
    });
  }

  getOutcomeColor(status: string): string {
    if (!status) return '';
    const colorMap: Record<string, string> = {
      'signed-client': '#10B981',
      'appointment-scheduled': '#8B5CF6',
      'wants-more-information': '#3B82F6',
      'not-interested': '#EF4444',
      'wrong-number': '#EF4444',
      'lost-lead': '#EF4444',
      'call-back-later-today': '#F59E0B',
      'call-back-tomorrow': '#F59E0B',
      'no-answer-left-message': '#6B7280',
      'no-answer-no-message': '#6B7280',
    };
    return colorMap[status] || '#6B7280';
  }

  formatOutcomeLabel(status: string): string {
    if (!status) return '-';
    return status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /** Map backend status to user-friendly UI label */
  getStatusLabel(status: string): string {
    const statusLabels: Record<string, string> = {
      'callback': 'New',
      'assigned': 'Active',
      'interested': 'Contacted',
      'pending-sign': 'Appointment',
      'signed': 'Signed',
      'signed-approved': 'Approved',
      'not-interested': 'Lost',
      'not-qualified': 'Lost',
    };
    return statusLabels[status] || status || '-';
  }

  backClicked() {
    this.location.back();
  }

  // ── CRM Dashboard ──────────────────────────────────────────

  private computeCrmKpis(items: any[]): void {
    const statusMap: Record<string, string> = {
      'callback': 'callback',
      'interested': 'interested',
      'pending-sign': 'pending-sign',
      'signed': 'signed',
      'signed-approved': 'signed',
      'not-interested': 'not-interested',
      'not-qualified': 'not-interested',
    };

    // Count by normalized status
    const counts: Record<string, number> = {};
    for (const item of items) {
      const mapped = statusMap[item.status] || item.status || 'callback';
      counts[mapped] = (counts[mapped] || 0) + 1;
    }

    this.kpiNew = counts['callback'] || 0;
    this.kpiContacted = (counts['interested'] || 0) + (counts['text-sent'] || 0) + (counts['responded-yes'] || 0);
    this.kpiAppointments = counts['pending-sign'] || 0;
    this.kpiSigned = (counts['signed'] || 0) + (counts['signed-approved'] || 0);

    for (const stage of this.pipelineStages) {
      stage.count = counts[stage.key] || 0;
    }
  }

  filterByPipeline(stageKey: string): void {
    if (this.activePipelineFilter === stageKey) {
      // Toggle off — show all
      this.activePipelineFilter = '';
      this.queryParams['status'] = '';
    } else {
      this.activePipelineFilter = stageKey;
      this.queryParams['status'] = stageKey;
    }
    this.pageIndex = 1;
    this.getLeads();
  }

  // ── Compliance ─────────────────────────────────────────────

  getConsent(lead: any): string {
    return this.consentMap.get(lead.id) || 'unknown';
  }

  setConsent(lead: any, value: string): void {
    this.consentMap.set(lead.id, value as any);
  }

  isDncChecked(lead: any): boolean {
    return this.dncCheckedMap.get(lead.id) || false;
  }

  getDncStatus(lead: any): string {
    return this.dncStatusMap.get(lead.id) || 'unknown';
  }

  markDncChecked(lead: any): void {
    this.dncCheckedMap.set(lead.id, true);
    this.dncStatusMap.set(lead.id, 'clear');
  }

  setDncStatus(lead: any, value: string): void {
    this.dncStatusMap.set(lead.id, value as any);
  }

  isCompliant(lead: any): boolean {
    const consent = this.getConsent(lead);
    const dncChecked = this.isDncChecked(lead);
    const dncStatus = this.getDncStatus(lead);
    return consent === 'yes' && dncChecked && dncStatus === 'clear';
  }

  // ── AI Outreach ─────────────────────────────────────────────

  getOutreachStatus(lead: any): string {
    return this.outreachStatusMap.get(lead.id) || 'none';
  }

  private static readonly MOCK_OUTCOMES: { outcome: string; summary: string; nextAction: string }[] = [
    { outcome: 'interested',     summary: 'Homeowner wants inspection scheduled', nextAction: 'Schedule Inspection' },
    { outcome: 'call_back',      summary: 'Requested callback tomorrow morning',  nextAction: 'Set Callback' },
    { outcome: 'no_answer',      summary: 'No answer after 3 rings, voicemail left', nextAction: 'Retry in 2h' },
    { outcome: 'not_interested', summary: 'Homeowner declined, has existing contractor', nextAction: 'Close Lead' },
    { outcome: 'interested',     summary: 'Confirmed damage, wants estimate',     nextAction: 'Assign Adjuster' },
    { outcome: 'call_back',      summary: 'At work, call back after 5pm',          nextAction: 'Set Callback' },
    { outcome: 'no_answer',      summary: 'Phone disconnected or out of service',  nextAction: 'Skip Trace' },
    { outcome: 'interested',     summary: 'Filing insurance claim, needs help',    nextAction: 'Send Info Pack' },
  ];

  runAiOutreach(lead: any): void {
    if (!this.isCompliant(lead)) {
      const reason = this.getConsent(lead) !== 'yes' ? 'consent not confirmed'
        : !this.isDncChecked(lead) ? 'DNC not checked'
        : this.getDncStatus(lead) === 'listed' ? 'on DNC list' : 'not compliant';
      console.log('[Compliance] Outreach blocked for lead', lead.id + ':', reason);
      this.snackBar.open(`Outreach blocked: ${reason}`, 'OK', { duration: 4000 });
      return;
    }
    console.log('[Compliance] Outreach allowed for lead', lead.id);
    this.outreachStatusMap.set(lead.id, 'in-progress');
    console.log('[AI] Outreach started for lead', lead.id);
    this.snackBar.open('AI outreach in progress...', '', { duration: 2000 });

    setTimeout(() => {
      this.outreachStatusMap.set(lead.id, 'completed');

      // Pick a mock result based on lead id hash for consistency
      const hash = lead.id.split('').reduce((h: number, c: string) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
      const idx = Math.abs(hash) % Leads.MOCK_OUTCOMES.length;
      const result = Leads.MOCK_OUTCOMES[idx];
      this.aiResultMap.set(lead.id, result);

      console.log('[AI] Outreach completed for lead', lead.id, '→', result.outcome);
      this.snackBar.open(`AI outreach completed: ${result.outcome.replace(/_/g, ' ')}`, 'OK', { duration: 3000 });
    }, 2000);
  }

  getAiResult(lead: any): { outcome: string; summary: string; nextAction: string } | null {
    return this.aiResultMap.get(lead.id) || null;
  }

  getAiOutcomeColor(outcome: string): string {
    switch (outcome) {
      case 'interested': return '#10b981';
      case 'call_back': return '#eab308';
      case 'no_answer': return '#9ca3af';
      case 'not_interested': return '#ef4444';
      default: return '#9ca3af';
    }
  }

  getAiOutcomeLabel(outcome: string): string {
    switch (outcome) {
      case 'interested': return 'Interested';
      case 'call_back': return 'Call Back';
      case 'no_answer': return 'No Answer';
      case 'not_interested': return 'Not Interested';
      default: return outcome?.replace(/_/g, ' ') || '—';
    }
  }
}
