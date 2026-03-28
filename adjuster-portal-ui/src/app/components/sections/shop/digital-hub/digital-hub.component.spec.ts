import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DigitalHubComponent } from './digital-hub.component';

describe('DigitalHubComponent', () => {
  let component: DigitalHubComponent;
  let fixture: ComponentFixture<DigitalHubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DigitalHubComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DigitalHubComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
