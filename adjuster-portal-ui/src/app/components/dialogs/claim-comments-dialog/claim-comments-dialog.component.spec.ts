import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimCommentsDialogComponent } from './claim-comments-dialog.component';

describe('ClaimCommentsDialogComponent', () => {
  let component: ClaimCommentsDialogComponent;
  let fixture: ComponentFixture<ClaimCommentsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaimCommentsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClaimCommentsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
