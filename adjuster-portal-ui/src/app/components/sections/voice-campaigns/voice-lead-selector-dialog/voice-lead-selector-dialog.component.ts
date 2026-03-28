import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { SelectionModel } from '@angular/cdk/collections';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LeadService } from 'src/app/services/leads.service';

@Component({
  selector: 'app-voice-lead-selector-dialog',
  templateUrl: './voice-lead-selector-dialog.component.html',
  styleUrls: ['./voice-lead-selector-dialog.component.scss'],
  standalone: false,
})
export class VoiceLeadSelectorDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  loading = true;
  searchTerm = '';
  leads: any[] = [];
  totalLeads = 0;
  pageIndex = 1;
  pageSize = 10;

  // Persist selections across pages
  private selectedMap = new Map<string, any>();

  displayedColumns = ['select', 'name', 'phone', 'state', 'source'];
  dataSource = new MatTableDataSource<any>();
  selection = new SelectionModel<any>(true, []);

  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(
    private dialogRef: MatDialogRef<VoiceLeadSelectorDialogComponent>,
    private leadService: LeadService,
  ) {}

  ngOnInit(): void {
    this.loadLeads();
  }

  loadLeads(): void {
    this.loading = true;
    this.saveCurrentSelections();
    this.leadService.getLeads(this.pageIndex, this.pageSize).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        this.leads = response?.items || response || [];
        this.totalLeads = response?.total || this.leads.length;
        this.dataSource.data = this.leads;
        this.restoreSelections();
        this.loading = false;
      },
      error: () => {
        this.leads = [];
        this.dataSource.data = [];
        this.loading = false;
      },
    });
  }

  onSearch(): void {
    this.pageIndex = 1;
    this.saveCurrentSelections();
    if (this.searchTerm.trim()) {
      this.loading = true;
      this.leadService.searchLeads(1, this.pageSize, this.searchTerm).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response: any) => {
          this.leads = response?.items || response || [];
          this.totalLeads = response?.total || this.leads.length;
          this.dataSource.data = this.leads;
          this.restoreSelections();
          this.loading = false;
        },
        error: () => {
          this.leads = [];
          this.dataSource.data = [];
          this.loading = false;
        },
      });
    } else {
      this.loadLeads();
    }
  }

  onPageChange(event: any): void {
    this.saveCurrentSelections();
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    if (this.searchTerm.trim()) {
      this.leadService.searchLeads(this.pageIndex, this.pageSize, this.searchTerm).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response: any) => {
          this.leads = response?.items || response || [];
          this.totalLeads = response?.total || this.leads.length;
          this.dataSource.data = this.leads;
          this.restoreSelections();
        },
      });
    } else {
      this.loadLeads();
    }
  }

  private saveCurrentSelections(): void {
    this.selection.selected.forEach(lead => {
      if (lead?.id) this.selectedMap.set(lead.id, lead);
    });
    // Remove deselected leads from current page
    this.dataSource.data.forEach(lead => {
      if (lead?.id && !this.selection.isSelected(lead)) {
        this.selectedMap.delete(lead.id);
      }
    });
  }

  private restoreSelections(): void {
    this.selection.clear();
    this.dataSource.data.forEach(lead => {
      if (lead?.id && this.selectedMap.has(lead.id)) {
        this.selection.select(lead);
      }
    });
  }

  get totalSelected(): number {
    this.saveCurrentSelections();
    return this.selectedMap.size;
  }

  isAllSelected(): boolean {
    const selectableLeads = this.dataSource.data.filter(l => this.hasPhone(l));
    return selectableLeads.length > 0 && this.selection.selected.length === selectableLeads.length;
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.dataSource.data.filter(l => this.hasPhone(l)));
    }
  }

  get phonelessCount(): number {
    return this.leads.filter(l => !this.hasPhone(l)).length;
  }

  getLeadName(lead: any): string {
    return lead?.contact?.full_name || 'Unknown';
  }

  getLeadPhone(lead: any): string {
    return lead?.contact?.phone_number || '—';
  }

  hasPhone(lead: any): boolean {
    return !!lead?.contact?.phone_number;
  }

  getLeadState(lead: any): string {
    return lead?.contact?.state || lead?.contact?.state_loss || '—';
  }

  confirm(): void {
    this.saveCurrentSelections();
    const selected = Array.from(this.selectedMap.values()).filter(l => this.hasPhone(l));
    this.dialogRef.close(selected);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
