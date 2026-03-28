import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommissionBreakdownDialogComponent } from './commission-breakdown-dialog.component';

describe('CommissionBreakdownDialogComponent', () => {
  let component: CommissionBreakdownDialogComponent;
  let fixture: ComponentFixture<CommissionBreakdownDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CommissionBreakdownDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommissionBreakdownDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
