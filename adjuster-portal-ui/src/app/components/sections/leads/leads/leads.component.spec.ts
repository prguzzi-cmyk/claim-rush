import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Leads } from './leads.component';

describe('Leads', () => {
  let component: Leads;
  let fixture: ComponentFixture<Leads>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ Leads ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(Leads);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
