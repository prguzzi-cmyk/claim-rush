import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BusinessDocsComponent } from './business-docs.component';

describe('BusinessDocsComponent', () => {
  let component: BusinessDocsComponent;
  let fixture: ComponentFixture<BusinessDocsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BusinessDocsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BusinessDocsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
