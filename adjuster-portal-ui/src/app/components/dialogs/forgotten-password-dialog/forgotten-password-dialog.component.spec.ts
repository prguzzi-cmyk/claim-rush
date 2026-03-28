import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ForgottenPasswordDialogComponent } from './forgotten-password-dialog.component';

describe('ForgottenPasswordDialogComponent', () => {
  let component: ForgottenPasswordDialogComponent;
  let fixture: ComponentFixture<ForgottenPasswordDialogComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ ForgottenPasswordDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ForgottenPasswordDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
