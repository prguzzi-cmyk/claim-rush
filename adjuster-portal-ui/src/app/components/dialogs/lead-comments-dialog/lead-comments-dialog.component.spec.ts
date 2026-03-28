import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadCommentsDialogComponent } from './lead-comments-dialog.component';

describe('LeadCommentsDialogComponent', () => {
  let component: LeadCommentsDialogComponent;
  let fixture: ComponentFixture<LeadCommentsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LeadCommentsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeadCommentsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
