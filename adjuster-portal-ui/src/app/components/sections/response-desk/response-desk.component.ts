import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface ResponseDeskLead {
  id: string;
  ref_number: number;
  address: string | null;
  phone: string | null;
  status: string;
  assigned_agent: string | null;
  assigned_to: string | null;
  last_message: string | null;
  last_message_direction: string | null;
  updated_at: string | null;
}

interface ResponseDeskResponse {
  items: ResponseDeskLead[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

@Component({
  selector: 'app-response-desk',
  templateUrl: './response-desk.component.html',
  styleUrls: ['./response-desk.component.scss'],
  standalone: false,
})
export class ResponseDeskComponent implements OnInit, OnDestroy {
  leads: ResponseDeskLead[] = [];
  total = 0;
  page = 1;
  size = 25;
  isLoading = false;

  displayedColumns = ['address', 'phone', 'status', 'assigned_agent', 'last_message', 'actions'];

  fireStatuses = [
    { value: 'skip-trace-pending', label: 'Skip Trace Pending' },
    { value: 'text-sent', label: 'Text Sent' },
    { value: 'responded-yes', label: 'Responded YES' },
    { value: 'awaiting-call', label: 'Awaiting Call' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'converted', label: 'Converted' },
    { value: 'closed', label: 'Closed' },
  ];

  private pollSub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadData();
    // Auto-refresh every 30 seconds
    this.pollSub = interval(30000).pipe(
      switchMap(() => this.fetchLeads()),
    ).subscribe({
      next: (res) => this.applyData(res),
    });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  loadData(): void {
    this.isLoading = true;
    this.fetchLeads().subscribe({
      next: (res) => {
        this.applyData(res);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private fetchLeads() {
    return this.http.get<ResponseDeskResponse>('leads/response-desk', {
      params: { page: this.page.toString(), size: this.size.toString() },
    });
  }

  private applyData(res: ResponseDeskResponse): void {
    this.leads = res.items;
    this.total = res.total;
  }

  onPageChange(event: any): void {
    this.page = event.pageIndex + 1;
    this.size = event.pageSize;
    this.loadData();
  }

  updateStatus(lead: ResponseDeskLead, newStatus: string): void {
    this.http.put<any>(`leads/${lead.id}`, { status: newStatus }).subscribe({
      next: () => {
        lead.status = newStatus;
        this.snackBar.open('Status updated', 'OK', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Failed to update status', 'OK', { duration: 3000 });
      },
    });
  }

  viewLead(lead: ResponseDeskLead): void {
    this.router.navigate(['/app/leads', lead.id]);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'skip-trace-pending': return 'badge-gray';
      case 'text-sent': return 'badge-blue';
      case 'responded-yes': return 'badge-green';
      case 'awaiting-call': return 'badge-orange';
      case 'assigned': return 'badge-purple';
      case 'converted': return 'badge-dark-green';
      case 'closed': return 'badge-red';
      default: return 'badge-gray';
    }
  }

  getStatusLabel(status: string): string {
    const found = this.fireStatuses.find(s => s.value === status);
    return found ? found.label : status;
  }

  isHighlighted(lead: ResponseDeskLead): boolean {
    return lead.status === 'responded-yes';
  }
}
