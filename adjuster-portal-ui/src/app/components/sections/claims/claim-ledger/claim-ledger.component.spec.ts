import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimLedgerComponent } from './claim-ledger.component';

describe('ClaimLedgerComponent', () => {
  let component: ClaimLedgerComponent;
  let fixture: ComponentFixture<ClaimLedgerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaimLedgerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClaimLedgerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
