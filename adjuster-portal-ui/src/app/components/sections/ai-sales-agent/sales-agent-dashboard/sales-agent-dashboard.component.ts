import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AiSalesAgentService, AiConversation, LeadStatus, SalesKpi } from '../ai-sales-agent.service';

@Component({
  selector: 'app-sales-agent-dashboard',
  templateUrl: './sales-agent-dashboard.component.html',
  styleUrls: ['./sales-agent-dashboard.component.scss'],
  standalone: false,
})
export class SalesAgentDashboardComponent implements OnInit, OnDestroy {
  conversations: AiConversation[] = [];
  filteredConversations: AiConversation[] = [];
  kpis: SalesKpi | null = null;
  statusFilter: LeadStatus | 'all' = 'all';
  searchTerm = '';
  private subs: Subscription[] = [];

  statusOptions: { value: LeadStatus | 'all'; label: string; icon: string }[] = [
    { value: 'all', label: 'All Leads', icon: 'people' },
    { value: 'new_lead', label: 'New Lead', icon: 'fiber_new' },
    { value: 'contacted', label: 'Contacted', icon: 'phone_callback' },
    { value: 'qualified', label: 'Qualified', icon: 'verified' },
    { value: 'appointment_set', label: 'Appointment Set', icon: 'event_available' },
    { value: 'client_signed', label: 'Client Signed', icon: 'how_to_reg' },
  ];

  constructor(
    private service: AiSalesAgentService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.service.getConversations().subscribe(c => {
        this.conversations = c;
        this.applyFilters();
      }),
      this.service.getKpis().subscribe(k => this.kpis = k),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  applyFilters(): void {
    let list = this.conversations;
    if (this.statusFilter !== 'all') {
      list = list.filter(c => c.status === this.statusFilter);
    }
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(c =>
        c.homeownerName.toLowerCase().includes(term) ||
        c.propertyAddress.toLowerCase().includes(term) ||
        c.city.toLowerCase().includes(term)
      );
    }
    this.filteredConversations = list;
  }

  openConversation(convo: AiConversation): void {
    this.router.navigate(['/app/ai-sales-agent/conversation', convo.id]);
  }

  getStatusCount(status: LeadStatus): number {
    return this.conversations.filter(c => c.status === status).length;
  }

  getStatusBadgeClass(status: string): string {
    const m: Record<string, string> = {
      new_lead: 'badge-cyan', contacted: 'badge-blue', qualified: 'badge-green',
      appointment_set: 'badge-orange', client_signed: 'badge-purple',
    };
    return m[status] || 'badge-muted';
  }

  formatStatus(status: string): string {
    const m: Record<string, string> = {
      new_lead: 'New Lead', contacted: 'Contacted', qualified: 'Qualified',
      appointment_set: 'Appt Set', client_signed: 'Signed',
    };
    return m[status] || status;
  }

  formatClaimType(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  getClaimIcon(type: string): string {
    const m: Record<string, string> = { fire: 'whatshot', water: 'water_drop', storm: 'thunderstorm', vandalism: 'broken_image' };
    return m[type] || 'help';
  }

  timeAgo(ts: string): string {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  }
}
