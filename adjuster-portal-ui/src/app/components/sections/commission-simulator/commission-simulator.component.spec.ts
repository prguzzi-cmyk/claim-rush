import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommissionSimulatorComponent } from './commission-simulator.component';

describe('MlmSimulatorComponent', () => {
  let component: CommissionSimulatorComponent;
  let fixture: ComponentFixture<CommissionSimulatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CommissionSimulatorComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommissionSimulatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
