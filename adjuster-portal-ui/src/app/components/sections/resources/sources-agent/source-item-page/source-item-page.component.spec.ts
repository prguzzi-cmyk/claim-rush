import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SourceItemPageComponent } from './source-item-page.component';

describe('SourceItemPageComponent', () => {
  let component: SourceItemPageComponent;
  let fixture: ComponentFixture<SourceItemPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SourceItemPageComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SourceItemPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
