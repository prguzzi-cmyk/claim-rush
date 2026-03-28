import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { OutreachService } from 'src/app/services/outreach.service';
import { ConversationMessage } from 'src/app/models/outreach.model';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-outreach-conversations',
  templateUrl: './outreach-conversations.component.html',
  styleUrls: ['./outreach-conversations.component.scss'],
  standalone: false,
})
export class OutreachConversationsComponent implements OnInit {
  leadId: string = '';
  messages: ConversationMessage[] = [];
  newMessage = '';
  selectedChannel = 'sms';
  channels = ['sms', 'email', 'voice', 'in_app'];

  constructor(
    private route: ActivatedRoute,
    private outreachService: OutreachService,
    private spinner: NgxSpinnerService,
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.leadId = params['leadId'];
      if (this.leadId) {
        this.loadThread();
      }
    });
  }

  loadThread() {
    this.spinner.show();
    this.outreachService.getConversation(this.leadId).subscribe((messages) => {
      this.messages = messages;
      this.spinner.hide();
    });
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    this.outreachService.addMessage(this.leadId, {
      channel: this.selectedChannel,
      content: this.newMessage,
      direction: 'outbound',
      sender_type: 'agent',
    }).subscribe(() => {
      this.newMessage = '';
      this.loadThread();
    });
  }
}
