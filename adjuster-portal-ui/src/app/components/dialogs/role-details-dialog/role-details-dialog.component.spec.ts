import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoleDetailsDialogComponent } from './role-details-dialog.component';

describe('RoleDetailsDialogComponent', () => {
  let component: RoleDetailsDialogComponent;
  let fixture: ComponentFixture<RoleDetailsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RoleDetailsDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RoleDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
