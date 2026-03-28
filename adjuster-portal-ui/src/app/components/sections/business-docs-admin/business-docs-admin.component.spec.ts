import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BusinessDocsAdminComponent } from './business-docs-admin.component';

describe('BusinessDocsAdminComponent', () => {
  let component: BusinessDocsAdminComponent;
  let fixture: ComponentFixture<BusinessDocsAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BusinessDocsAdminComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BusinessDocsAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
