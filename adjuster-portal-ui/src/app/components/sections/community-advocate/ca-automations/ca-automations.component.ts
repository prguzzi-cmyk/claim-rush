import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { AutomationRule, AutomationAction, CaRole, AdvocateProfile } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-automations',
  templateUrl: './ca-automations.component.html',
  styleUrls: ['./ca-automations.component.scss'],
  standalone: false,
})
export class CaAutomationsComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  rules: AutomationRule[] = [];
  displayedColumns = ['name', 'trigger', 'actions', 'executions', 'active', 'controls'];

  showBuilder = false;
  editingRule: AutomationRule | null = null;
  ruleForm: Partial<AutomationRule> = {};
  newAction: Partial<AutomationAction> = {};

  triggerOptions = [
    { value: 'new_lead', label: 'New Lead Created' },
    { value: 'event_signup', label: 'Event Sign-up' },
    { value: 'page_visit', label: 'Page Visit' },
    { value: 'referral_received', label: 'Referral Received' },
    { value: 'claim_filed', label: 'Claim Filed' },
  ];

  actionTypes = [
    { value: 'send_email', label: 'Send Email' },
    { value: 'send_sms', label: 'Send SMS' },
    { value: 'assign_advocate', label: 'Assign Advocate' },
    { value: 'create_task', label: 'Create Task' },
    { value: 'add_to_segment', label: 'Add to Segment' },
  ];

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.loadRules();
  }

  private loadRules(): void {
    const sub = this.caService.getAutomationRules().subscribe(data => { this.rules = data; });
    this.subs.push(sub);
  }

  toggleActive(rule: AutomationRule): void {
    const sub = this.caService.toggleAutomationRule(rule.id, !rule.is_active).subscribe(() => {
      rule.is_active = !rule.is_active;
    });
    this.subs.push(sub);
  }

  openBuilder(rule?: AutomationRule): void {
    this.editingRule = rule || null;
    this.ruleForm = rule ? { ...rule, actions: [...rule.actions] } : { name: '', trigger: 'new_lead', trigger_label: '', actions: [], is_active: true };
    this.showBuilder = true;
  }

  closeBuilder(): void {
    this.showBuilder = false;
    this.editingRule = null;
  }

  addAction(): void {
    if (!this.ruleForm.actions) this.ruleForm.actions = [];
    this.ruleForm.actions.push({
      type: (this.newAction.type as any) || 'send_email',
      label: this.actionTypes.find(a => a.value === this.newAction.type)?.label || '',
      config: {},
    });
    this.newAction = {};
  }

  removeAction(index: number): void {
    this.ruleForm.actions?.splice(index, 1);
  }

  saveRule(): void {
    const triggerOpt = this.triggerOptions.find(t => t.value === this.ruleForm.trigger);
    if (triggerOpt) this.ruleForm.trigger_label = triggerOpt.label;

    if (this.editingRule) {
      const sub = this.caService.updateAutomationRule(this.editingRule.id, this.ruleForm).subscribe(() => {
        this.closeBuilder();
        this.loadRules();
      });
      this.subs.push(sub);
    } else {
      const sub = this.caService.createAutomationRule(this.ruleForm).subscribe(() => {
        this.closeBuilder();
        this.loadRules();
      });
      this.subs.push(sub);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
