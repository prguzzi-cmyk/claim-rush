import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimLedgerDialogComponent } from './claim-ledger-dialog.component';

describe('ClaimLedgerDialogComponent', () => {
  let component: ClaimLedgerDialogComponent;
  let fixture: ComponentFixture<ClaimLedgerDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaimLedgerDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClaimLedgerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
