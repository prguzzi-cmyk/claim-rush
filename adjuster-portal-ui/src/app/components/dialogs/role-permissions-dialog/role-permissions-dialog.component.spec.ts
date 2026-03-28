import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RolePermissionsDialogComponent } from './role-permissions-dialog.component';

describe('RolePermissionsDialogComponent', () => {
  let component: RolePermissionsDialogComponent;
  let fixture: ComponentFixture<RolePermissionsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RolePermissionsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RolePermissionsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
