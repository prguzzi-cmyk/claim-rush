import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoliciesDialogComponent } from './policies-dialog.component';

describe('PoliciesDialogComponent', () => {
  let component: PoliciesDialogComponent;
  let fixture: ComponentFixture<PoliciesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PoliciesDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PoliciesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
