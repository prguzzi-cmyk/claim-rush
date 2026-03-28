import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadsEditDialogComponent } from './leads-edit-dialog.component';

describe('LeadsEditDialogComponent', () => {
  let component: LeadsEditDialogComponent;
  let fixture: ComponentFixture<LeadsEditDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LeadsEditDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeadsEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
