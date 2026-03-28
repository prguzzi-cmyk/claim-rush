import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimTasksDialogComponent } from './claim-tasks-dialog.component';

describe('ClaimTasksDialogComponent', () => {
  let component: ClaimTasksDialogComponent;
  let fixture: ComponentFixture<ClaimTasksDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaimTasksDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClaimTasksDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
