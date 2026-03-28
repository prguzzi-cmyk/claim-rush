import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BasicCommissionCalculatorComponent } from './basic-commission-calculator.component';

describe('BaiscCommissionCalculatorComponent', () => {
  let component: BasicCommissionCalculatorComponent;
  let fixture: ComponentFixture<BasicCommissionCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BasicCommissionCalculatorComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BasicCommissionCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
