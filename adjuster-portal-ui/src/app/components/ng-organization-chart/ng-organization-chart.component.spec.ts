import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgOrganizationChartComponent } from './ng-organization-chart.component';

describe('NgOrganizationChartComponent', () => {
  let component: NgOrganizationChartComponent;
  let fixture: ComponentFixture<NgOrganizationChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NgOrganizationChartComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgOrganizationChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
