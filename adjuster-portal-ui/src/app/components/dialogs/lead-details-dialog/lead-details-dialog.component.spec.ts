import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadDetailsDialogComponent } from './lead-details-dialog.component';

describe('LeadDetailsDialogComponent', () => {
  let component: LeadDetailsDialogComponent;
  let fixture: ComponentFixture<LeadDetailsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LeadDetailsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeadDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
