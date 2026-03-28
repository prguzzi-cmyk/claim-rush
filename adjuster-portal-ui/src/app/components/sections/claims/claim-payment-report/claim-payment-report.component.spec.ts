import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimPaymentReportComponent } from './claim-payment-report.component';

describe('ClaimPaymentReportComponent', () => {
  let component: ClaimPaymentReportComponent;
  let fixture: ComponentFixture<ClaimPaymentReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaimPaymentReportComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClaimPaymentReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
