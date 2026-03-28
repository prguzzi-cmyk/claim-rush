import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderDetailsManagementDialogComponent } from './order-details-management-dialog.component';

describe('OrderDetailsManagementDialogComponent', () => {
  let component: OrderDetailsManagementDialogComponent;
  let fixture: ComponentFixture<OrderDetailsManagementDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OrderDetailsManagementDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderDetailsManagementDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
