import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SourcesAdminComponent } from './sources-admin.component';

describe('SourcesAdminComponent', () => {
  let component: SourcesAdminComponent;
  let fixture: ComponentFixture<SourcesAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SourcesAdminComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SourcesAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
