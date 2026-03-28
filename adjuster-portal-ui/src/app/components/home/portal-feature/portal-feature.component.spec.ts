import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalFeatureComponent } from './portal-feature.component';

describe('PortalFeatureComponent', () => {
  let component: PortalFeatureComponent;
  let fixture: ComponentFixture<PortalFeatureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PortalFeatureComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PortalFeatureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
