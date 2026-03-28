import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimDialogComponent } from './claim-dialog.component';

describe('ClaimDialogComponent', () => {
  let component: ClaimDialogComponent;
  let fixture: ComponentFixture<ClaimDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaimDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClaimDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
