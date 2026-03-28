import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyCommissionComponent } from './my-commission.component';

describe('CommissionSearchComponent', () => {
  let component: MyCommissionComponent;
  let fixture: ComponentFixture<MyCommissionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MyCommissionComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyCommissionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
