import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommissionResultPanelComponent } from './commission-result-panel.component';

describe('CommissionResultPanelComponent', () => {
  let component: CommissionResultPanelComponent;
  let fixture: ComponentFixture<CommissionResultPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CommissionResultPanelComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommissionResultPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
