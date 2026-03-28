import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountDetailsDialogComponent } from './account-details-dialog.component';

describe('AccountDetailsDialogComponent', () => {
  let component: AccountDetailsDialogComponent;
  let fixture: ComponentFixture<AccountDetailsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AccountDetailsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
