import { Component, OnChanges, SimpleChanges, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FireIncident, FireAgency, FireFilterState } from 'src/app/models/fire-incident.model';
import { FireIncidentService } from 'src/app/services/fire-incident.service';
import { ExcelService } from 'src/app/services/excel.service';
import { FireAgenciesDialogComponent } from '../fire-agencies-dialog/fire-agencies-dialog.component';
import { FireDataSourcesDialogComponent } from '../fire-data-sources-dialog/fire-data-sources-dialog.component';
import { ConvertToLeadDialogComponent } from '../convert-to-lead-dialog/convert-to-lead-dialog.component';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-fire-incidents-list',
  templateUrl: './fire-incidents-list.component.html',
  styleUrls: ['./fire-incidents-list.component.scss'],
  standalone: false,
})
export class FireIncidentsListComponent implements OnChanges {
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

  @Input() filters: FireFilterState;
  @Input() agencies: FireAgency[] = [];
  @Output() rowClicked = new EventEmitter<FireIncident>();
  @Output() showOnMap = new EventEmitter<FireIncident>();
  @Output() agenciesChanged = new EventEmitter<void>();

  dataSource: MatTableDataSource<FireIncident> = new MatTableDataSource([]);
  incidents: FireIncident[] = [];

  totalRecords = 0;
  pageIndex = 1;
  pageSize = 25;
  isLoading = false;

  displayedColumns: string[] = [
    'call_type',
    'address',
    'received_at',
    'source',
    'agency',
    'units',
    'actions',
  ];

  constructor(
    private fireIncidentService: FireIncidentService,
    private excelService: ExcelService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    public userService: UserService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters']) {
      this.pageIndex = 1;
      this.loadIncidents();
    }
  }

  loadIncidents(): void {
    this.isLoading = true;
    const params: any = {};
    if (this.filters) {
      if (this.filters.agencyId) params.agency_id = this.filters.agencyId;
      if (this.filters.callType) params.call_type = this.filters.callType;
      if (this.filters.dateFrom) params.date_from = this.filters.dateFrom;
      if (this.filters.dateTo) params.date_to = this.filters.dateTo;
    }

    this.fireIncidentService.getIncidents(this.pageIndex, this.pageSize, params).subscribe({
      next: (res) => {
        this.incidents = res.items || [];
        this.dataSource = new MatTableDataSource(this.incidents);
        this.totalRecords = res.total || 0;
        this.pageSize = res.size || this.pageSize;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  onPageChange(event: any): void {
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadIncidents();
  }

  onRowClick(incident: FireIncident): void {
    this.rowClicked.emit(incident);
  }

  onShowOnMap(incident: FireIncident, event: MouseEvent): void {
    event.stopPropagation();
    this.showOnMap.emit(incident);
  }

  getUnitsDisplay(unitsJson: string | null): string {
    if (!unitsJson) return '—';
    try {
      const units = JSON.parse(unitsJson);
      return Array.isArray(units) ? units.join(', ') : '—';
    } catch {
      return '—';
    }
  }

  getCallTypeBadgeClass(callType: string): string {
    const fireTypes = [
      'SF', 'CF', 'RF', 'WSF', 'WCF', 'WRF',
      'FF', 'VEG', 'WVEG', 'VF', 'AF', 'CHIM', 'ELF',
      'GF', 'MF', 'OF', 'PF', 'TF', 'WF', 'FIRE', 'FULL', 'IF',
    ];
    if (fireTypes.includes(callType)) return 'badge-fire';
    if (callType === 'ME' || callType === 'EMS' || callType === 'CPR' || callType === 'IFT' || callType === 'MCI') return 'badge-medical';
    if (['FA', 'BA', 'AED', 'MA', 'SD', 'TRBL', 'WFA', 'CMA'].includes(callType)) return 'badge-alarm';
    if (callType === 'SAT') return 'badge-satellite';
    if (callType === '911') return 'badge-dispatch';
    return 'badge-default';
  }

  getSourceBadgeClass(): string {
    return 'source-rin';
  }

  getSourceLabel(): string {
    return 'UPA Incident Intelligence Network';
  }

  showIncidentDetails(incident: FireIncident): void {
    const units = this.getUnitsDisplay(incident.units);
    const msg = `${incident.call_type_description || incident.call_type} — ${incident.address || 'Unknown address'} | Units: ${units}`;
    this.snackBar.open(msg, 'Close', { duration: 6000 });
  }

  openAgenciesDialog(): void {
    const ref = this.dialog.open(FireAgenciesDialogComponent, {
      width: '700px',
      data: { agencies: this.agencies },
    });
    ref.afterClosed().subscribe(() => {
      this.agenciesChanged.emit();
      this.loadIncidents();
    });
  }

  openDataSourcesDialog(): void {
    const ref = this.dialog.open(FireDataSourcesDialogComponent, {
      width: '750px',
    });
    ref.afterClosed().subscribe(() => {
      this.loadIncidents();
    });
  }

  exportToExcel(): void {
    if (this.incidents.length === 0) {
      this.snackBar.open('No data to export.', 'Close', { duration: 3000 });
      return;
    }
    const exportData = this.incidents.map((i) => ({
      'Call Type': i.call_type_description || i.call_type,
      Address: i.address || '',
      'Received At': i.received_at || '',
      Source: this.getSourceLabel(),
      Agency: i.agency?.name || '',
      Units: this.getUnitsDisplay(i.units),
      Status: (i.dispatch_status || (i.is_active ? 'active' : 'cleared')).toUpperCase(),
    }));
    this.excelService.exportAsExcelFile(exportData, 'fire_incidents');
  }

  exportToCsv(): void {
    if (this.incidents.length === 0) {
      this.snackBar.open('No data to export.', 'Close', { duration: 3000 });
      return;
    }
    const exportData = this.incidents.map((i) => ({
      'Call Type': i.call_type_description || i.call_type,
      Address: i.address || '',
      'Received At': i.received_at || '',
      Source: this.getSourceLabel(),
      Agency: i.agency?.name || '',
      Units: this.getUnitsDisplay(i.units),
      Status: (i.dispatch_status || (i.is_active ? 'active' : 'cleared')).toUpperCase(),
    }));
    this.excelService.exportAsCsvFile(exportData, 'fire_incidents');
  }

  openConvertToLeadDialog(incident: FireIncident, event: MouseEvent): void {
    event.stopPropagation();
    if (incident.lead_id) {
      this.snackBar.open('This incident has already been converted to a lead.', 'Close', { duration: 3000 });
      return;
    }
    const ref = this.dialog.open(ConvertToLeadDialogComponent, {
      width: '550px',
      data: { incident },
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.converted) {
        this.loadIncidents();
      }
    });
  }
}
