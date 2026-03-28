import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {NgOrgChartNodeModel} from "../ng-org-chart-node-model";

@Component({
    selector: 'app-ng-organization-chart-node',
    templateUrl: './ng-organization-chart-node.component.html',
    styleUrls: ['./ng-organization-chart-node.component.scss'],
    standalone: false
})
export class NgOrganizationChartNodeComponent implements OnInit {

  @Input() editable: boolean = false;
  @Input() node: NgOrgChartNodeModel
  @Output() onChildClickedEvent: EventEmitter<NgOrgChartNodeModel> = new EventEmitter()
  @Output() onChildAddedEvent: EventEmitter<NgOrgChartNodeModel> = new EventEmitter()
  @Output() onNodeDeletedEvent: EventEmitter<NgOrgChartNodeModel> = new EventEmitter()
  @Output() onChildTitleEvaluatedEvent: EventEmitter<NgOrgChartNodeModel> = new EventEmitter()
  @Output() onDragNode: EventEmitter<any> = new EventEmitter()

  protected childrenStyleClass: string = "horizontal"
  protected isChildrenVisible: boolean = true;

  constructor() { }

  ngOnInit() {
  }

  clickNode($event: MouseEvent) {
    $event.stopPropagation();
    this.onChildClickedEvent.emit(this.node);
  }

  evaluateNodeTitle($event: MouseEvent) {
    $event.stopPropagation();
    this.onChildTitleEvaluatedEvent.emit(this.node);
  }

  addChildNode($event: MouseEvent) {
    $event.stopPropagation();
    this.onChildAddedEvent.emit(this.node);
  }

  deleteCurrentNode($event: MouseEvent) {
    $event.stopPropagation();
    this.onNodeDeletedEvent.emit(this.node);
  }

  onChildClicked(node) {
    this.onChildClickedEvent.emit(node);
  }

  onChildTitleEvaluated(node) {
    this.onChildTitleEvaluatedEvent.emit(node);
  }

  onChildAdded(node) {
    this.onChildAddedEvent.emit(node);
  }

  onChildDeleted(node) {
    this.onNodeDeletedEvent.emit(node);
  }
}
