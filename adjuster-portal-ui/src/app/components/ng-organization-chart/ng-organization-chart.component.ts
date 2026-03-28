import {Component, ComponentFactoryResolver, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {NgOrgChartNodeModel} from "./ng-org-chart-node-model";

@Component({
    selector: 'app-ng-organization-chart',
    templateUrl: './ng-organization-chart.component.html',
    styleUrls: ['./ng-organization-chart.component.scss'],
    standalone: false
})
export class NgOrganizationChartComponent implements OnInit {

  @Input() data: Array<NgOrgChartNodeModel> = [];
  @Input() editable: boolean = false;
  @Output() onClickNode: EventEmitter<NgOrgChartNodeModel> = new EventEmitter()
  @Output() onCreateChildNode: EventEmitter<NgOrgChartNodeModel> = new EventEmitter()
  @Output() onDeleteNode: EventEmitter<NgOrgChartNodeModel> = new EventEmitter()
  @Output() onEvaluateChildNode: EventEmitter<NgOrgChartNodeModel> = new EventEmitter()
  @Output() onDragNode: EventEmitter<any> = new EventEmitter()


  constructor(private componentFactoryResolver: ComponentFactoryResolver) { }

  ngOnInit() {
  }

  onClickDeepNode(node) {
    this.onClickNode.emit(node);
  }

  onCreateDeepNode(node) {
    this.onCreateChildNode.emit(node);
  }

  onDeleteDeepNode(node) {
    this.onDeleteNode.emit(node);
  }

  onEvaluateDeepTitle(node: any) {
    console.log(node);
    this.onEvaluateChildNode.emit(node);
  }
}
