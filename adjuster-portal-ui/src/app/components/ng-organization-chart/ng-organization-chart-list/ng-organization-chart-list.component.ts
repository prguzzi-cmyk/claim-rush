import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NgOrgChartNodeModel } from '../ng-org-chart-node-model';

@Component({
    selector: 'app-ng-organization-chart-list',
    templateUrl: './ng-organization-chart-list.component.html',
    styleUrls: ['./ng-organization-chart-list.component.scss'],
    standalone: false
})
export class NgOrganizationChartListComponent implements OnInit {
  @Input() editable: boolean = false;
  @Input() nodeList: NgOrgChartNodeModel[] = [];
  @Output() onChildClickedEvent = new EventEmitter<NgOrgChartNodeModel>();
  @Output() onChildAddedEvent = new EventEmitter<NgOrgChartNodeModel>();
  @Output() onChildDeletedEvent = new EventEmitter<NgOrgChartNodeModel>();
  @Output() onChildEvaluatedEvent: EventEmitter<NgOrgChartNodeModel> = new EventEmitter()

  constructor() { }

  ngOnInit(): void {
  }

  onClickChild(node: NgOrgChartNodeModel): void {
    this.onChildClickedEvent.emit(node);
  }

  onCreateChild(node: NgOrgChartNodeModel): void {
    this.onChildAddedEvent.emit(node);
  }

  onDeleteChild(node: NgOrgChartNodeModel): void {
    this.onChildDeletedEvent.emit(node);
  }

  onEvaluateAgentTitle(node: NgOrgChartNodeModel) {
    this.onChildEvaluatedEvent.emit(node);
  }
}
