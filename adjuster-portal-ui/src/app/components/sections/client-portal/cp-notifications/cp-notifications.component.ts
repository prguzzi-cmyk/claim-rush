import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ClaimNotification } from 'src/app/models/client-portal.model';

@Component({
  selector: 'app-cp-notifications',
  templateUrl: './cp-notifications.component.html',
  styleUrls: ['./cp-notifications.component.scss'],
  standalone: false,
})
export class CpNotificationsComponent {
  @Input() notifications: ClaimNotification[] = [];
  @Output() markRead = new EventEmitter<string>();
  @Output() markAllRead = new EventEmitter<void>();

  typeFilter: string | null = null;

  types: { value: string; label: string; icon: string }[] = [
    { value: 'status_change', label: 'Status Updates', icon: 'update' },
    { value: 'payment', label: 'Payments', icon: 'payments' },
    { value: 'document', label: 'Documents', icon: 'description' },
    { value: 'message', label: 'Messages', icon: 'chat' },
    { value: 'appointment', label: 'Appointments', icon: 'event' },
  ];

  get filteredNotifications(): ClaimNotification[] {
    let list = this.notifications;
    if (this.typeFilter) list = list.filter(n => n.type === this.typeFilter);
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  onMarkRead(id: string): void {
    this.markRead.emit(id);
  }

  onMarkAllRead(): void {
    this.markAllRead.emit();
  }

  getTypeLabel(type: string): string {
    return this.types.find(t => t.value === type)?.label || type;
  }

  getTypeIcon(type: string): string {
    return this.types.find(t => t.value === type)?.icon || 'info';
  }

  formatTime(ts: string): string {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
