import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTabGroup } from '@angular/material/tabs';
import { UserService } from 'src/app/services/user.service';
import { FireIncidentService } from 'src/app/services/fire-incident.service';
import { CallTypeConfigService } from 'src/app/services/call-type-config.service';
import { FireAgency, FireFilterState, FireIncident } from 'src/app/models/fire-incident.model';

@Component({
  selector: 'app-fire-incidents',
  templateUrl: './fire-incidents.component.html',
  styleUrls: ['./fire-incidents.component.scss'],
  standalone: false,
})
export class FireIncidentsComponent implements OnInit {
  @ViewChild('tabGroup') tabGroup: MatTabGroup;

  selectedTabIndex = 0;

  // Filter state
  selectedAgencyId = '';
  selectedCallType = '';
  selectedDateRange = '24h'; // Default to last 24 hours
  customDateFrom: Date | null = null;
  customDateTo: Date | null = null;

  // 3-mode quick toggle. Maps semantic modes onto the existing CSV
  // call_type filter the backend already accepts:
  //   'all'             → no call_type sent — shows ALL dispatch types
  //                        (Medical, Traffic, EMS, alarms, fires, etc.).
  //                        Labelled "All Incidents" in the UI.
  //   'fire'            → structure-fire + outdoor/veg-fire union.
  //                        Covers every category the ClaimRush Fire Leads
  //                        whitelist uses (Structure / Fire / Working /
  //                        Building / Outside / Grass / Brush / Vehicle /
  //                        Commercial / Residential Fire) via the codes
  //                        SF, CF, RF, WSF, WCF, WRF, WF, FF, GF, VEG,
  //                        VF, IF, OF, CB, WVEG. Labelled "Fire Only".
  //   'structure_fire'  → only the 7 auto_lead_enabled codes (single
  //                        source of truth with the lead routing pool).
  viewMode: 'all' | 'fire' | 'structure_fire' = 'all';
  private static readonly _STRUCTURE_FIRE_CODES =
    'SF,CF,RF,WSF,WCF,WRF,WF';
  private static readonly _FIRE_CODES =
    'SF,CF,RF,WSF,WCF,WRF,WF,FF,GF,VEG,VF,IF,OF,CB,WVEG';

  // Materialized filter object — only changes on explicit user action
  currentFilters: FireFilterState;

  // Lookup data
  agencies: FireAgency[] = [];
  callTypes: { code: string; label: string }[] = [];

  categoryGroups = [
    { label: 'All Building Fires', codes: 'SF,CF,RF,WSF,WCF,WRF,FIRE,FULL' },
    { label: 'All Outdoor Fires', codes: 'VEG,WVEG,GF,OF,FF,VF,CB,IF' },
  ];

  dateRangeOptions = [
    { value: '', label: 'All Time' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Range' },
  ];

  // Row-click → map focus
  selectedIncident: FireIncident | null = null;

  constructor(
    public userService: UserService,
    private fireIncidentService: FireIncidentService,
    private callTypeConfigService: CallTypeConfigService
  ) {
    // Build initial filters (24h default)
    this.currentFilters = this.buildFilters();
  }

  ngOnInit(): void {
    this.loadAgencies();
    this.loadEnabledCallTypes();
  }

  loadAgencies(): void {
    this.fireIncidentService.getAgencies().subscribe({
      next: (res) => {
        this.agencies = res.items || [];
      },
    });
  }

  loadEnabledCallTypes(): void {
    this.callTypeConfigService.getCallTypeConfigs(1, 50).subscribe({
      next: (res) => {
        const configs = res.items || [];
        this.callTypes = configs
          .filter((c: any) => c.is_enabled)
          .map((c: any) => ({ code: c.code, label: c.description }));
      },
    });
  }

  /** Creates a new filter object — call only on explicit user action */
  private buildFilters(): FireFilterState {
    const { dateFrom, dateTo } = this.computeDateRange();
    return {
      agencyId: this.selectedAgencyId,
      callType: this.selectedCallType,
      dateFrom,
      dateTo,
    };
  }

  applyFilters(): void {
    this.currentFilters = this.buildFilters();
  }

  /**
   * 3-mode toggle handler. Maps the semantic mode to the existing
   * `selectedCallType` CSV — the same field the Call Type dropdown
   * writes to — and re-applies. Frontend-only; backend already supports
   * comma-separated `call_type=A,B,C` (fire_incidents.py:68-73).
   */
  onViewModeChange(mode: 'all' | 'fire' | 'structure_fire'): void {
    this.viewMode = mode;
    if (mode === 'all') {
      this.selectedCallType = '';
    } else if (mode === 'fire') {
      this.selectedCallType = FireIncidentsComponent._FIRE_CODES;
    } else {
      this.selectedCallType = FireIncidentsComponent._STRUCTURE_FIRE_CODES;
    }
    this.applyFilters();
  }

  clearFilters(): void {
    this.selectedAgencyId = '';
    this.selectedCallType = '';
    this.selectedDateRange = '24h';
    this.customDateFrom = null;
    this.customDateTo = null;
    this.viewMode = 'all';
    this.currentFilters = this.buildFilters();
  }

  onDateRangeChange(): void {
    if (this.selectedDateRange !== 'custom') {
      this.customDateFrom = null;
      this.customDateTo = null;
    }
    this.applyFilters();
  }

  onCustomDateChange(): void {
    if (this.customDateFrom && this.customDateTo) {
      this.applyFilters();
    }
  }

  computeDateRange(): { dateFrom: string | null; dateTo: string | null } {
    const now = new Date();
    switch (this.selectedDateRange) {
      case '24h': {
        const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return { dateFrom: from.toISOString(), dateTo: null };
      }
      case '7d': {
        const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { dateFrom: from.toISOString(), dateTo: null };
      }
      case '30d': {
        const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { dateFrom: from.toISOString(), dateTo: null };
      }
      case 'custom': {
        const dateFrom = this.customDateFrom ? this.customDateFrom.toISOString() : null;
        const dateTo = this.customDateTo
          ? new Date(this.customDateTo.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
          : null;
        return { dateFrom, dateTo };
      }
      default:
        return { dateFrom: null, dateTo: null };
    }
  }

  getDateRangeLabel(): string {
    switch (this.selectedDateRange) {
      case '24h': return 'Last 24 hours';
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case 'custom': {
        const from = this.customDateFrom ? this.customDateFrom.toLocaleDateString() : '…';
        const to = this.customDateTo ? this.customDateTo.toLocaleDateString() : '…';
        return `${from} – ${to}`;
      }
      default: return 'All time';
    }
  }

  focusIncidentOnMap(incident: FireIncident): void {
    this.selectedIncident = incident;
    this.selectedTabIndex = 1; // Switch to Map View tab
  }

  openIntelPanel(incident: FireIncident): void {
    this.selectedIncident = incident;
  }

  closeIntelPanel(): void {
    this.selectedIncident = null;
  }

  onAgenciesChanged(): void {
    this.loadAgencies();
  }
}
