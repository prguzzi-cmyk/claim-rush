import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadTasksDialogComponent } from './lead-tasks-dialog.component';

describe('LeadTasksDialogComponent', () => {
  let component: LeadTasksDialogComponent;
  let fixture: ComponentFixture<LeadTasksDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LeadTasksDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeadTasksDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
