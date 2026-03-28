import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerClaimComponent } from './customer-claim.component';

describe('CustomerClaimComponent', () => {
  let component: CustomerClaimComponent;
  let fixture: ComponentFixture<CustomerClaimComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CustomerClaimComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomerClaimComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
