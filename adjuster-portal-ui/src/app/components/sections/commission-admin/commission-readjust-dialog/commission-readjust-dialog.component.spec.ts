import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommissionReadjustDialogComponent } from './commission-readjust-dialog.component';

describe('CommissionReadjustDiaglogComponent', () => {
  let component: CommissionReadjustDialogComponent;
  let fixture: ComponentFixture<CommissionReadjustDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CommissionReadjustDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommissionReadjustDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
