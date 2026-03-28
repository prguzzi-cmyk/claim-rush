import { Component, Input } from '@angular/core';
import { MessageThread } from 'src/app/models/client-portal.model';

@Component({
  selector: 'app-cp-messages',
  templateUrl: './cp-messages.component.html',
  styleUrls: ['./cp-messages.component.scss'],
  standalone: false,
})
export class CpMessagesComponent {
  @Input() threads: MessageThread[] = [];

  selectedThread: MessageThread | null = null;
  newMessage = '';

  selectThread(thread: MessageThread): void {
    this.selectedThread = thread;
    thread.unread = false;
  }

  getLastPreview(thread: MessageThread): string {
    const last = thread.messages[thread.messages.length - 1];
    if (!last) return '';
    return last.body.length > 80 ? last.body.substring(0, 80) + '...' : last.body;
  }
}
