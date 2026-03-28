import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FollowupDialogComponent } from './followup-dialog.component';

describe('FollowupDialogComponent', () => {
  let component: FollowupDialogComponent;
  let fixture: ComponentFixture<FollowupDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FollowupDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FollowupDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
