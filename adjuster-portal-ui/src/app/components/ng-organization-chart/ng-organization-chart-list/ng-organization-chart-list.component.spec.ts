import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgOrganizationChartListComponent } from './ng-organization-chart-list.component';

describe('NgOrganizationChartListComponent', () => {
  let component: NgOrganizationChartListComponent;
  let fixture: ComponentFixture<NgOrganizationChartListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NgOrganizationChartListComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgOrganizationChartListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
