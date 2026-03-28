import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { LeadIntakeService } from '../../../services/lead-intake.service';
import { TabService } from '../../../services/tab.service';
import {
  LeadIntakeRecord,
  ManualLeadIntakeRequest,
  ManualLeadIntakeResponse,
} from '../../../models/lead-intake.model';

@Component({
  selector: 'app-lead-intake',
  templateUrl: './lead-intake.component.html',
  styleUrls: ['./lead-intake.component.scss'],
  standalone: false,
})
export class LeadIntakeComponent implements OnInit {
  // Table
  intakeRecords: LeadIntakeRecord[] = [];
  totalRecords = 0;
  pageIndex = 1;
  pageSize = 25;
  loading = false;

  // Filters
  statusFilter = 'all';
  sourceFilter = 'all';

  // Table columns
  displayedColumns: string[] = [
    'created_at',
    'call_type',
    'address',
    'state',
    'lead_ref',
    'territory',
    'status',
  ];

  // Create form
  showCreateForm = false;
  creating = false;
  creationResult: ManualLeadIntakeResponse | null = null;

  // Manual lead fields
  manualType = 'fire';
  manualAddress = '';
  manualCity = '';
  manualState = '';
  manualZip = '';
  manualCounty = '';
  manualFullName = 'Test Lead';
  manualPhoneNumber = 'N/A';
  manualAutoDistribute = true;

  usStates = [
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'DC', label: 'District of Columbia' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' },
  ];

  leadTypes = [
    { value: 'fire', label: 'Fire' },
    { value: 'hail', label: 'Hail' },
    { value: 'storm', label: 'Storm' },
    { value: 'lightning', label: 'Lightning' },
    { value: 'flood', label: 'Flood' },
    { value: 'theft_vandalism', label: 'Theft / Vandalism' },
  ];

  statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'converted', label: 'Converted' },
    { value: 'pending', label: 'Pending' },
    { value: 'skipped', label: 'Skipped' },
  ];

  sourceOptions = [
    { value: 'all', label: 'All Sources' },
    { value: 'pulsepoint', label: 'UPA Incident Intelligence Network' },
    { value: 'manual', label: 'Manual' },
  ];

  constructor(
    private intakeService: LeadIntakeService,
    private spinner: NgxSpinnerService,
    private snackBar: MatSnackBar,
    private tabService: TabService,
  ) {}

  ngOnInit(): void {
    this.loadRecords();
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  loadRecords(): void {
    this.loading = true;
    this.spinner.show();
    this.intakeService
      .getIntakeRecords(
        this.pageIndex,
        this.pageSize,
        this.statusFilter,
        this.sourceFilter
      )
      .subscribe(
        (data) => {
          this.intakeRecords = data.items;
          this.totalRecords = data.total;
          this.loading = false;
          this.spinner.hide();
        },
        (error) => {
          this.loading = false;
          this.spinner.hide();
          this.snackBar.open('Error loading intake records', 'Close', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
          });
        }
      );
  }

  onFilterChange(): void {
    this.pageIndex = 1;
    this.loadRecords();
  }

  onPageChange(event: any): void {
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadRecords();
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    this.creationResult = null;
  }

  createTestLead(): void {
    if (!this.manualAddress || !this.manualState) {
      this.snackBar.open('Address and State are required', 'Close', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
      return;
    }

    const req: ManualLeadIntakeRequest = {
      incident_type: this.manualType,
      address: this.manualAddress,
      city: this.manualCity || undefined,
      state: this.manualState,
      zip_code: this.manualZip || undefined,
      county: this.manualCounty || undefined,
      full_name: this.manualFullName,
      phone_number: this.manualPhoneNumber,
      auto_distribute: this.manualAutoDistribute,
    };

    this.creating = true;
    this.creationResult = null;

    this.intakeService.createManualLead(req).subscribe(
      (result) => {
        this.creating = false;
        this.creationResult = result;
        this.snackBar.open('Test lead created successfully', 'Close', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
        this.loadRecords();
      },
      (error) => {
        this.creating = false;
        const detail = error?.error?.detail || 'Failed to create test lead';
        this.snackBar.open(detail, 'Close', {
          duration: 7000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      }
    );
  }

  getStatusBadge(record: LeadIntakeRecord): { label: string; cssClass: string } {
    if (record.lead_id) {
      return { label: 'Converted', cssClass: 'badge-converted' };
    }
    if (record.auto_lead_attempted) {
      return { label: 'Skipped', cssClass: 'badge-skipped' };
    }
    return { label: 'Pending', cssClass: 'badge-pending' };
  }

}
