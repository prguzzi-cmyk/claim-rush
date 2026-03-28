import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgOrganizationChartNodeComponent } from './ng-organization-chart-node.component';

describe('NgOrganizationChartNodeComponent', () => {
  let component: NgOrganizationChartNodeComponent;
  let fixture: ComponentFixture<NgOrganizationChartNodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NgOrganizationChartNodeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgOrganizationChartNodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
