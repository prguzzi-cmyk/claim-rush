import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommissionAdminComponent } from './commission-admin.component';

describe('CommissionAdminComponent', () => {
  let component: CommissionAdminComponent;
  let fixture: ComponentFixture<CommissionAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CommissionAdminComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommissionAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
